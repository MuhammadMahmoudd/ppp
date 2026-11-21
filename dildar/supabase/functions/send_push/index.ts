// POST { kind, data? } with the user's JWT → discreet push to their partner.
import { callerId, json, membership } from '../_shared/admin.ts';
import { pushToUser, type PushKind } from '../_shared/push.ts';

const ALLOWED: PushKind[] = [
  'message', 'snap', 'game_invite', 'touch', 'miss_you', 'tonight',
  'screenshot', 'dare', 'envelope', 'daily_question', 'vault', 'reaction',
];

// Per-instance throttle so a touch-tap frenzy can't spam the lock screen.
const last = new Map<string, number>();

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const uid = await callerId(req);
  if (!uid) return json({ error: 'unauthorized' }, 401);
  const { kind, data } = (await req.json().catch(() => ({}))) as { kind?: PushKind; data?: Record<string, unknown> };
  if (!kind || !ALLOWED.includes(kind)) return json({ error: 'bad_kind' }, 400);

  const m = await membership(uid);
  if (!m?.partner_id) return json({ error: 'not_paired' }, 400);

  const key = `${uid}:${kind}`;
  const now = Date.now();
  const gap = kind === 'touch' || kind === 'miss_you' || kind === 'reaction' ? 20_000 : 2_000;
  if (now - (last.get(key) ?? 0) < gap) return json({ ok: true, throttled: true });
  last.set(key, now);

  // Only a route string is forwarded — never content.
  const route = typeof data?.route === 'string' && data.route.startsWith('/') ? data.route.slice(0, 120) : undefined;
  const sent = await pushToUser(m.partner_id, kind, route ? { route } : {});
  return json({ ok: true, sent });
});
