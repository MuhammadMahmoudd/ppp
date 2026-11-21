import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { createStore, useStore } from '@/lib/store';
import { broadcast, subscribeTable } from '@/lib/realtime';
import { notifyPartner } from '@/lib/push';
import { tryOpenString } from '@/lib/crypto';
import { useSession } from '@/lib/session';
import type { CountdownRow, MissYouRow } from '@/lib/database.types';
import { countToday, dayStartUtc, pickCountdown } from './logic';

/** Re-render every `ms` (for live countdowns). */
export function useNow(ms = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export type AsyncState<T> = { data: T | null; loading: boolean; error: boolean; reload: () => Promise<void> };

/** Minimal data loader with loading/error state; reloads when the screen regains focus. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const id = ++seq.current;
    setError(false);
    try {
      const v = await fnRef.current();
      if (id === seq.current) setData(v);
    } catch {
      if (id === seq.current) setError(true);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLoading(true); reload(); }, deps);
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false; // the effect above already loaded
        return;
      }
      reload();
    }, [reload]),
  );
  return { data, loading, error, reload };
}

// ─── countdown (shared store so the chat header updates after edits) ────────
export type CountdownState = { row: CountdownRow | null; title: string | null; loaded: boolean; error: boolean };
export const countdownStore = createStore<CountdownState>({ row: null, title: null, loaded: false, error: false });

export async function loadCountdown(key: Uint8Array | null): Promise<void> {
  const { data, error } = await supabase.from('countdowns').select('*').order('target_at', { ascending: true });
  if (error) {
    countdownStore.set((s) => ({ ...s, loaded: true, error: true }));
    return;
  }
  const row = pickCountdown(data ?? []);
  countdownStore.set({ row, title: row ? tryOpenString(row.title_ciphertext, row.title_nonce, key) : null, loaded: true, error: false });
}

export function useCountdown(): CountdownState & { reload: () => Promise<void> } {
  const { sharedKey } = useSession();
  const st = useStore(countdownStore);
  const reload = useCallback(() => loadCountdown(sharedKey), [sharedKey]);
  useEffect(() => {
    reload();
    const t = setInterval(reload, 5 * 60_000);
    return () => clearInterval(t);
  }, [reload]);
  return { ...st, reload };
}

// ─── miss-you ──────────────────────────────────────────────────────────────
export function useMissYouToday(): { mine: number; theirs: number; loading: boolean } {
  const { couple, userId } = useSession();
  const [events, setEvents] = useState<MissYouRow[]>([]);
  const [loading, setLoading] = useState(true);
  const tz = couple?.home_timezone ?? 'Asia/Baghdad';
  const coupleId = couple?.id;
  const now = useNow(60_000);
  useEffect(() => {
    if (!coupleId) return;
    let alive = true;
    supabase
      .from('miss_you_events')
      .select('*')
      .gte('created_at', dayStartUtc(new Date(), tz).toISOString())
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        if (!alive) return;
        setEvents(data ?? []);
        setLoading(false);
      });
    const off = subscribeTable<MissYouRow>('miss_you_events', coupleId, (c) => {
      if (c.eventType === 'INSERT') setEvents((e) => (e.some((x) => x.id === c.new.id) ? e : [c.new, ...e]));
    });
    return () => {
      alive = false;
      off();
    };
  }, [coupleId, tz]);
  const counts = countToday(events, userId ?? '', tz, new Date(now));
  return { ...counts, loading };
}

/** One tap: log it, buzz them live (if open), push them (if closed). */
export async function sendMissYou(coupleId: string): Promise<boolean> {
  broadcast('miss_you', { at: Date.now() });
  const { error } = await supabase.from('miss_you_events').insert({ couple_id: coupleId });
  if (error) return false;
  notifyPartner('miss_you');
  return true;
}
