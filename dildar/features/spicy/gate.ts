/**
 * Spicy re-authentication: entering the hub always asks for Face ID; sub
 * screens reuse that unlock for 10 minutes. Going to background clears it.
 */
import { AppState } from 'react-native';
import { createStore, useStore } from '@/lib/store';
import { authenticate } from '@/features/lock/lockStore';

const REUSE_MS = 10 * 60_000;
export const spicyAuthStore = createStore<{ at: number }>({ at: 0 });

let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  AppState.addEventListener('change', (st) => {
    if (st === 'background') spicyAuthStore.set({ at: 0 });
  });
}

export function isSpicyUnlocked(now = Date.now()): boolean {
  const at = spicyAuthStore.get().at;
  return at > 0 && now - at < REUSE_MS;
}

export async function unlockSpicy(reason?: string): Promise<boolean> {
  listen();
  const ok = await authenticate(reason);
  if (ok) spicyAuthStore.set({ at: Date.now() });
  return ok;
}

export function useSpicyUnlocked(): boolean {
  const { at } = useStore(spicyAuthStore);
  return at > 0 && Date.now() - at < REUSE_MS;
}
