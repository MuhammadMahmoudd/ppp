/**
 * Domain rules shared by the REST hooks, RPCs and cron jobs.
 * The time-zone and streak math is imported from the app (lib/time.ts) so the
 * phone and the server compute "today" identically.
 */
import type { Env } from './env';
import { addDays, dayKey } from '../../lib/time';
import type { Row } from './util';

export type ChangeEvent = { table: string; event: 'INSERT' | 'UPDATE' | 'DELETE'; key: Row };

/** Pushes change notices to both phones through the couple's Durable Object. */
export async function notify(env: Env, coupleId: string | null, events: ChangeEvent[]): Promise<void> {
  if (!coupleId || !events.length) return;
  try {
    const stub = env.ROOMS.get(env.ROOMS.idFromName(coupleId));
    await stub.fetch('https://room/notify', { method: 'POST', body: JSON.stringify(events) });
  } catch (e) {
    console.error('notify failed', e);
  }
}

export async function addXp(env: Env, coupleId: string, amount: number): Promise<void> {
  await env.DB.prepare('UPDATE couples SET couple_xp = couple_xp + ? WHERE id = ?').bind(amount, coupleId).run();
}

type CoupleStreak = {
  id: string; home_timezone: string; streak_count: number; streak_best: number; streak_last_day: string | null;
  streak_freezes_left: number; streak_freeze_month: string | null;
  question_streak: number; question_last_day: string | null; game_streak: number; game_last_day: string | null;
};

async function getCouple(env: Env, id: string): Promise<CoupleStreak> {
  const c = await env.DB.prepare('SELECT * FROM couples WHERE id = ?').bind(id).first<CoupleStreak>();
  if (!c) throw new Error('no_couple');
  return c;
}

/**
 * A day counts when both partners sent ≥1 snap that day in the couple's
 * home time zone. Mirrors lib/streak.ts computeStreak (unit-tested there).
 */
export async function registerStreakActivity(env: Env, coupleId: string, senderId: string, at: Date): Promise<ChangeEvent[]> {
  const cpl = await getCouple(env, coupleId);
  const m = await env.DB.prepare('SELECT role FROM couple_members WHERE couple_id = ? AND user_id = ?').bind(coupleId, senderId).first<{ role: 'a' | 'b' }>();
  if (!m) return [];
  const d = dayKey(at, cpl.home_timezone);
  await env.DB.prepare(
    `INSERT INTO streak_days (couple_id, day, a_sent, b_sent) VALUES (?, ?, ?, ?)
     ON CONFLICT (couple_id, day) DO UPDATE SET a_sent = a_sent OR excluded.a_sent, b_sent = b_sent OR excluded.b_sent`,
  ).bind(coupleId, d, m.role === 'a' ? 1 : 0, m.role === 'b' ? 1 : 0).run();
  const sd = await env.DB.prepare('SELECT * FROM streak_days WHERE couple_id = ? AND day = ?').bind(coupleId, d)
    .first<{ a_sent: number; b_sent: number; completed: number }>();
  const events: ChangeEvent[] = [{ table: 'streak_days', event: 'UPDATE', key: { couple_id: coupleId, day: d } }];
  if (sd && sd.a_sent && sd.b_sent && !sd.completed) {
    let count: number;
    if (cpl.streak_last_day === addDays(d, -1)) count = cpl.streak_count + 1;
    else if (cpl.streak_last_day === d) count = cpl.streak_count;
    else count = 1;
    await env.DB.batch([
      env.DB.prepare('UPDATE streak_days SET completed = 1 WHERE couple_id = ? AND day = ?').bind(coupleId, d),
      env.DB.prepare('UPDATE couples SET streak_count = ?, streak_best = max(streak_best, ?), streak_last_day = ?, couple_xp = couple_xp + 5 WHERE id = ?')
        .bind(count, count, d, coupleId),
    ]);
    events.push({ table: 'couples', event: 'UPDATE', key: { id: coupleId } });
  }
  return events;
}

/** One freeze per calendar month (home tz); saves a streak whose only gap is yesterday. */
export async function useStreakFreeze(env: Env, coupleId: string, now = new Date()): Promise<number> {
  const cpl = await getCouple(env, coupleId);
  const today = dayKey(now, cpl.home_timezone);
  const month = today.slice(0, 7);
  const left = cpl.streak_freeze_month === month ? cpl.streak_freezes_left : 1;
  if (left <= 0) throw new Error('no_freezes_left');
  if (cpl.streak_count <= 0 || cpl.streak_last_day !== addDays(today, -2)) throw new Error('nothing_to_freeze');
  const y = addDays(today, -1);
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO streak_days (couple_id, day, completed, frozen) VALUES (?, ?, 1, 1)
       ON CONFLICT (couple_id, day) DO UPDATE SET completed = 1, frozen = 1`,
    ).bind(coupleId, y),
    env.DB.prepare('UPDATE couples SET streak_last_day = ?, streak_freezes_left = ?, streak_freeze_month = ? WHERE id = ?').bind(y, left - 1, month, coupleId),
  ]);
  return cpl.streak_count;
}

export async function registerGamePlayed(env: Env, coupleId: string): Promise<void> {
  const cpl = await getCouple(env, coupleId);
  const d = dayKey(new Date(), cpl.home_timezone);
  const streak = cpl.game_last_day === d ? cpl.game_streak : cpl.game_last_day === addDays(d, -1) ? cpl.game_streak + 1 : 1;
  await env.DB.prepare('UPDATE couples SET game_streak = ?, game_last_day = ?, couple_xp = couple_xp + 10 WHERE id = ?').bind(streak, d, coupleId).run();
}

export async function registerDailyAnswer(env: Env, coupleId: string, day: string, pool: string): Promise<boolean> {
  const n = await env.DB.prepare('SELECT count(*) AS n FROM daily_answers WHERE couple_id = ? AND day = ? AND pool = ?').bind(coupleId, day, pool).first<{ n: number }>();
  if ((n?.n ?? 0) < 2) return false;
  const cpl = await getCouple(env, coupleId);
  if (cpl.question_last_day === day) return false;
  const streak = cpl.question_last_day === addDays(day, -1) ? cpl.question_streak + 1 : 1;
  await env.DB.prepare('UPDATE couples SET question_streak = ?, question_last_day = ?, couple_xp = couple_xp + 5 WHERE id = ?').bind(streak, day, coupleId).run();
  return true;
}

/** Spicy is active only when both opted in and both confirmed 18+. */
export function spicyOf(c: Row | null): boolean {
  return !!c && !!(c.spicy_enabled_a && c.spicy_enabled_b && c.adult_confirmed_a && c.adult_confirmed_b);
}
