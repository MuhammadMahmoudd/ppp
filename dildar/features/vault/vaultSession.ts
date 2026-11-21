/** In-memory vault unlock state. Locks again when the app leaves the foreground. */
import { AppState } from 'react-native';
import { createStore, useStore } from '@/lib/store';
import { cacheClear } from '@/lib/media';

export const vaultSession = createStore<{ unlocked: boolean }>({ unlocked: false });
export const useVaultUnlocked = () => useStore(vaultSession, (s) => s.unlocked);

export function lockVault(): void {
  vaultSession.set({ unlocked: false });
  cacheClear(); // drop decrypted thumbnails from memory
}

let installed = false;
export function installVaultAutoLock(): void {
  if (installed) return;
  installed = true;
  AppState.addEventListener('change', (st) => {
    if (st !== 'active' && vaultSession.get().unlocked) lockVault();
  });
}
