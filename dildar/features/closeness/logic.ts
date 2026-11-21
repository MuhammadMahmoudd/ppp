/**
 * Pure helpers for the closeness feature (no React Native imports so they
 * can be unit-tested in Node): daily-question selection, receiver-time-zone
 * scheduling, day-bounded counters and countdown math.
 */
import { seededIndex } from '@/lib/crypto';
import { addDays, dayKey, splitDuration, zonedWallTimeToUtc } from '@/lib/time';

export type Pool = 'sweet' | 'spicy';

/** Same couple + same home-tz day + same pool ⇒ same question on both phones. */
export function dailyQuestionIndex(coupleId: string, day: string, pool: Pool, poolSize: number): number {
  return seededIndex(`${coupleId}|${day}|${pool}`, poolSize);
}

export function todayIn(tz: string, now: Date = new Date()): string {
  return dayKey(now, tz);
}

export type YMD = { year: number; month: number; day: number };
export type HM = { hour: number; minute: number };

/** Accepts YYYY-MM-DD (Latin or Kurdish digits). Rejects impossible dates. */
export function parseDate(input: string): YMD | null {
  const s = toLatinDigits(input.trim());
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** Accepts HH:MM (24h, Latin or Kurdish digits). */
export function parseTime(input: string): HM | null {
  const s = toLatinDigits(input.trim());
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export function toLatinDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

/** A wall-clock date + time typed for `tz` → the UTC instant (null if invalid). */
export function wallToUtc(dateStr: string, timeStr: string, tz: string): Date | null {
  const d = parseDate(dateStr);
  const t = parseTime(timeStr);
  if (!d || !t) return null;
  return zonedWallTimeToUtc({ ...d, ...t }, tz);
}

export type QuickSlot = { key: 'tonight' | 'morning' | 'tomorrowNight'; date: string; time: string; at: Date };

/** Handy presets expressed in the receiver's zone; past ones are dropped. */
export function quickSlots(tz: string, now: Date = new Date()): QuickSlot[] {
  const today = dayKey(now, tz);
  const tomorrow = addDays(today, 1);
  const out: QuickSlot[] = [];
  const add = (key: QuickSlot['key'], date: string, time: string) => {
    const at = wallToUtc(date, time, tz);
    if (at && at.getTime() > now.getTime() + 60_000) out.push({ key, date, time, at });
  };
  add('tonight', today, '21:00');
  add('morning', tomorrow, '08:00');
  add('tomorrowNight', tomorrow, '22:00');
  return out;
}

/** UTC instant of local midnight that starts `now`'s day in `tz`. */
export function dayStartUtc(now: Date, tz: string): Date {
  const [y, m, d] = dayKey(now, tz).split('-').map(Number);
  return zonedWallTimeToUtc({ year: y, month: m, day: d, hour: 0, minute: 0 }, tz);
}

/** Miss-you buzzes today (home tz), split by direction. */
export function countToday(
  events: { sender_id: string; created_at: string }[],
  me: string,
  tz: string,
  now: Date = new Date(),
): { mine: number; theirs: number } {
  const today = dayKey(now, tz);
  let mine = 0;
  let theirs = 0;
  for (const e of events) {
    if (dayKey(new Date(e.created_at), tz) !== today) continue;
    if (e.sender_id === me) mine++;
    else theirs++;
  }
  return { mine, theirs };
}

export type CountdownParts = { d: number; h: number; m: number; s: number; arrived: boolean; ms: number };

export function countdownParts(targetIso: string, now: number = Date.now()): CountdownParts {
  const ms = new Date(targetIso).getTime() - now;
  return { ...splitDuration(ms), arrived: ms <= 0, ms: Math.max(0, ms) };
}

/** Pick the countdown to show: the nearest future one, else the latest that ended < 2 days ago. */
export function pickCountdown<T extends { target_at: string }>(rows: T[], now: number = Date.now()): T | null {
  const future = rows.filter((r) => new Date(r.target_at).getTime() > now).sort((a, b) => a.target_at.localeCompare(b.target_at));
  if (future.length) return future[0];
  const recent = rows
    .filter((r) => now - new Date(r.target_at).getTime() < 2 * 86400_000)
    .sort((a, b) => b.target_at.localeCompare(a.target_at));
  return recent[0] ?? null;
}

/** Shared sleep heartbeat: both phones beat on the same wall-clock grid. */
export const SLEEP_PERIOD_MS = 1500;
export function msUntilNextBeat(now: number = Date.now(), period = SLEEP_PERIOD_MS): number {
  const r = now % period;
  return r === 0 ? 0 : period - r;
}
