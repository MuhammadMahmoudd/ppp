/**
 * Encrypted key/value storage for the Supabase session.
 * SecureStore items are size-limited, so we keep a random 32-byte key in the
 * iOS Keychain (SecureStore) and the encrypted blob in AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { fromB64, randomBytes, sealString, toB64, tryOpenString } from './crypto';

const KEY_NAME = 'dildar.storagekey.v1';
let cachedKey: Uint8Array | null = null;

const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

async function storageKey(): Promise<Uint8Array> {
  if (cachedKey) return cachedKey;
  let k = await SecureStore.getItemAsync(KEY_NAME, opts);
  if (!k) {
    k = toB64(randomBytes(32));
    await SecureStore.setItemAsync(KEY_NAME, k, opts);
  }
  cachedKey = fromB64(k);
  return cachedKey;
}

export const encryptedStorage = {
  async getItem(name: string): Promise<string | null> {
    const raw = await AsyncStorage.getItem(`enc.${name}`);
    if (!raw) return null;
    const [c, n] = raw.split('.');
    return tryOpenString(c, n, await storageKey());
  },
  async setItem(name: string, value: string): Promise<void> {
    const s = sealString(value, await storageKey());
    await AsyncStorage.setItem(`enc.${name}`, `${s.c}.${s.n}`);
  },
  async removeItem(name: string): Promise<void> {
    await AsyncStorage.removeItem(`enc.${name}`);
  },
};

/** Small secrets (private key, vault PIN hash) go straight to the Keychain. */
export const secret = {
  get: (k: string) => SecureStore.getItemAsync(k, opts),
  set: (k: string, v: string) => SecureStore.setItemAsync(k, v, opts),
  remove: (k: string) => SecureStore.deleteItemAsync(k, opts),
};
