/**
 * Chat data: newest 40 messages + pagination, realtime inserts/updates,
 * reactions, optimistic outbox merge, decryption cache, seen receipts and
 * typing indicator.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from '@/lib/supabase';
import { subscribeTable, onBroadcast, broadcast } from '@/lib/realtime';
import { useOutbox, decodeBody, type MessageBody, type OutgoingMessage } from '@/lib/messages';
import { queueStore } from '@/lib/offlineQueue';
import { useStore } from '@/lib/store';
import type { MessageRow, ReactionRow } from '@/lib/database.types';
import { buildChatItems, groupReactions, upsertRow, type ChatItem, type ChatRow } from './model';

const PAGE = 40;
const COLS = 'id,sender_id,type,ciphertext,nonce,media_path,media_nonce,reply_to,disappear_mode,created_at,seen_at,expires_at,deleted_at,meta';

export type ChatState = {
  items: ChatItem[];
  loading: boolean;
  error: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadOlder: () => void;
  reload: () => void;
  decrypt: (r: Pick<ChatRow, 'id' | 'ciphertext' | 'nonce'>) => MessageBody | null;
  findRow: (id: string) => ChatRow | undefined;
  partnerTyping: boolean;
};

export function useChat(coupleId: string, me: string, key: Uint8Array | null, active: boolean): ChatState {
  const [rows, setRows] = useState<ChatRow[]>([]);
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [tick, setTick] = useState(0);
  const outbox = useOutbox();
  const queue = useStore(queueStore);

  // ── decryption cache (keyed by id + ciphertext so deletions re-decode) ──
  const cache = useRef(new Map<string, MessageBody | null>());
  useEffect(() => cache.current.clear(), [key]);
  const decrypt = useCallback(
    (r: Pick<ChatRow, 'id' | 'ciphertext' | 'nonce'>) => {
      const k = `${r.id}:${r.ciphertext?.slice(0, 16) ?? ''}`;
      if (cache.current.has(k)) return cache.current.get(k) ?? null;
      const b = decodeBody(r, key);
      cache.current.set(k, b);
      return b;
    },
    [key],
  );

  // ── ghosts: confirmed outbox items not yet echoed by realtime ──
  const prevOutbox = useRef<OutgoingMessage[]>([]);
  const [ghosts, setGhosts] = useState<OutgoingMessage[]>([]);
  useEffect(() => {
    const ids = new Set(outbox.map((o) => o.id));
    const left = prevOutbox.current.filter((o) => !ids.has(o.id));
    prevOutbox.current = outbox;
    if (!left.length) return;
    setGhosts((g) => [...g, ...left]);
    // fetch them directly in case the realtime echo is slow or missed
    supabase.from('messages').select(COLS).in('id', left.map((l) => l.id)).then(({ data }) => {
      if (data) setRows((rs) => (data as ChatRow[]).reduce(upsertRow, rs));
    });
    const t = setTimeout(() => setGhosts((g) => g.filter((x) => !left.some((l) => l.id === x.id))), 12_000);
    return () => clearTimeout(t);
  }, [outbox]);

  const loadReactions = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const { data } = await supabase.from('message_reactions').select('*').in('message_id', ids);
    if (data) setReactions((rs) => [...rs.filter((r) => !ids.includes(r.message_id)), ...data]);
  }, []);

  const load = useCallback(async () => {
    setError(false);
    const { data, error: e } = await supabase.from('messages').select(COLS).eq('couple_id', coupleId).order('created_at', { ascending: false }).limit(PAGE);
    if (e) {
      setError(true);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as ChatRow[];
    setRows(list);
    setHasMore(list.length === PAGE);
    setLoading(false);
    loadReactions(list.map((r) => r.id));
  }, [coupleId, loadReactions]);

  useEffect(() => {
    load();
  }, [load]);

  const loadOlder = useCallback(async () => {
    if (loadingMore || !hasMore || !rows.length) return;
    setLoadingMore(true);
    const oldest = rows.reduce((a, b) => (a.created_at < b.created_at ? a : b)).created_at;
    const { data } = await supabase.from('messages').select(COLS).eq('couple_id', coupleId).lt('created_at', oldest).order('created_at', { ascending: false }).limit(PAGE);
    const list = (data ?? []) as ChatRow[];
    setRows((rs) => [...rs, ...list.filter((l) => !rs.some((r) => r.id === l.id))]);
    setHasMore(list.length === PAGE);
    setLoadingMore(false);
    loadReactions(list.map((r) => r.id));
  }, [loadingMore, hasMore, rows, coupleId, loadReactions]);

  // ── realtime ──
  useEffect(() => {
    const off1 = subscribeTable<MessageRow>('messages', coupleId, (c) => {
      if (c.eventType === 'DELETE') setRows((rs) => rs.filter((r) => r.id !== c.old.id));
      else if (c.new?.id) setRows((rs) => upsertRow(rs, c.new as ChatRow));
    });
    const off2 = subscribeTable<ReactionRow>('message_reactions', coupleId, (c) => {
      if (c.eventType === 'DELETE') {
        // DELETE payloads only carry the primary key
        setReactions((rs) => rs.filter((r) => !(r.message_id === c.old.message_id && r.user_id === c.old.user_id)));
      } else if (c.new) {
        setReactions((rs) => [...rs.filter((r) => !(r.message_id === c.new.message_id && r.user_id === c.new.user_id)), c.new]);
      }
    });
    // refetch on foreground so nothing is ever missed while backgrounded
    const sub = AppState.addEventListener('change', (st) => st === 'active' && load());
    return () => {
      off1();
      off2();
      sub.remove();
    };
  }, [coupleId, load]);

  // ── typing indicator ──
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const off = onBroadcast('typing', (p) => {
      if (t) clearTimeout(t);
      const on = p.on !== false;
      setPartnerTyping(on);
      if (on) t = setTimeout(() => setPartnerTyping(false), 3500);
    });
    return () => {
      off();
      if (t) clearTimeout(t);
    };
  }, []);

  // ── expiry timer: re-evaluate visibility every 15s ──
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  // ── seen receipts ──
  const unseen = rows.some((r) => r.sender_id !== me && !r.seen_at && !r.deleted_at);
  useEffect(() => {
    if (!active || !unseen || AppState.currentState !== 'active') return;
    const t = setTimeout(() => {
      supabase.rpc('mark_messages_seen').then(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [active, unseen, rows.length]);

  const failedIds = useMemo(() => new Set(queue.filter((j) => j.kind === 'message.insert' && j.attempts > 0).map((j) => j.id)), [queue]);
  const reactionMap = useMemo(() => groupReactions(reactions), [reactions]);

  const items = useMemo(
    () => buildChatItems({ rows, outbox, ghosts, failedIds, reactions: reactionMap, me }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, outbox, ghosts, failedIds, reactionMap, me, tick],
  );

  const rowIndex = useMemo(() => {
    const m = new Map<string, ChatRow>();
    for (const i of items) if (i.kind === 'msg') m.set(i.id, i.row);
    for (const r of rows) if (!m.has(r.id)) m.set(r.id, r);
    return m;
  }, [rows, items]);
  const findRow = useCallback((id: string) => rowIndex.get(id), [rowIndex]);

  return { items, loading, error, hasMore, loadingMore, loadOlder, reload: load, decrypt, findRow, partnerTyping };
}

/** Throttled "I'm typing" broadcast. */
export function useTypingBroadcast() {
  const last = useRef(0);
  return useCallback((text: string) => {
    const now = Date.now();
    if (!text) {
      broadcast('typing', { on: false });
      last.current = 0;
      return;
    }
    if (now - last.current > 2000) {
      last.current = now;
      broadcast('typing', { on: true });
    }
  }, []);
}
