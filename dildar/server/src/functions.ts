/** POST /api/functions/:name — the two endpoints the app invokes directly. */
import type { Env } from './env';
import type { Ctx } from './context';
import { HttpError, nowIso } from './util';
import { pushToUser, type PushKind } from './push';
import { notify } from './logic';

const ALLOWED: PushKind[] = [
  'message', 'snap', 'game_invite', 'touch', 'miss_you', 'tonight',
  'screenshot', 'dare', 'envelope', 'daily_question', 'vault', 'reaction',
];
const lastPush = new Map<string, number>();

async function send_push(env: Env, ctx: Ctx, body: Record<string, unknown>) {
  const kind = body.kind as PushKind;
  if (!ALLOWED.includes(kind)) throw new HttpError(400, 'bad_kind');
  if (!ctx.partnerId) throw new HttpError(400, 'not_paired');
  const key = `${ctx.uid}:${kind}`;
  const gap = kind === 'touch' || kind === 'miss_you' || kind === 'reaction' ? 20_000 : 2_000;
  if (Date.now() - (lastPush.get(key) ?? 0) < gap) return { ok: true, throttled: true };
  lastPush.set(key, Date.now());
  const data = body.data as Record<string, unknown> | undefined;
  const route = typeof data?.route === 'string' && data.route.startsWith('/') ? data.route.slice(0, 120) : undefined;
  return { ok: true, sent: await pushToUser(env, ctx.partnerId, kind, route ? { route } : {}) };
}

/** Receiver calls this after decrypting a snap: mark opened, delete ciphertext (view-once). */
async function snap_opened(env: Env, ctx: Ctx, body: Record<string, unknown>) {
  const id = typeof body.snap_id === 'string' ? body.snap_id : '';
  const snap = await env.DB.prepare('SELECT * FROM snaps WHERE id = ? AND couple_id = ?').bind(id, ctx.coupleId).first<Record<string, unknown>>();
  if (!snap) throw new HttpError(404, 'not_found');
  if (snap.sender_id === ctx.uid) throw new HttpError(403, 'sender_cannot_open');
  let deleted = false;
  if (snap.view_once && snap.storage_path) {
    await env.MEDIA.delete(`snaps/${snap.storage_path}`);
    deleted = true;
  }
  await env.DB.prepare(
    `UPDATE snaps SET opened_at = coalesce(opened_at, ?),
       storage_path = CASE WHEN ? THEN NULL ELSE storage_path END,
       meta_ciphertext = CASE WHEN ? THEN NULL ELSE meta_ciphertext END,
       meta_nonce = CASE WHEN ? THEN NULL ELSE meta_nonce END
     WHERE id = ?`,
  ).bind(nowIso(), deleted ? 1 : 0, deleted ? 1 : 0, deleted ? 1 : 0, id).run();
  await notify(env, ctx.coupleId, [{ table: 'snaps', event: 'UPDATE', key: { id } }]);
  return { ok: true, deleted };
}

export async function runFunction(env: Env, ctx: Ctx, name: string, body: Record<string, unknown>): Promise<unknown> {
  if (name === 'send_push') return send_push(env, ctx, body);
  if (name === 'snap_opened') return snap_opened(env, ctx, body);
  throw new HttpError(404, 'unknown_function');
}
