/**
 * Per-player secrets for commit/reveal (Would You Rather picks, role-play
 * goals). They never leave this phone until revealed; kept in SecureStore
 * so an app restart mid-round can still reveal.
 */
import { secret } from '@/lib/secureStorage';
import { randomBytes, toB64 } from '@/lib/crypto';

const k = (session: string, slot: string) => `dildar.game.${session}.${slot}`.replace(/[^A-Za-z0-9._-]/g, '_');

export async function saveSecret<T>(session: string, slot: string, value: T): Promise<void> {
  await secret.set(k(session, slot), JSON.stringify(value));
}

export async function loadSecret<T>(session: string, slot: string): Promise<T | null> {
  try {
    const raw = await secret.get(k(session, slot));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export const newSalt = () => toB64(randomBytes(16));
