/**
 * Live sync with the couple's Durable Object (server/src/room.ts) over one
 * WebSocket:
 *  • broadcast  — typing, game moves, touch taps, miss-you
 *  • presence   — is the partner online, and on which screen
 *  • table changes — the room says "row X of table T changed"; we re-fetch
 *    that row through the rule-checked API, so a notice never carries data
 *    you aren't allowed to see.
 * Reconnects automatically with backoff.
 */
import { Platform } from 'react-native';
import { API_BASE, api, currentToken } from './api';
import { createStore, useStore } from './store';
import { sealJSON, tryOpenJSON, type Sealed } from './crypto';

type Handler = (payload: Record<string, unknown>, from: string) => void;
type Change<T> = { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: T; old: Partial<T> };
type TableSub = { table: string; col: string; value: string; cb: (c: Change<Record<string, unknown>>) => void };
type DbEvent = { table: string; event: 'INSERT' | 'UPDATE' | 'DELETE'; key: Record<string, unknown> };

export type PresenceState = { partnerOnline: boolean; partnerScreen: string | null; connected: boolean };
export const presenceStore = createStore<PresenceState>({ partnerOnline: false, partnerScreen: null, connected: false });

const handlers = new Map<string, Set<Handler>>();
const tableSubs = new Set<TableSub>();
let ws: WebSocket | null = null;
let me: string | null = null;
let wanted = false;
let retry = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let currentScreen = 'camera';

function socketUrl(): string {
  const token = encodeURIComponent(currentToken() ?? '');
  if (API_BASE) return `${API_BASE.replace(/^http/, 'ws')}/api/realtime?access_token=${token}`;
  if (Platform.OS === 'web' && typeof location !== 'undefined') {
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/realtime?access_token=${token}`;
  }
  return '';
}

function send(msg: Record<string, unknown>): void {
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
}

function track(): void {
  if (me) send({ t: 'track', meta: { user_id: me, screen: currentScreen, online_at: new Date().toISOString() } });
}

function open(): void {
  if (!wanted || ws) return;
  const url = socketUrl();
  if (!url || !currentToken()) return scheduleRetry();
  const sock = new WebSocket(url);
  ws = sock;
  sock.onopen = () => {
    retry = 0;
    presenceStore.set((s) => ({ ...s, connected: true }));
    track();
    pingTimer = setInterval(() => send({ t: 'ping' }), 25_000);
  };
  sock.onmessage = (e) => {
    let msg: { t?: string; event?: string; payload?: Record<string, unknown>; from?: string; state?: Record<string, { screen?: string }[]>; events?: DbEvent[] };
    try {
      msg = JSON.parse(String(e.data));
    } catch {
      return;
    }
    if (msg.t === 'bc' && msg.event) {
      const from = String(msg.from ?? '');
      if (from === me) return;
      handlers.get(msg.event)?.forEach((h) => h(msg.payload ?? {}, from));
    } else if (msg.t === 'presence' && msg.state) {
      const others = Object.entries(msg.state).filter(([uid]) => uid !== me).flatMap(([, v]) => v);
      presenceStore.set((s) => ({ ...s, partnerOnline: others.length > 0, partnerScreen: others[0]?.screen ?? null }));
    } else if (msg.t === 'db' && msg.events) {
      msg.events.forEach(handleDbEvent);
    }
  };
  sock.onclose = () => {
    if (ws === sock) ws = null;
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = null;
    presenceStore.set({ partnerOnline: false, partnerScreen: null, connected: false });
    scheduleRetry();
  };
  sock.onerror = () => {
    try {
      sock.close();
    } catch {
      // ignore
    }
  };
}

function scheduleRetry(): void {
  if (!wanted || retryTimer) return;
  const delay = Math.min(30_000, 1000 * 2 ** retry++);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    open();
  }, delay);
}

export function connectCoupleChannel(coupleId: string, userId: string): void {
  void coupleId; // the server routes to the caller's couple room itself
  if (wanted && me === userId && ws) return;
  me = userId;
  wanted = true;
  open();
}

export function disconnectCoupleChannel(): void {
  wanted = false;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  const s = ws;
  ws = null;
  try {
    s?.close();
  } catch {
    // ignore
  }
  presenceStore.set({ partnerOnline: false, partnerScreen: null, connected: false });
}

export function setPresenceScreen(screen: string): void {
  currentScreen = screen;
  track();
}

export function broadcast(event: string, payload: Record<string, unknown> = {}): void {
  send({ t: 'bc', event, payload: { ...payload, from: me } });
}

/** Broadcast with E2E-encrypted body (game state, card text, …). */
export function broadcastSealed(event: string, body: unknown, key: Uint8Array, extra: Record<string, unknown> = {}): void {
  const s = sealJSON(body, key);
  broadcast(event, { ...extra, sealed: s });
}

export function openSealed<T>(payload: Record<string, unknown>, key: Uint8Array | null): T | null {
  const s = payload.sealed as Sealed | undefined;
  return s ? tryOpenJSON<T>(s.c, s.n, key) : null;
}

export function onBroadcast(event: string, h: Handler): () => void {
  let set = handlers.get(event);
  if (!set) handlers.set(event, (set = new Set()));
  set.add(h);
  return () => set?.delete(h);
}

export function usePresence(): PresenceState {
  return useStore(presenceStore);
}

// ─── table changes ─────────────────────────────────────────────────────────
const inflight = new Map<string, Promise<Record<string, unknown> | null>>();

function fetchRow(table: string, key: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  const id = `${table}:${JSON.stringify(key)}`;
  let p = inflight.get(id);
  if (!p) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = api.from(table as never).select('*') as any;
    for (const [k, v] of Object.entries(key)) q = q.eq(k, v);
    const fresh = Promise.resolve(q.maybeSingle() as PromiseLike<{ data: Record<string, unknown> | null }>).then(
      (r) => r.data ?? null,
      () => null,
    );
    inflight.set(id, fresh);
    fresh.finally(() => inflight.delete(id));
    p = fresh;
  }
  return p;
}

function handleDbEvent(e: DbEvent): void {
  const subs = [...tableSubs].filter((s) => s.table === e.table);
  if (!subs.length || !Object.keys(e.key).length) return;
  if (e.event === 'DELETE') {
    for (const s of subs) s.cb({ eventType: 'DELETE', new: {}, old: e.key });
    return;
  }
  fetchRow(e.table, e.key).then((row) => {
    if (!row) return; // not visible to us (private) or already gone
    for (const s of subs) if (String(row[s.col]) === s.value) s.cb({ eventType: e.event, new: row, old: {} });
  });
}

/** Live changes for one table, filtered to rows where `filterColumn` equals `value`. */
export function subscribeTable<T extends Record<string, unknown>>(
  table: string,
  value: string,
  cb: (change: Change<T>) => void,
  filterColumn = 'couple_id',
): () => void {
  const sub: TableSub = { table, col: filterColumn, value, cb: cb as unknown as TableSub['cb'] };
  tableSubs.add(sub);
  return () => {
    tableSubs.delete(sub);
  };
}
