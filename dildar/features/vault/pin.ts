/**
 * Vault PIN (4–6 digits), separate from Face ID. Stored as a salted
 * PBKDF2-SHA512 hash in the Keychain (this device only).
 */
import { secret } from '@/lib/secureStorage';
import { checkPin, lockoutSeconds, makePinRecord, parsePinRecord } from './pinHash';

const KEY = 'dildar.vault.pin.v1';
const FAIL_KEY = 'dildar.vault.pinfail.v1';

type Fails = { n: number; at: number };

async function readFails(): Promise<Fails> {
  try {
    const raw = await secret.get(FAIL_KEY);
    if (raw) return JSON.parse(raw) as Fails;
  } catch {
    // ignore
  }
  return { n: 0, at: 0 };
}

export async function hasVaultPin(): Promise<boolean> {
  return parsePinRecord(await secret.get(KEY)) !== null;
}

export async function setVaultPin(pin: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 30)); // let the UI paint before hashing
  await secret.set(KEY, JSON.stringify(makePinRecord(pin)));
  await secret.remove(FAIL_KEY);
}

export async function removeVaultPin(): Promise<void> {
  await secret.remove(KEY);
  await secret.remove(FAIL_KEY);
}

/** Seconds to wait before another attempt is allowed (0 = allowed now). */
export async function pinWaitSeconds(): Promise<number> {
  const f = await readFails();
  const wait = lockoutSeconds(f.n);
  if (!wait) return 0;
  return Math.max(0, Math.ceil((f.at + wait * 1000 - Date.now()) / 1000));
}

export type VerifyResult = { ok: true } | { ok: false; wait: number };

export async function verifyVaultPin(pin: string): Promise<VerifyResult> {
  const rec = parsePinRecord(await secret.get(KEY));
  if (!rec) return { ok: true };
  const wait = await pinWaitSeconds();
  if (wait > 0) return { ok: false, wait };
  await new Promise((r) => setTimeout(r, 30));
  if (checkPin(pin, rec)) {
    await secret.remove(FAIL_KEY);
    return { ok: true };
  }
  const f = await readFails();
  const next = { n: f.n + 1, at: Date.now() };
  await secret.set(FAIL_KEY, JSON.stringify(next));
  return { ok: false, wait: lockoutSeconds(next.n) };
}
