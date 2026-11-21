// POST { snap_id } by the RECEIVER after the snap was decrypted on-device.
// Marks it opened and (view-once) deletes the ciphertext from Storage.
import { admin, callerId, json } from '../_shared/admin.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const uid = await callerId(req);
  if (!uid) return json({ error: 'unauthorized' }, 401);
  const { snap_id } = (await req.json().catch(() => ({}))) as { snap_id?: string };
  if (!snap_id) return json({ error: 'bad_request' }, 400);

  const { data: snap } = await admin.from('snaps').select('*').eq('id', snap_id).maybeSingle();
  if (!snap) return json({ error: 'not_found' }, 404);
  const { data: member } = await admin
    .from('couple_members').select('user_id').eq('couple_id', snap.couple_id).eq('user_id', uid).maybeSingle();
  if (!member) return json({ error: 'forbidden' }, 403);
  if (snap.sender_id === uid) return json({ error: 'sender_cannot_open' }, 403);

  const patch: Record<string, unknown> = {};
  if (!snap.opened_at) patch.opened_at = new Date().toISOString();
  if (snap.view_once && snap.storage_path) {
    const { error } = await admin.storage.from('snaps').remove([snap.storage_path]);
    if (!error) {
      patch.storage_path = null;
      patch.meta_ciphertext = null;
      patch.meta_nonce = null;
    }
    // if removal failed, purge_expired retries 5 minutes after opening
  }
  if (Object.keys(patch).length) await admin.from('snaps').update(patch).eq('id', snap_id);
  return json({ ok: true, deleted: patch.storage_path === null });
});
