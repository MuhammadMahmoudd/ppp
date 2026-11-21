/**
 * Offline queue: work created while offline (messages, reactions…) is
 * persisted and flushed automatically when the network returns.
 * Jobs must be idempotent (we use client-generated ids + upsert).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { createStore, useStore } from './store';

export type Job = { id: string; kind: string; payload: Record<string, unknown>; attempts: number; createdAt: number };
type Runner = (payload: Record<string, unknown>) => Promise<void>;

const KEY = 'dildar.queue.v1';
const runners = new Map<string, Runner>();
export const queueStore = createStore<Job[]>([]);
export const onlineStore = createStore<boolean>(true);
let flushing = false;
let started = false;

async function persist() {
  await AsyncStorage.setItem(KEY, JSON.stringify(queueStore.get())).catch(() => undefined);
}

export function registerRunner(kind: string, run: Runner): void {
  runners.set(kind, run);
}

export async function enqueue(kind: string, id: string, payload: Record<string, unknown>): Promise<void> {
  queueStore.set((q) => [...q.filter((j) => j.id !== id), { id, kind, payload, attempts: 0, createdAt: Date.now() }]);
  await persist();
  flush();
}

export function isPending(id: string): boolean {
  return queueStore.get().some((j) => j.id === id);
}

export async function flush(): Promise<void> {
  if (flushing || !onlineStore.get()) return;
  flushing = true;
  try {
    for (const job of [...queueStore.get()].sort((a, b) => a.createdAt - b.createdAt)) {
      const run = runners.get(job.kind);
      if (!run) continue;
      try {
        await run(job.payload);
        queueStore.set((q) => q.filter((j) => j.id !== job.id));
      } catch {
        queueStore.set((q) => q.map((j) => (j.id === job.id ? { ...j, attempts: j.attempts + 1 } : j)));
        break; // keep order: stop at first failure and retry later
      }
    }
  } finally {
    flushing = false;
    await persist();
  }
}

export async function startQueue(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) queueStore.set(JSON.parse(raw) as Job[]);
  } catch {
    // ignore corrupt queue
  }
  NetInfo.addEventListener((s) => {
    const online = !!s.isConnected && s.isInternetReachable !== false;
    onlineStore.set(online);
    if (online) flush();
  });
  AppState.addEventListener('change', (st) => st === 'active' && flush());
  setInterval(() => queueStore.get().length && flush(), 15_000);
}

export function useOnline(): boolean {
  return useStore(onlineStore);
}

export function usePendingIds(): Set<string> {
  const q = useStore(queueStore);
  return new Set(q.map((j) => j.id));
}
