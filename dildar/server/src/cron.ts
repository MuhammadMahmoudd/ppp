/**
 * Scheduled jobs (one Cron Trigger, every minute):
 *  • every minute  — deliver due "tease scheduler" items as chat messages
 *  • every 15 min  — purge opened/expired snaps and expired disappearing media
 *  • hourly (:07)  — ⏳ streak warnings 4h before midnight (home tz), reset broken streaks
 */
import type { Env } from './env';
import { addDays, dayKey, msLeftInDay } from '../../lib/time';
import { nowIso } from './util';
import { notify } from './logic';
import { pushToUser } from './push';

export async function deliverScheduled(env: Env): Promise<number> {
  const due = await env.DB.prepare('SELECT * FROM scheduled_items WHERE delivered_at IS NULL AND deliver_at <= ? ORDER BY deliver_at LIMIT 100')
    .bind(nowIso()).all<Record<string, string | null>>();
  let n = 0;
  for (const s of due.results ?? []) {
    const id = crypto.randomUUID();
    const claimed = await env.DB.prepare('UPDATE scheduled_items SET delivered_at = ? WHERE id = ? AND delivered_at IS NULL').bind(nowIso(), s.id).run();
    if (!claimed.meta.changes) continue;
    await env.DB.prepare(
      `INSERT INTO messages (id, couple_id, sender_id, type, ciphertext, nonce, media_path, media_nonce, meta, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{"scheduled":true}', ?)`,
    ).bind(id, s.couple_id, s.sender_id, s.message_type, s.payload_ciphertext, s.nonce, s.media_path, s.media_nonce, nowIso()).run();
    await notify(env, s.couple_id, [{ table: 'messages', event: 'INSERT', key: { id } }]);
    const other = await env.DB.prepare('SELECT user_id FROM couple_members WHERE couple_id = ? AND user_id <> ?').bind(s.couple_id, s.sender_id).first<{ user_id: string }>();
    if (other) await pushToUser(env, other.user_id, s.message_type === 'snap' ? 'snap' : 'message').catch(() => false);
    n++;
  }
  return n;
}

export async function purgeExpired(env: Env): Promise<{ snaps: number; messages: number }> {
  const now = nowIso();
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
  const snaps = await env.DB.prepare(
    `SELECT id, storage_path FROM snaps WHERE storage_path IS NOT NULL
       AND (expires_at <= ? OR (view_once = 1 AND opened_at IS NOT NULL AND opened_at < ?)) LIMIT 200`,
  ).bind(now, fiveMinAgo).all<{ id: string; storage_path: string }>();
  for (const s of snaps.results ?? []) {
    await env.MEDIA.delete(`snaps/${s.storage_path}`);
    await env.DB.prepare('UPDATE snaps SET storage_path = NULL, meta_ciphertext = NULL, meta_nonce = NULL WHERE id = ?').bind(s.id).run();
  }
  const msgs = await env.DB.prepare('SELECT id, couple_id, media_path FROM messages WHERE expires_at <= ? AND deleted_at IS NULL LIMIT 500')
    .bind(now).all<{ id: string; couple_id: string; media_path: string | null }>();
  for (const m of msgs.results ?? []) {
    if (m.media_path) await env.MEDIA.delete(`chat-media/${m.media_path}`);
    await env.DB.prepare('UPDATE messages SET ciphertext = NULL, nonce = NULL, media_path = NULL, deleted_at = ? WHERE id = ?').bind(now, m.id).run();
    await notify(env, m.couple_id, [{ table: 'messages', event: 'UPDATE', key: { id: m.id } }]);
  }
  await env.DB.prepare('DELETE FROM invite_attempts WHERE at < ?').bind(new Date(Date.now() - 86400_000).toISOString()).run();
  await env.DB.prepare('DELETE FROM login_attempts WHERE at < ?').bind(new Date(Date.now() - 86400_000).toISOString()).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  return { snaps: snaps.results?.length ?? 0, messages: msgs.results?.length ?? 0 };
}

export async function streakCheck(env: Env, now = new Date()): Promise<{ warned: number; reset: number }> {
  const couples = await env.DB.prepare('SELECT id, home_timezone, streak_count, streak_last_day, streak_warned_day FROM couples WHERE streak_count > 0')
    .all<{ id: string; home_timezone: string; streak_count: number; streak_last_day: string | null; streak_warned_day: string | null }>();
  let warned = 0;
  let reset = 0;
  for (const c of couples.results ?? []) {
    const today = dayKey(now, c.home_timezone);
    if (c.streak_last_day && c.streak_last_day < addDays(today, -2)) {
      await env.DB.prepare('UPDATE couples SET streak_count = 0 WHERE id = ?').bind(c.id).run();
      await notify(env, c.id, [{ table: 'couples', event: 'UPDATE', key: { id: c.id } }]);
      reset++;
      continue;
    }
    if (c.streak_last_day !== addDays(today, -1) || c.streak_warned_day === today) continue;
    if (msLeftInDay(now, c.home_timezone) > 4 * 3600_000) continue;
    const sd = await env.DB.prepare('SELECT a_sent, b_sent FROM streak_days WHERE couple_id = ? AND day = ?').bind(c.id, today).first<{ a_sent: number; b_sent: number }>();
    const members = await env.DB.prepare('SELECT user_id, role FROM couple_members WHERE couple_id = ?').bind(c.id).all<{ user_id: string; role: 'a' | 'b' }>();
    for (const m of members.results ?? []) {
      const sent = m.role === 'a' ? sd?.a_sent : sd?.b_sent;
      if (!sent) {
        await pushToUser(env, m.user_id, 'streak_warning', { route: '/streak' }).catch(() => false);
        warned++;
      }
    }
    await env.DB.prepare('UPDATE couples SET streak_warned_day = ? WHERE id = ?').bind(today, c.id).run();
  }
  return { warned, reset };
}

export async function runScheduled(env: Env, scheduledTime: number): Promise<void> {
  const d = new Date(scheduledTime);
  // each job runs independently: one failing never blocks the others
  const jobs: Promise<unknown>[] = [deliverScheduled(env)];
  if (d.getUTCMinutes() % 15 === 0) jobs.push(purgeExpired(env));
  if (d.getUTCMinutes() === 7) jobs.push(streakCheck(env, d));
  const results = await Promise.allSettled(jobs);
  for (const r of results) if (r.status === 'rejected') console.error('cron job failed', r.reason);
}
