/**
 * Web version of lib/secureStorage.ts. Browsers have no Keychain, so both the
 * session blob and small secrets (private key, vault PIN hash) live in
 * localStorage. The session is still sealed with a random key, but that key
 * sits next to it — treat this as "obscured", not protected: anything that can
 * run script on the page (XSS, a malicious extension) can read it. Prefer the
 * iPhone build for real use; the website is for testing.
 */
import { fromB64, randomBytes, sealString, toB64, tryOpenString } from './crypto';

const KEY_NAME = 'dildar.storagekey.v1';
let cachedKey: Uint8Array | null = null;

function ls(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // private mode / blocked storage
  }
}

function storageKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const store = ls();
  let k = store?.getItem(KEY_NAME) ?? null;
  if (!k) {
    k = toB64(randomBytes(32));
    store?.setItem(KEY_NAME, k);
  }
  cachedKey = fromB64(k);
  return cachedKey;
}

export const encryptedStorage = {
  async getItem(name: string): Promise<string | null> {
    const raw = ls()?.getItem(`enc.${name}`);
    if (!raw) return null;
    const [c, n] = raw.split('.');
    return tryOpenString(c, n, storageKey());
  },
  async setItem(name: string, value: string): Promise<void> {
    const s = sealString(value, storageKey());
    ls()?.setItem(`enc.${name}`, `${s.c}.${s.n}`);
  },
  async removeItem(name: string): Promise<void> {
    ls()?.removeItem(`enc.${name}`);
  },
};

export const secret = {
  get: async (k: string): Promise<string | null> => ls()?.getItem(`secret.${k}`) ?? null,
  set: async (k: string, v: string): Promise<void> => {
    ls()?.setItem(`secret.${k}`, v);
  },
  remove: async (k: string): Promise<void> => {
    ls()?.removeItem(`secret.${k}`);
  },
};
