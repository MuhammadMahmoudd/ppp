/** Imported first in app/_layout.tsx. */
import * as ExpoCrypto from 'expo-crypto';
import { installPRNG } from './crypto';

// expo-crypto caps a single call at 1024 bytes, so chunk larger requests.
installPRNG((n) => {
  const out = new Uint8Array(n);
  for (let off = 0; off < n; off += 1024) {
    out.set(ExpoCrypto.getRandomBytes(Math.min(1024, n - off)), off);
  }
  return out;
});
