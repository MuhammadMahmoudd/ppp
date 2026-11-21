// Cron (hourly): ⏳ warning 4h before a streak would break (couple home tz),
// for whichever partner hasn't sent today's snap yet; then tidy broken streaks.
import { admin, isCron, json } from '../_shared/admin.ts';
import { pushToUser } from '../_shared/push.ts';

Deno.serve(async (req) => {
  if (!isCron(req)) return json({ error: 'unauthorized' }, 401);
  const { data } = await admin.rpc('streak_warning_targets');
  const targets = (data ?? []) as { couple_id: string; user_id: string }[];
  const couples = new Set<string>();
  for (const t of targets) {
    await pushToUser(t.user_id, 'streak_warning', { route: '/streak' });
    couples.add(t.couple_id);
  }
  for (const c of couples) await admin.rpc('mark_streak_warned', { c });
  const { data: reset } = await admin.rpc('reset_broken_streaks');
  return json({ ok: true, warned: targets.length, reset });
});
