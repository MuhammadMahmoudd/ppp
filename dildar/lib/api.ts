/**
 * Client for the Dildar Cloudflare Worker (server/). It keeps the small,
 * familiar query surface the app was written against:
 *
 *   api.from('messages').select('*').eq('couple_id', id).order('created_at', { ascending: false }).limit(40)
 *   api.rpc('mark_messages_seen')
 *   api.storage.from('vault').upload(path, bytes)
 *   api.auth.signInWithPassword({ email, password })
 *
 * Every request carries the session token; the Worker applies the access
 * rules (server/src/tables.ts). Results are `{ data, error }`, never throws.
 */
import { Platform } from 'react-native';
import type { Database } from './database.types';
import { encryptedStorage } from './secureStorage';

const BASE = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** On the web the API is served from the same origin as the app. */
export const apiConfigured = Platform.OS === 'web' ? true : /^https?:\/\/.+/.test(BASE);
export const API_BASE = BASE;

export type ApiError = { code: string; message: string };
export type Result<T> = { data: T; error: null } | { data: null; error: ApiError };

// ─── session ───────────────────────────────────────────────────────────────
export type User = { id: string; email: string };
export type Session = { access_token: string; token_type?: string; user: User };
type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'INITIAL_SESSION';

const SESSION_KEY = 'dildar.session.v1';
let session: Session | null = null;
let loaded: Promise<void> | null = null;
const authListeners = new Set<(e: AuthEvent, s: Session | null) => void>();

function loadSession(): Promise<void> {
  if (!loaded) {
    loaded = encryptedStorage
      .getItem(SESSION_KEY)
      .then((raw) => {
        session = raw ? (JSON.parse(raw) as Session) : null;
      })
      .catch(() => {
        session = null;
      });
  }
  return loaded;
}

async function setSession(s: Session | null, event: AuthEvent): Promise<void> {
  session = s;
  if (s) await encryptedStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else await encryptedStorage.removeItem(SESSION_KEY);
  authListeners.forEach((l) => l(event, s));
}

export function currentToken(): string | null {
  return session?.access_token ?? null;
}

// ─── transport ─────────────────────────────────────────────────────────────
const fail = (code: string): { data: null; error: ApiError } => ({ data: null, error: { code, message: code } });

async function request<T>(path: string, init: RequestInit = {}): Promise<Result<T>> {
  await loadSession();
  const headers = new Headers(init.headers);
  if (session) headers.set('Authorization', `Bearer ${session.access_token}`);
  if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    return fail('network');
  }
  let body: { data?: T; error?: ApiError; session?: Session } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.status === 401 && session && !path.startsWith('/api/auth/sign')) {
    // token expired or revoked
    await setSession(null, 'SIGNED_OUT');
  }
  if (!res.ok || body?.error) return { data: null, error: body?.error ?? { code: `http_${res.status}`, message: `http_${res.status}` } };
  return { data: (body?.data ?? null) as T, error: null };
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

// ─── tables ────────────────────────────────────────────────────────────────
type Tables = Database['public']['Tables'];
type Functions = Database['public']['Functions'];
type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'is' | 'in' | 'not.is';
type Q = {
  op: 'select' | 'insert' | 'upsert' | 'update' | 'delete';
  columns?: string;
  filters: [string, FilterOp, unknown][];
  order: [string, boolean][];
  limit?: number;
  rows?: unknown[];
  values?: unknown;
  onConflict?: string;
  ignoreDuplicates?: boolean;
  returning?: boolean;
};
type Mode = 'many' | 'single' | 'maybe';

export class Query<R, Out> implements PromiseLike<Result<Out>> {
  constructor(private table: string, private q: Q, private mode: Mode = 'many') {}

  private next<O>(patch: Partial<Q>, mode: Mode = this.mode): Query<R, O> {
    return new Query<R, O>(this.table, { ...this.q, ...patch, filters: patch.filters ?? this.q.filters, order: patch.order ?? this.q.order }, mode);
  }

  /** Read rows, or (after insert/update/upsert/delete) return the affected rows. */
  select(columns = '*'): Query<R, R[]> {
    if (this.q.op === 'select') return this.next<R[]>({ columns });
    return this.next<R[]>({ returning: true });
  }
  eq<K extends keyof R & string>(col: K, value: R[K] | string | number | boolean): Query<R, Out> {
    return this.next({ filters: [...this.q.filters, [col, 'eq', value]] });
  }
  neq<K extends keyof R & string>(col: K, value: R[K] | string | number | boolean): Query<R, Out> {
    return this.next({ filters: [...this.q.filters, [col, 'neq', value]] });
  }
  gt<K extends keyof R & string>(col: K, value: string | number): Query<R, Out> {
    return this.next({ filters: [...this.q.filters, [col, 'gt', value]] });
  }
  gte<K extends keyof R & string>(col: K, value: string | number): Query<R, Out> {
    return this.next({ filters: [...this.q.filters, [col, 'gte', value]] });
  }
  lt<K extends keyof R & string>(col: K, value: string | number): Query<R, Out> {
    return this.next({ filters: [...this.q.filters, [col, 'lt', value]] });
  }
  lte<K extends keyof R & string>(col: K, value: string | number): Query<R, Out> {
    return this.next({ filters: [...this.q.filters, [col, 'lte', value]] });
  }
  is<K extends keyof R & string>(col: K, value: null | boolean): Query<R, Out> {
    return this.next({ filters: [...this.q.filters, [col, 'is', value]] });
  }
  in<K extends keyof R & string>(col: K, values: readonly unknown[]): Query<R, Out> {
    return this.next({ filters: [...this.q.filters, [col, 'in', [...values]]] });
  }
  /** Only `not(col, 'is', null)` is supported. */
  not<K extends keyof R & string>(col: K, _op: 'is', value: null | boolean): Query<R, Out> {
    return this.next({ filters: [...this.q.filters, [col, 'not.is', value]] });
  }
  /** Equality on several columns at once. */
  match(values: Partial<R>): Query<R, Out> {
    const add = Object.entries(values).map(([k, v]) => [k, 'eq', v] as [string, FilterOp, unknown]);
    return this.next({ filters: [...this.q.filters, ...add] });
  }
  order<K extends keyof R & string>(col: K, opts: { ascending?: boolean } = {}): Query<R, Out> {
    return this.next({ order: [...this.q.order, [col, opts.ascending !== false]] });
  }
  limit(n: number): Query<R, Out> {
    return this.next({ limit: n });
  }
  single(): Query<R, R> {
    return this.next<R>({}, 'single');
  }
  maybeSingle(): Query<R, R | null> {
    return this.next<R | null>({}, 'maybe');
  }

  then<A = Result<Out>, B = never>(ok?: ((v: Result<Out>) => A | PromiseLike<A>) | null, bad?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return this.run().then(ok, bad);
  }

  private async run(): Promise<Result<Out>> {
    const r = await post<R[] | null>(`/api/rest/${this.table}`, this.q);
    if (r.error) return r;
    const rows = r.data;
    if (this.mode === 'single') {
      if (!rows || rows.length !== 1) return fail(rows && rows.length > 1 ? 'multiple_rows' : 'not_found');
      return { data: rows[0] as unknown as Out, error: null };
    }
    if (this.mode === 'maybe') return { data: ((rows && rows[0]) ?? null) as unknown as Out, error: null };
    return { data: (rows ?? null) as unknown as Out, error: null };
  }
}

class TableRef<T extends keyof Tables> {
  constructor(private name: T) {}
  private base(op: Q['op'], extra: Partial<Q> = {}): Q {
    return { op, filters: [], order: [], ...extra };
  }
  select(columns = '*'): Query<Tables[T]['Row'], Tables[T]['Row'][]> {
    return new Query(this.name, this.base('select', { columns }));
  }
  insert(rows: Tables[T]['Insert'] | Tables[T]['Insert'][]): Query<Tables[T]['Row'], null> {
    return new Query(this.name, this.base('insert', { rows: Array.isArray(rows) ? rows : [rows] }));
  }
  upsert(rows: Tables[T]['Insert'] | Tables[T]['Insert'][], opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}): Query<Tables[T]['Row'], null> {
    return new Query(this.name, this.base('upsert', { rows: Array.isArray(rows) ? rows : [rows], ...opts }));
  }
  update(values: Tables[T]['Update']): Query<Tables[T]['Row'], null> {
    return new Query(this.name, this.base('update', { values }));
  }
  delete(): Query<Tables[T]['Row'], null> {
    return new Query(this.name, this.base('delete'));
  }
}

// ─── storage ───────────────────────────────────────────────────────────────
class BucketRef {
  constructor(private bucket: string) {}
  private url(path: string) {
    return `/api/storage/${this.bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
  }
  upload(path: string, body: ArrayBuffer | Uint8Array, _opts: { contentType?: string; upsert?: boolean } = {}) {
    // copy views into a tight buffer so exactly these bytes are sent
    const bytes = body instanceof Uint8Array ? (body.byteOffset === 0 && body.byteLength === body.buffer.byteLength ? body : body.slice()) : new Uint8Array(body);
    return request<{ path: string }>(this.url(path), {
      method: 'PUT',
      body: bytes as unknown as BodyInit,
      headers: { 'Content-Type': 'application/octet-stream' },
    });
  }
  async download(path: string): Promise<Result<{ arrayBuffer(): Promise<ArrayBuffer> }>> {
    await loadSession();
    try {
      const res = await fetch(`${BASE}${this.url(path)}`, { headers: session ? { Authorization: `Bearer ${session.access_token}` } : {} });
      if (!res.ok) return fail(res.status === 404 ? 'not_found' : `http_${res.status}`);
      const buf = await res.arrayBuffer();
      return { data: { arrayBuffer: async () => buf }, error: null };
    } catch {
      return fail('network');
    }
  }
  remove(paths: string[]) {
    return post<string[]>(`/api/storage/${this.bucket}/remove`, { paths });
  }
}

// ─── the client ────────────────────────────────────────────────────────────
export const api = {
  from<T extends keyof Tables>(name: T) {
    return new TableRef(name);
  },
  rpc<N extends keyof Functions>(name: N, args?: Functions[N]['Args']): Promise<Result<Functions[N]['Returns']>> {
    return post<Functions[N]['Returns']>(`/api/rpc/${String(name)}`, args ?? {});
  },
  storage: {
    from: (bucket: string) => new BucketRef(bucket),
  },
  functions: {
    invoke: <T = unknown>(name: string, opts: { body?: unknown } = {}) => post<T>(`/api/functions/${name}`, opts.body ?? {}),
  },
  auth: {
    async getSession(): Promise<{ data: { session: Session | null } }> {
      await loadSession();
      return { data: { session } };
    },
    onAuthStateChange(cb: (e: AuthEvent, s: Session | null) => void) {
      authListeners.add(cb);
      return { data: { subscription: { unsubscribe: () => void authListeners.delete(cb) } } };
    },
    signUp: (c: { email: string; password: string }) => authCall('/api/auth/signup', c),
    signInWithPassword: (c: { email: string; password: string }) => authCall('/api/auth/signin', c),
    async signOut(): Promise<{ error: null }> {
      await post('/api/auth/signout', {});
      await setSession(null, 'SIGNED_OUT');
      return { error: null };
    },
    startAutoRefresh() {
      // opaque long-lived tokens: nothing to refresh
    },
    stopAutoRefresh() {
      // see startAutoRefresh
    },
  },
};

// The auth endpoints answer { session } instead of { data }.
async function authCall(path: string, c: { email: string; password: string }): Promise<Result<{ session: Session | null; user: User | null }>> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
  } catch {
    return fail('network');
  }
  const body = (await res.json().catch(() => null)) as { session?: Session; error?: ApiError } | null;
  if (!res.ok || !body?.session) return { data: null, error: body?.error ?? { code: `http_${res.status}`, message: `http_${res.status}` } };
  await setSession(body.session, 'SIGNED_IN');
  return { data: { session: body.session, user: body.session.user }, error: null };
}

/** Short error code for translating messages ("couple_full", "network", …). */
export function errorCode(e: unknown): string {
  if (e && typeof e === 'object') {
    if ('code' in e && typeof (e as { code: unknown }).code === 'string') return (e as { code: string }).code;
    if ('message' in e) {
      const m = String((e as { message: unknown }).message);
      const known = m.match(/\b[a-z]+(?:_[a-z]+)+\b/);
      if (known) return known[0];
      if (/network|fetch/i.test(m)) return 'network';
      return m;
    }
  }
  return 'unknown';
}

export const STORAGE_BUCKETS = { snaps: 'snaps', vault: 'vault', chat: 'chat-media', avatars: 'avatars' } as const;
export type Bucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];
