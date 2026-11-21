/**
 * One private Realtime channel per couple ("couple:<id>") for broadcast +
 * presence (typing, live games, touch taps, online status). Authorization is
 * enforced by RLS on realtime.messages (see migration 0005).
 *
 * Features subscribe with onBroadcast(event, handler); handlers can be added
 * any time because we register a single wildcard listener up front.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { createStore, useStore } from './store';
import { sealJSON, tryOpenJSON, type Sealed } from './crypto';

type Handler = (payload: Record<string, unknown>, from: string) => void;

let channel: RealtimeChannel | null = null;
let channelCouple: string | null = null;
let me: string | null = null;
const handlers = new Map<string, Set<Handler>>();

export type PresenceState = { partnerOnline: boolean; partnerScreen: string | null; connected: boolean };
export const presenceStore = createStore<PresenceState>({ partnerOnline: false, partnerScreen: null, connected: false });
let currentScreen = 'camera';

export function connectCoupleChannel(coupleId: string, userId: string): void {
  if (channel && channelCouple === coupleId) return;
  disconnectCoupleChannel();
  me = userId;
  channelCouple = coupleId;
  const ch = supabase.channel(`couple:${coupleId}`, {
    config: { private: true, broadcast: { self: false, ack: false }, presence: { key: userId } },
  });
  ch.on('broadcast', { event: '*' }, (msg) => {
    const { event, payload } = msg as unknown as { event: string; payload: { from?: string } & Record<string, unknown> };
    const from = String(payload?.from ?? '');
    if (from === me) return;
    handlers.get(event)?.forEach((h) => h(payload, from));
  });
  ch.on('presence', { event: 'sync' }, () => {
    const state = ch.presenceState<{ user_id: string; screen: string }>();
    const others = Object.entries(state).filter(([k]) => k !== userId).flatMap(([, v]) => v);
    presenceStore.set((s) => ({ ...s, partnerOnline: others.length > 0, partnerScreen: others[0]?.screen ?? null }));
  });
  ch.subscribe(async (status) => {
    presenceStore.set((s) => ({ ...s, connected: status === 'SUBSCRIBED' }));
    if (status === 'SUBSCRIBED') {
      await ch.track({ user_id: userId, screen: currentScreen, online_at: new Date().toISOString() });
    }
  });
  channel = ch;
}

export function disconnectCoupleChannel(): void {
  if (channel) supabase.removeChannel(channel).catch(() => undefined);
  channel = null;
  channelCouple = null;
  presenceStore.set({ partnerOnline: false, partnerScreen: null, connected: false });
}

export function setPresenceScreen(screen: string): void {
  currentScreen = screen;
  if (channel && me) channel.track({ user_id: me, screen, online_at: new Date().toISOString() }).catch(() => undefined);
}

export function broadcast(event: string, payload: Record<string, unknown> = {}): void {
  if (!channel) return;
  channel.send({ type: 'broadcast', event, payload: { ...payload, from: me } }).catch(() => undefined);
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

/** postgres_changes for one table of our couple. Returns an unsubscribe fn. */
export function subscribeTable<T extends Record<string, unknown>>(
  table: string,
  coupleId: string,
  cb: (change: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: T; old: Partial<T> }) => void,
  filterColumn = 'couple_id',
): () => void {
  const ch = supabase
    .channel(`db:${table}:${coupleId}:${Math.random().toString(36).slice(2, 8)}`)
    .on(
      'postgres_changes' as never,
      { event: '*', schema: 'public', table, filter: `${filterColumn}=eq.${coupleId}` },
      (p: { eventType: 'INSERT' | 'UPDATE' | 'DELETE'; new: T; old: Partial<T> }) => cb(p),
    )
    .subscribe();
  return () => {
    supabase.removeChannel(ch).catch(() => undefined);
  };
}
