import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { createStore, useStore } from '@/lib/store';
import { currentStrings } from '@/lib/i18n';

export type LockState = { locked: boolean; hidden: boolean; cover: boolean; authenticating: boolean };
// Browsers have no Face ID: the web build starts unlocked.
const IS_WEB = Platform.OS === 'web';
export const lockStore = createStore<LockState>({ locked: !IS_WEB, hidden: false, cover: false, authenticating: false });

export const useLock = () => useStore(lockStore);

/** Face ID / passcode. Falls back to the device passcode when Face ID fails. */
export async function authenticate(reason?: string): Promise<boolean> {
  if (IS_WEB) return true;
  if (lockStore.get().authenticating) return false;
  lockStore.set((s) => ({ ...s, authenticating: true }));
  try {
    const hasHw = await LocalAuthentication.hasHardwareAsync();
    const enrolled = hasHw && (await LocalAuthentication.isEnrolledAsync());
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    // No biometrics and no passcode on the device → nothing to check against.
    if (!enrolled && level === LocalAuthentication.SecurityLevel.NONE) return true;
    const s = currentStrings();
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: reason ?? s.lock.prompt,
      cancelLabel: s.common.cancel,
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  } finally {
    lockStore.set((s) => ({ ...s, authenticating: false }));
  }
}

export async function unlock(): Promise<boolean> {
  const ok = await authenticate();
  if (ok) lockStore.set((s) => ({ ...s, locked: false, hidden: false }));
  return ok;
}

export function lockNow(): void {
  lockStore.set((s) => ({ ...s, locked: true }));
}

export function quickHide(): void {
  lockStore.set((s) => ({ ...s, hidden: true, locked: true }));
}
