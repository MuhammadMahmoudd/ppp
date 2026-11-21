// Cron (every minute): turns due scheduled_items into chat messages and
// pushes the receiver. Times were converted to the receiver's zone on-device.
import { admin, isCron, json } from '../_shared/admin.ts';
import { pushToUser } from '../_shared/push.ts';

Deno.serve(async (req) => {
  if (!isCron(req)) return json({ error: 'unauthorized' }, 401);
  const { data, error } = await admin.rpc('deliver_due_items');
  if (error) return json({ error: error.message }, 500);
  const delivered = (data ?? []) as { couple_id: string; sender_id: string; type: string }[];
  for (const m of delivered) {
    const { data: other } = await admin
      .from('couple_members').select('user_id').eq('couple_id', m.couple_id).neq('user_id', m.sender_id).maybeSingle();
    if (other) await pushToUser(other.user_id, m.type === 'snap' ? 'snap' : 'message');
  }
  return json({ ok: true, delivered: delivered.length });
});
