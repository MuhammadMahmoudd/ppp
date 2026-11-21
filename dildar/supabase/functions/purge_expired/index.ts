// Cron (every 15 min): delete opened view-once snaps that weren't removed,
// unopened snaps older than 7 days, and expired disappearing chat media.
import { admin, isCron, json } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  if (!isCron(req)) return json({ error: 'unauthorized' }, 401);
  let snapsRemoved = 0;
  let mediaRemoved = 0;

  const { data: snaps } = await admin.rpc('expired_snap_paths');
  const rows = (snaps ?? []) as { id: string; storage_path: string }[];
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const { error } = await admin.storage.from('snaps').remove(batch.map((r) => r.storage_path));
    if (!error) {
      await admin.from('snaps').update({ storage_path: null }).in('id', batch.map((r) => r.id));
      snapsRemoved += batch.length;
    }
  }

  const { data: msgs } = await admin
    .from('messages')
    .select('id, media_path')
    .lte('expires_at', new Date().toISOString())
    .is('deleted_at', null)
    .not('media_path', 'is', null)
    .limit(500);
  const paths = (msgs ?? []).map((m) => m.media_path as string);
  if (paths.length) {
    const { error } = await admin.storage.from('chat-media').remove(paths);
    if (!error) mediaRemoved = paths.length;
  }

  const { data: fin } = await admin.rpc('finalize_purge');
  return json({ ok: true, snapsRemoved, mediaRemoved, finalized: fin });
});
