/** Pure PIN helpers (no native imports) — unit-tested. */
import { pbkdf2Sha512, toB64, fromB64, utf8Encode, randomBytes } from '@/lib/crypto';

export const PIN_ITERATIONS = 20_000;

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

export type PinRecord = { v: 1; salt: string; hash: string; iterations: number };

export function hashPin(pin: string, saltB64: string, iterations = PIN_ITERATIONS): string {
  return toB64(pbkdf2Sha512(utf8Encode(`dildar-vault|${pin}`), fromB64(saltB64), iterations, 32));
}

export function makePinRecord(pin: string, iterations = PIN_ITERATIONS): PinRecord {
  if (!isValidPin(pin)) throw new Error('invalid_pin');
  const salt = toB64(randomBytes(16));
  return { v: 1, salt, hash: hashPin(pin, salt, iterations), iterations };
}

/** Constant-time-ish comparison of two base64 strings. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkPin(pin: string, rec: PinRecord): boolean {
  if (!isValidPin(pin)) return false;
  return safeEqual(hashPin(pin, rec.salt, rec.iterations), rec.hash);
}

/** Lockout after repeated failures: 5 free tries, then 30s, 60s, 120s… (max 15 min). */
export function lockoutSeconds(failures: number): number {
  if (failures < 5) return 0;
  return Math.min(900, 30 * 2 ** (failures - 5));
}

export function parsePinRecord(raw: string | null): PinRecord | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as PinRecord;
    if (r && r.v === 1 && typeof r.salt === 'string' && typeof r.hash === 'string' && typeof r.iterations === 'number') return r;
  } catch {
    // corrupt
  }
  return null;
}
