/**
 * End-to-end encryption helpers (tweetnacl).
 *
 * Model
 * ─────
 * • Each device owns a Curve25519 box keypair. Secret key → expo-secure-store,
 *   public key → profiles.public_key.
 * • The two partners derive the SAME 32-byte shared key with
 *   nacl.box.before(partnerPublic, mySecret). Everything (messages, snaps,
 *   vault, voice notes, cards…) is sealed with that key using
 *   XSalsa20-Poly1305 (nacl.secretbox), so both of us can read what either of
 *   us wrote, and the server only ever stores ciphertext + nonce.
 * • Key backup: the secret key is sealed with a key derived from a passphrase
 *   via PBKDF2-HMAC-SHA512 (implemented here on top of nacl.hash).
 */
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';

export const { encodeBase64: toB64, decodeBase64: fromB64, encodeUTF8: utf8Decode, decodeUTF8: utf8Encode } = util;

export type KeyPairB64 = { publicKey: string; secretKey: string };
export type Sealed = { c: string; n: string };

/** Install a CSPRNG (expo-crypto on device). Node/Jest already has one. */
export function installPRNG(getRandomBytes: (n: number) => Uint8Array): void {
  nacl.setPRNG((x, n) => {
    const r = getRandomBytes(n);
    for (let i = 0; i < n; i++) x[i] = r[i];
  });
}

export function randomBytes(n: number): Uint8Array {
  return nacl.randomBytes(n);
}

export function generateKeyPair(): KeyPairB64 {
  const kp = nacl.box.keyPair();
  return { publicKey: toB64(kp.publicKey), secretKey: toB64(kp.secretKey) };
}

export function publicKeyFromSecret(secretKeyB64: string): string {
  return toB64(nacl.box.keyPair.fromSecretKey(fromB64(secretKeyB64)).publicKey);
}

/** Symmetric key both partners can compute. */
export function deriveSharedKey(partnerPublicB64: string, mySecretB64: string): Uint8Array {
  return nacl.box.before(fromB64(partnerPublicB64), fromB64(mySecretB64));
}

// ─── bytes ──────────────────────────────────────────────────────────────────
export function sealBytes(plain: Uint8Array, key: Uint8Array): { cipher: Uint8Array; nonce: string } {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  return { cipher: nacl.secretbox(plain, nonce, key), nonce: toB64(nonce) };
}

export function openBytes(cipher: Uint8Array, nonceB64: string, key: Uint8Array): Uint8Array {
  const out = nacl.secretbox.open(cipher, fromB64(nonceB64), key);
  if (!out) throw new CryptoError('decrypt_failed');
  return out;
}

// ─── strings / JSON ─────────────────────────────────────────────────────────
export function sealString(text: string, key: Uint8Array): Sealed {
  const { cipher, nonce } = sealBytes(utf8Encode(text), key);
  return { c: toB64(cipher), n: nonce };
}

export function openString(c: string, n: string, key: Uint8Array): string {
  return utf8Decode(openBytes(fromB64(c), n, key));
}

export function sealJSON(value: unknown, key: Uint8Array): Sealed {
  return sealString(JSON.stringify(value), key);
}

export function openJSON<T>(c: string, n: string, key: Uint8Array): T {
  return JSON.parse(openString(c, n, key)) as T;
}

/** Safe variant for list rendering: returns null instead of throwing. */
export function tryOpenString(c: string | null | undefined, n: string | null | undefined, key: Uint8Array | null): string | null {
  if (!c || !n || !key) return null;
  try {
    return openString(c, n, key);
  } catch {
    return null;
  }
}

export function tryOpenJSON<T>(c: string | null | undefined, n: string | null | undefined, key: Uint8Array | null): T | null {
  const s = tryOpenString(c, n, key);
  if (s == null) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

// ─── hashing ────────────────────────────────────────────────────────────────
export function sha512(data: Uint8Array): Uint8Array {
  return nacl.hash(data);
}

export function toHex(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, '0');
  return s;
}

const BLOCK = 128; // SHA-512 block size

export function hmacSha512(key: Uint8Array, msg: Uint8Array): Uint8Array {
  let k = key.length > BLOCK ? sha512(key) : key;
  const padded = new Uint8Array(BLOCK);
  padded.set(k);
  k = padded;
  const ipad = new Uint8Array(BLOCK + msg.length);
  const opad = new Uint8Array(BLOCK + 64);
  for (let i = 0; i < BLOCK; i++) {
    ipad[i] = k[i] ^ 0x36;
    opad[i] = k[i] ^ 0x5c;
  }
  ipad.set(msg, BLOCK);
  opad.set(sha512(ipad), BLOCK);
  return sha512(opad);
}

/**
 * PBKDF2-HMAC-SHA512 (RFC 8018). The HMAC key pads are precomputed once, so
 * each iteration costs exactly two compressions-worth of nacl.hash calls.
 */
export function pbkdf2Sha512(password: Uint8Array, salt: Uint8Array, iterations: number, dkLen: number): Uint8Array {
  if (iterations < 1) throw new CryptoError('bad_iterations');
  let k = password.length > BLOCK ? sha512(password) : password;
  const padded = new Uint8Array(BLOCK);
  padded.set(k);
  k = padded;
  const iKey = new Uint8Array(BLOCK);
  const oKey = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) {
    iKey[i] = k[i] ^ 0x36;
    oKey[i] = k[i] ^ 0x5c;
  }
  const inner = new Uint8Array(BLOCK + 64);
  const outer = new Uint8Array(BLOCK + 64);
  inner.set(iKey);
  outer.set(oKey);
  const prf64 = (u: Uint8Array): Uint8Array => {
    inner.set(u, BLOCK);
    outer.set(sha512(inner), BLOCK);
    return sha512(outer);
  };

  const out = new Uint8Array(dkLen);
  const blocks = Math.ceil(dkLen / 64);
  for (let b = 1; b <= blocks; b++) {
    const first = new Uint8Array(BLOCK + salt.length + 4);
    first.set(iKey);
    first.set(salt, BLOCK);
    first.set([(b >>> 24) & 0xff, (b >>> 16) & 0xff, (b >>> 8) & 0xff, b & 0xff], BLOCK + salt.length);
    outer.set(sha512(first), BLOCK);
    let u = sha512(outer);
    const t = u.slice();
    for (let i = 1; i < iterations; i++) {
      u = prf64(u);
      for (let j = 0; j < 64; j++) t[j] ^= u[j];
    }
    out.set(t.subarray(0, Math.min(64, dkLen - (b - 1) * 64)), (b - 1) * 64);
  }
  return out;
}

// ─── key backup ─────────────────────────────────────────────────────────────
export const BACKUP_ITERATIONS = 120_000;

export type KeyBackup = { salt: string; nonce: string; ciphertext: string; iterations: number; publicKey: string };

export function createKeyBackup(secretKeyB64: string, passphrase: string, iterations = BACKUP_ITERATIONS): KeyBackup {
  if (passphrase.length < 8) throw new CryptoError('passphrase_too_short');
  const salt = nacl.randomBytes(16);
  const wrapKey = pbkdf2Sha512(utf8Encode(passphrase.normalize('NFKC')), salt, iterations, 32);
  const { cipher, nonce } = sealBytes(fromB64(secretKeyB64), wrapKey);
  return {
    salt: toB64(salt),
    nonce,
    ciphertext: toB64(cipher),
    iterations,
    publicKey: publicKeyFromSecret(secretKeyB64),
  };
}

export function restoreKeyBackup(b: Omit<KeyBackup, 'publicKey'>, passphrase: string): KeyPairB64 {
  const wrapKey = pbkdf2Sha512(utf8Encode(passphrase.normalize('NFKC')), fromB64(b.salt), b.iterations, 32);
  let secret: Uint8Array;
  try {
    secret = openBytes(fromB64(b.ciphertext), b.nonce, wrapKey);
  } catch {
    throw new CryptoError('wrong_passphrase');
  }
  const kp = nacl.box.keyPair.fromSecretKey(secret);
  return { publicKey: toB64(kp.publicKey), secretKey: toB64(kp.secretKey) };
}

// ─── commit/reveal (secret simultaneous picks in games) ─────────────────────
export function commit(value: string, saltB64: string): string {
  return toHex(sha512(utf8Encode(`${saltB64}|${value}`)));
}

export function verifyCommit(value: string, saltB64: string, commitment: string): boolean {
  return commit(value, saltB64) === commitment;
}

/** Short safety code both partners can compare on a call (like Signal). */
export function safetyCode(pubA: string, pubB: string): string {
  const [x, y] = [pubA, pubB].sort();
  const h = sha512(utf8Encode(`dildar-safety|${x}|${y}`));
  const groups: string[] = [];
  for (let i = 0; i < 6; i++) {
    const v = ((h[i * 3] << 16) | (h[i * 3 + 1] << 8) | h[i * 3 + 2]) % 100000;
    groups.push(v.toString().padStart(5, '0'));
  }
  return groups.join(' ');
}

/** Deterministic uniform int in [0, n) from a seed string (shared daily picks). */
export function seededIndex(seed: string, n: number): number {
  const h = sha512(utf8Encode(seed));
  const v = ((h[0] << 24) >>> 0) + (h[1] << 16) + (h[2] << 8) + h[3];
  return v % n;
}

/** Cryptographically random int in [0, n) — dice rolls, card draws. */
export function secureRandomInt(n: number): number {
  if (n <= 0) return 0;
  const limit = Math.floor(0x100000000 / n) * n;
  for (;;) {
    const b = nacl.randomBytes(4);
    const v = ((b[0] << 24) >>> 0) + (b[1] << 16) + (b[2] << 8) + b[3];
    if (v < limit) return v % n;
  }
}

export class CryptoError extends Error {
  constructor(public code: 'decrypt_failed' | 'wrong_passphrase' | 'passphrase_too_short' | 'bad_iterations' | 'no_key') {
    super(code);
    this.name = 'CryptoError';
  }
}
