import { pbkdf2Sync, createHmac } from 'crypto';
import {
  generateKeyPair, deriveSharedKey, sealString, openString, sealBytes, openBytes, sealJSON, openJSON,
  tryOpenString, createKeyBackup, restoreKeyBackup, pbkdf2Sha512, hmacSha512, utf8Encode, toHex,
  commit, verifyCommit, safetyCode, seededIndex, secureRandomInt, publicKeyFromSecret, CryptoError,
} from '../lib/crypto';

describe('E2E crypto', () => {
  const alice = generateKeyPair();
  const bob = generateKeyPair();
  const kA = deriveSharedKey(bob.publicKey, alice.secretKey);
  const kB = deriveSharedKey(alice.publicKey, bob.secretKey);

  it('both partners derive the same shared key', () => {
    expect(toHex(kA)).toEqual(toHex(kB));
    expect(kA.length).toBe(32);
  });

  it('round-trips Kurdish text and emoji', () => {
    const msg = 'خۆشم دەوێیت ❤️‍🔥 ڕ ڵ ۆ ێ ە ھ ڤ ڎ';
    const s = sealString(msg, kA);
    expect(s.c).not.toContain('خۆشم');
    expect(openString(s.c, s.n, kB)).toBe(msg);
  });

  it('uses a fresh nonce every time', () => {
    const a = sealString('x', kA);
    const b = sealString('x', kA);
    expect(a.n).not.toBe(b.n);
    expect(a.c).not.toBe(b.c);
  });

  it('round-trips bytes and JSON', () => {
    const bytes = new Uint8Array(100_000).map((_, i) => i % 251);
    const { cipher, nonce } = sealBytes(bytes, kA);
    expect(Array.from(openBytes(cipher, nonce, kB).subarray(0, 10))).toEqual(Array.from(bytes.subarray(0, 10)));
    const j = sealJSON({ doodles: [[1, 2]], text: 'سڵاو' }, kA);
    expect(openJSON<{ text: string }>(j.c, j.n, kB).text).toBe('سڵاو');
  });

  it('rejects tampering and wrong keys', () => {
    const s = sealString('secret', kA);
    const eve = generateKeyPair();
    const kE = deriveSharedKey(alice.publicKey, eve.secretKey);
    expect(() => openString(s.c, s.n, kE)).toThrow(CryptoError);
    const tampered = (s.c[0] === 'A' ? 'B' : 'A') + s.c.slice(1);
    expect(tryOpenString(tampered, s.n, kB)).toBeNull();
    expect(tryOpenString(null, s.n, kB)).toBeNull();
  });

  it('recovers public key from secret', () => {
    expect(publicKeyFromSecret(alice.secretKey)).toBe(alice.publicKey);
  });
});

describe('PBKDF2-HMAC-SHA512 matches Node', () => {
  it('hmac matches', () => {
    const key = utf8Encode('key');
    const msg = utf8Encode('The quick brown fox jumps over the lazy dog');
    expect(toHex(hmacSha512(key, msg))).toBe(createHmac('sha512', 'key').update('The quick brown fox jumps over the lazy dog').digest('hex'));
    const longKey = new Uint8Array(200).fill(7);
    expect(toHex(hmacSha512(longKey, msg))).toBe(createHmac('sha512', Buffer.from(longKey)).update(Buffer.from(msg)).digest('hex'));
  });

  it.each([
    ['password', 'salt', 1, 64],
    ['password', 'salt', 2, 64],
    ['passwordPASSWORDpassword', 'saltSALTsaltSALTsaltSALTsaltSALTsalt', 50, 100],
    ['وشەی نهێنی', 'خوێ', 1000, 32],
  ])('%s / %s / %d iterations', (pw, salt, it, len) => {
    const ours = pbkdf2Sha512(utf8Encode(pw), utf8Encode(salt), it, len);
    const ref = pbkdf2Sync(Buffer.from(utf8Encode(pw)), Buffer.from(utf8Encode(salt)), it, len, 'sha512');
    expect(toHex(ours)).toBe(ref.toString('hex'));
  });
});

describe('key backup', () => {
  const kp = generateKeyPair();
  it('restores with the right passphrase only', () => {
    const b = createKeyBackup(kp.secretKey, 'هەمیشە پێکەوە 2026', 1000);
    expect(b.publicKey).toBe(kp.publicKey);
    expect(b.ciphertext).not.toContain(kp.secretKey);
    expect(restoreKeyBackup(b, 'هەمیشە پێکەوە 2026')).toEqual(kp);
    expect(() => restoreKeyBackup(b, 'wrong passphrase')).toThrow('wrong_passphrase');
  });
  it('requires a passphrase of 8+ chars', () => {
    expect(() => createKeyBackup(kp.secretKey, 'short', 10)).toThrow('passphrase_too_short');
  });
});

describe('game helpers', () => {
  it('commit/reveal', () => {
    const c = commit('option_a', 'salt1');
    expect(verifyCommit('option_a', 'salt1', c)).toBe(true);
    expect(verifyCommit('option_b', 'salt1', c)).toBe(false);
  });
  it('safety code is symmetric', () => {
    const a = generateKeyPair().publicKey;
    const b = generateKeyPair().publicKey;
    expect(safetyCode(a, b)).toBe(safetyCode(b, a));
    expect(safetyCode(a, b)).toMatch(/^(\d{5} ){5}\d{5}$/);
  });
  it('seeded index is stable and in range', () => {
    expect(seededIndex('couple|2026-01-01', 50)).toBe(seededIndex('couple|2026-01-01', 50));
    for (let i = 0; i < 200; i++) expect(seededIndex(`s${i}`, 7)).toBeLessThan(7);
  });
  it('secure random ints are uniform-ish', () => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 6000; i++) counts[secureRandomInt(6)]++;
    for (const c of counts) expect(c).toBeGreaterThan(800);
  });
});
