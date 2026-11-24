export class HttpError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

export const nowIso = (): string => new Date().toISOString();
export const addMs = (ms: number): string => new Date(Date.now() + ms).toISOString();
export const uuid = (): string => crypto.randomUUID();

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function fail(e: unknown): Response {
  if (e instanceof HttpError) return json({ error: { code: e.code, message: e.code } }, e.status);
  const msg = e instanceof Error ? e.message : String(e);
  // SQLite RAISE(ABORT, 'couple_full') surfaces in the message
  const known = msg.match(/\b(couple_full|member_immutable)\b/);
  if (known) return json({ error: { code: known[1], message: known[1] } }, 409);
  if (/UNIQUE constraint failed/.test(msg)) return json({ error: { code: 'duplicate', message: 'duplicate' } }, 409);
  if (/CHECK constraint failed|NOT NULL constraint failed|FOREIGN KEY constraint failed/.test(msg)) {
    return json({ error: { code: 'invalid', message: 'invalid' } }, 400);
  }
  console.error(msg);
  return json({ error: { code: 'server_error', message: 'server_error' } }, 500);
}

export function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}

export async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32): string {
  const u = new Uint8Array(bytes);
  crypto.getRandomValues(u);
  return b64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Constant-time string compare. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export type Row = Record<string, unknown>;
