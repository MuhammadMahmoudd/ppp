/**
 * Merge rules for the live game sync (pure, unit-tested).
 *  • broadcast (fast, ~100 ms, may be optimistic): apply only if newer
 *  • database row (authoritative): apply if same-or-newer, replacing an
 *    optimistic state the server may have rejected
 */
import type { GameStatus } from '@/lib/database.types';

export type Snapshot<S> = { version: number; state: S | null; status: GameStatus };
export type Source = 'broadcast' | 'db' | 'local';

export function shouldAccept(localVersion: number, incomingVersion: number, source: Source): boolean {
  if (source === 'db') return incomingVersion >= localVersion;
  return incomingVersion > localVersion;
}

export function merge<S>(local: Snapshot<S>, incoming: Snapshot<S>, source: Source): Snapshot<S> {
  return shouldAccept(local.version, incoming.version, source) ? incoming : local;
}

/** Retry backoff for version conflicts (ms). */
export function conflictDelay(attempt: number): number {
  return Math.min(600, 60 * 2 ** attempt);
}

export const MAX_APPLY_ATTEMPTS = 5;
