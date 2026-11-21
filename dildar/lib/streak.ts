/**
 * Streak (زنجیرە) rules — the client mirror of
 * public.register_streak_activity / use_streak_freeze in SQL.
 * The database is the source of truth; this is used for display
 * (hours left, at-risk state, milestones) and is unit-tested.
 */
import { addDays, dayKey, daysBetween, msLeftInDay } from './time';

export const MILESTONES = [7, 30, 50, 100, 200, 365] as const;

export type SnapEvent = { role: 'a' | 'b'; at: Date };
export type StreakResult = { count: number; lastDay: string | null; best: number };

/** Replays snap events exactly like the SQL trigger does. */
export function computeStreak(events: SnapEvent[], homeTz: string, frozenDays: string[] = []): StreakResult {
  const days = new Map<string, { a: boolean; b: boolean; done: boolean }>();
  let count = 0;
  let best = 0;
  let lastDay: string | null = null;
  const frozen = new Set(frozenDays);
  const sorted = [...events].sort((x, y) => x.at.getTime() - y.at.getTime());
  for (const e of sorted) {
    const d = dayKey(e.at, homeTz);
    // a frozen day directly before d keeps the chain alive
    if (lastDay && frozen.has(addDays(d, -1)) && addDays(lastDay, 1) === addDays(d, -1)) {
      lastDay = addDays(d, -1);
    }
    const row = days.get(d) ?? { a: false, b: false, done: false };
    row[e.role] = true;
    days.set(d, row);
    if (row.a && row.b && !row.done) {
      row.done = true;
      if (lastDay === addDays(d, -1)) count += 1;
      else if (lastDay !== d) count = 1;
      lastDay = d;
      best = Math.max(best, count);
    }
  }
  return { count, lastDay, best };
}

export type StreakStatus =
  | { state: 'none'; count: 0 }
  | { state: 'done_today'; count: number }
  | { state: 'pending_today'; count: number; msLeft: number; atRisk: boolean }
  | { state: 'freezable'; count: number } // yesterday missed, freeze can save it
  | { state: 'broken'; count: 0; lost: number };

/** What the header should show right now. */
export function streakStatus(
  count: number,
  lastDay: string | null,
  homeTz: string,
  now: Date = new Date(),
  freezesLeft = 0,
): StreakStatus {
  if (!lastDay || count <= 0) return { state: 'none', count: 0 };
  const today = dayKey(now, homeTz);
  const gap = daysBetween(lastDay, today);
  if (gap <= 0) return { state: 'done_today', count };
  if (gap === 1) {
    const msLeft = msLeftInDay(now, homeTz);
    return { state: 'pending_today', count, msLeft, atRisk: msLeft <= 4 * 3600_000 };
  }
  if (gap === 2 && freezesLeft > 0) return { state: 'freezable', count };
  return { state: 'broken', count: 0, lost: count };
}

/** Milestone reached when the count moved from `prev` to `next`. */
export function crossedMilestone(prev: number, next: number): number | null {
  for (const m of MILESTONES) if (prev < m && next >= m) return m;
  return null;
}

/** Freezes reset each calendar month (home tz). */
export function freezesAvailable(left: number, freezeMonth: string | null, homeTz: string, now = new Date()): number {
  const month = dayKey(now, homeTz).slice(0, 7);
  return freezeMonth === month ? left : 1;
}

/** Couple Level (grows with activity). level n needs 25·n² xp. */
export function coupleLevel(xp: number): { level: number; progress: number; nextAt: number } {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 25)) + 1;
  const cur = 25 * (level - 1) ** 2;
  const next = 25 * level ** 2;
  return { level, progress: (xp - cur) / (next - cur), nextAt: next };
}
