/**
 * Pure chat list logic (no React): merging server rows with the optimistic
 * outbox, visibility rules, day separators and "seen" placement. Unit-tested
 * in __tests__/chat.model.test.ts.
 */
import type { MessageRow, ReactionRow } from '@/lib/database.types';
import type { OutgoingMessage } from '@/lib/messages';

export type MsgStatus = 'sent' | 'sending' | 'failed';

export type ChatRow = Pick<
  MessageRow,
  'id' | 'sender_id' | 'type' | 'ciphertext' | 'nonce' | 'media_path' | 'media_nonce' | 'reply_to' | 'disappear_mode' | 'created_at' | 'seen_at' | 'expires_at' | 'deleted_at'
> & { meta: Record<string, unknown> };

export type MsgItem = {
  kind: 'msg';
  id: string;
  row: ChatRow;
  mine: boolean;
  status: MsgStatus;
  reactions: ReactionRow[];
  /** first message of a run from the same sender (visually the top one) */
  groupStart: boolean;
  /** last message of a run (visually the bottom one) → bubble tail */
  groupEnd: boolean;
  showSeen: boolean;
};
export type DayItem = { kind: 'day'; id: string; day: string };
export type ChatItem = MsgItem | DayItem;

export function outboxToRow(o: OutgoingMessage): ChatRow {
  return {
    id: o.id,
    sender_id: o.sender_id,
    type: o.type,
    ciphertext: o.ciphertext,
    nonce: o.nonce,
    media_path: o.media_path,
    media_nonce: o.media_nonce,
    reply_to: o.reply_to,
    disappear_mode: o.disappear_mode,
    created_at: o.created_at,
    seen_at: null,
    expires_at: null,
    deleted_at: null,
    meta: o.meta as Record<string, unknown>,
  };
}

/** Disappeared (expired) messages vanish; sender-deleted ones keep a tombstone. */
export function isVisible(r: ChatRow, now: number): boolean {
  if (r.expires_at && new Date(r.expires_at).getTime() <= now) return false;
  return true;
}

export function isTombstone(r: ChatRow): boolean {
  return !!r.deleted_at;
}

/** Local calendar day (device zone) as YYYY-MM-DD. */
export function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const GROUP_GAP_MS = 4 * 60_000;

/**
 * Builds the list for an INVERTED FlashList (index 0 = newest, at the bottom).
 *  - server rows win over outbox copies (same client id)
 *  - `ghosts` are outbox items already confirmed but not yet echoed by
 *    realtime; they render as 'sent' to avoid a flicker
 *  - day separators come right after (= visually above) each day's oldest message
 */
export function buildChatItems(args: {
  rows: ChatRow[];
  outbox: OutgoingMessage[];
  ghosts?: OutgoingMessage[];
  failedIds?: Set<string>;
  reactions: Map<string, ReactionRow[]>;
  me: string;
  now?: number;
}): ChatItem[] {
  const now = args.now ?? Date.now();
  const byId = new Map<string, { row: ChatRow; status: MsgStatus }>();
  for (const r of args.rows) byId.set(r.id, { row: r, status: 'sent' });
  for (const g of args.ghosts ?? []) if (!byId.has(g.id)) byId.set(g.id, { row: outboxToRow(g), status: 'sent' });
  for (const o of args.outbox) {
    if (!byId.has(o.id)) byId.set(o.id, { row: outboxToRow(o), status: args.failedIds?.has(o.id) ? 'failed' : 'sending' });
  }
  const list = [...byId.values()]
    .filter((x) => isVisible(x.row, now))
    .sort((a, b) => (a.row.created_at < b.row.created_at ? 1 : a.row.created_at > b.row.created_at ? -1 : a.row.id < b.row.id ? 1 : -1));

  // newest message of mine that the partner has seen
  const seenId = list.find((x) => x.row.sender_id === args.me && x.row.seen_at)?.row.id ?? null;

  const out: ChatItem[] = [];
  for (let i = 0; i < list.length; i++) {
    const cur = list[i];
    const newer = list[i - 1]?.row;
    const older = list[i + 1]?.row;
    const t = new Date(cur.row.created_at).getTime();
    const sameAsOlder = !!older && older.sender_id === cur.row.sender_id && t - new Date(older.created_at).getTime() < GROUP_GAP_MS && localDay(older.created_at) === localDay(cur.row.created_at);
    const sameAsNewer = !!newer && newer.sender_id === cur.row.sender_id && new Date(newer.created_at).getTime() - t < GROUP_GAP_MS && localDay(newer.created_at) === localDay(cur.row.created_at);
    out.push({
      kind: 'msg',
      id: cur.row.id,
      row: cur.row,
      mine: cur.row.sender_id === args.me,
      status: cur.status,
      reactions: args.reactions.get(cur.row.id) ?? [],
      groupStart: !sameAsOlder,
      groupEnd: !sameAsNewer,
      showSeen: cur.row.id === seenId,
    });
    const day = localDay(cur.row.created_at);
    if (!older || localDay(older.created_at) !== day) out.push({ kind: 'day', id: `day-${day}`, day });
  }
  return out;
}

/** Upsert by id, newest first, used for realtime INSERT/UPDATE. */
export function upsertRow(rows: ChatRow[], r: ChatRow): ChatRow[] {
  const i = rows.findIndex((x) => x.id === r.id);
  if (i === -1) return [r, ...rows];
  const next = rows.slice();
  next[i] = r;
  return next;
}

export function groupReactions(list: ReactionRow[]): Map<string, ReactionRow[]> {
  const m = new Map<string, ReactionRow[]>();
  for (const r of list) {
    const arr = m.get(r.message_id);
    if (arr) arr.push(r);
    else m.set(r.message_id, [r]);
  }
  return m;
}

/** "3:05" style duration. */
export function mmss(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Down-samples meter readings (dBFS, -160..0) to N bars in 0..1. */
export function waveform(samples: number[], bars = 28): number[] {
  if (!samples.length) return Array.from({ length: bars }, () => 0.15);
  const out: number[] = [];
  const step = samples.length / bars;
  for (let i = 0; i < bars; i++) {
    const slice = samples.slice(Math.floor(i * step), Math.max(Math.floor(i * step) + 1, Math.floor((i + 1) * step)));
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    out.push(Math.round(Math.min(1, Math.max(0.08, (avg + 55) / 55)) * 100) / 100);
  }
  return out;
}
