/**
 * Server functions (POST /api/rpc/:name). Same names and arguments the app
 * already calls; each checks the caller's couple itself.
 */
import type { Env } from './env';
import { loadCtx, needCouple, type Ctx } from './context';
import { HttpError, addMs, nowIso, uuid, type Row } from './util';
import { TABLES } from './tables';
import { decode } from './db';
import { notify, registerGamePlayed, spicyOf, useStreakFreeze, type ChangeEvent } from './logic';
import { isValidTimeZone } from '../../lib/time';

type Args = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : '');

function randomCode6(): string {
  const u = new Uint32Array(1);
  crypto.getRandomValues(u);
  return String(u[0] % 1_000_000).padStart(6, '0');
}

async function couple(env: Env, id: string): Promise<Row> {
  const c = await env.DB.prepare('SELECT * FROM couples WHERE id = ?').bind(id).first<Row>();
  if (!c) throw new HttpError(404, 'no_couple');
  return c;
}

// ─── pairing ───────────────────────────────────────────────────────────────
async function create_couple(env: Env, ctx: Ctx, a: Args) {
  if (a.adult_confirmed !== true) throw new HttpError(400, 'adult_required');
  if (ctx.coupleId) return ctx.coupleId;
  const id = uuid();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO couples (id, adult_confirmed_a) VALUES (?, 1)').bind(id),
    env.DB.prepare("INSERT INTO couple_members (couple_id, user_id, role) VALUES (?, ?, 'a')").bind(id, ctx.uid),
  ]);
  return id;
}

async function create_invite(env: Env, ctx: Ctx) {
  const c = needCouple(ctx);
  if (ctx.paired) throw new HttpError(409, 'couple_full');
  const now = nowIso();
  await env.DB.prepare('UPDATE invites SET used_at = ? WHERE couple_id = ? AND used_at IS NULL').bind(now, c).run();
  for (let i = 0; i < 10; i++) {
    const code = randomCode6();
    const expires = addMs(15 * 60_000);
    try {
      await env.DB.prepare('INSERT INTO invites (id, code, couple_id, created_by, expires_at) VALUES (?, ?, ?, ?, ?)')
        .bind(uuid(), code, c, ctx.uid, expires).run();
      return [{ code, expires_at: expires }];
    } catch {
      // code collision with another active invite: try again
    }
  }
  throw new HttpError(500, 'code_failed');
}

/** Max 10 tries/hour/user. A wrong code returns null (attempt is recorded). */
async function redeem_invite(env: Env, ctx: Ctx, a: Args) {
  if (a.adult_confirmed !== true) throw new HttpError(400, 'adult_required');
  if (ctx.coupleId) throw new HttpError(409, 'already_in_couple');
  const since = new Date(Date.now() - 3600_000).toISOString();
  const n = await env.DB.prepare('SELECT count(*) AS n FROM invite_attempts WHERE user_id = ? AND at > ?').bind(ctx.uid, since).first<{ n: number }>();
  if ((n?.n ?? 0) >= 10) throw new HttpError(429, 'too_many_attempts');
  await env.DB.prepare('INSERT INTO invite_attempts (user_id) VALUES (?)').bind(ctx.uid).run();
  const inv = await env.DB.prepare('SELECT * FROM invites WHERE code = ? AND used_at IS NULL AND expires_at > ?')
    .bind(str(a.invite_code), nowIso()).first<{ id: string; couple_id: string }>();
  if (!inv) return null;
  const now = nowIso();
  // The member insert is checked by the couple_members_max_two trigger, so
  // even a race between two redeemers can never produce a third member.
  await env.DB.batch([
    env.DB.prepare('UPDATE invites SET used_at = ?, used_by = ? WHERE id = ? AND used_at IS NULL').bind(now, ctx.uid, inv.id),
    env.DB.prepare("INSERT INTO couple_members (couple_id, user_id, role) VALUES (?, ?, 'b')").bind(inv.couple_id, ctx.uid),
    env.DB.prepare('UPDATE couples SET adult_confirmed_b = 1 WHERE id = ?').bind(inv.couple_id),
    env.DB.prepare('UPDATE invites SET used_at = ? WHERE couple_id = ? AND used_at IS NULL').bind(now, inv.couple_id),
  ]);
  await notify(env, inv.couple_id, [
    { table: 'couple_members', event: 'INSERT', key: { couple_id: inv.couple_id, user_id: ctx.uid } },
    { table: 'couples', event: 'UPDATE', key: { id: inv.couple_id } },
  ]);
  return inv.couple_id;
}

async function set_spicy(env: Env, ctx: Ctx, a: Args) {
  const c = needCouple(ctx);
  const col = ctx.role === 'a' ? 'spicy_enabled_a' : 'spicy_enabled_b';
  await env.DB.prepare(`UPDATE couples SET ${col} = ? WHERE id = ?`).bind(a.enabled ? 1 : 0, c).run();
  await notify(env, c, [{ table: 'couples', event: 'UPDATE', key: { id: c } }]);
  return spicyOf(await couple(env, c));
}

async function update_couple_settings(env: Env, ctx: Ctx, a: Args) {
  const c = needCouple(ctx);
  const sets: string[] = [];
  const args: unknown[] = [];
  if (a.p_home_timezone != null) {
    if (!isValidTimeZone(str(a.p_home_timezone))) throw new HttpError(400, 'invalid_timezone');
    sets.push('home_timezone = ?');
    args.push(str(a.p_home_timezone));
  }
  if (a.p_anniversary != null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str(a.p_anniversary))) throw new HttpError(400, 'invalid_date');
    sets.push('anniversary = ?');
    args.push(str(a.p_anniversary));
  }
  if (a.p_chat_disappear_mode != null) {
    if (!['off', 'view', '24h'].includes(str(a.p_chat_disappear_mode))) throw new HttpError(400, 'invalid');
    sets.push('chat_disappear_mode = ?');
    args.push(str(a.p_chat_disappear_mode));
  }
  if (a.p_vault_delete_protection != null) {
    sets.push('vault_delete_protection = ?');
    args.push(a.p_vault_delete_protection ? 1 : 0);
  }
  if (sets.length) {
    await env.DB.prepare(`UPDATE couples SET ${sets.join(', ')} WHERE id = ?`).bind(...args, c).run();
    await notify(env, c, [{ table: 'couples', event: 'UPDATE', key: { id: c } }]);
  }
  return null;
}

// ─── chat ──────────────────────────────────────────────────────────────────
async function mark_messages_seen(env: Env, ctx: Ctx) {
  const c = needCouple(ctx);
  const now = nowIso();
  const viewExpiry = addMs(60_000);
  const rows = await env.DB.prepare('SELECT id FROM messages WHERE couple_id = ? AND sender_id <> ? AND seen_at IS NULL AND deleted_at IS NULL')
    .bind(c, ctx.uid).all<{ id: string }>();
  const ids = (rows.results ?? []).map((r) => r.id);
  if (!ids.length) return 0;
  await env.DB.prepare(
    `UPDATE messages SET seen_at = ?, expires_at = CASE WHEN disappear_mode = 'view' THEN ? ELSE expires_at END
     WHERE couple_id = ? AND sender_id <> ? AND seen_at IS NULL AND deleted_at IS NULL`,
  ).bind(now, viewExpiry, c, ctx.uid).run();
  await notify(env, c, ids.map((id) => ({ table: 'messages', event: 'UPDATE' as const, key: { id } })));
  return ids.length;
}

async function delete_message(env: Env, ctx: Ctx, a: Args) {
  const c = needCouple(ctx);
  const m = await env.DB.prepare('SELECT media_path FROM messages WHERE id = ? AND sender_id = ? AND couple_id = ? AND deleted_at IS NULL')
    .bind(str(a.message_id), ctx.uid, c).first<{ media_path: string | null }>();
  if (!m) throw new HttpError(403, 'not_allowed');
  await env.DB.prepare('UPDATE messages SET deleted_at = ?, ciphertext = NULL, nonce = NULL, media_path = NULL WHERE id = ?')
    .bind(nowIso(), str(a.message_id)).run();
  await notify(env, c, [{ table: 'messages', event: 'UPDATE', key: { id: str(a.message_id) } }]);
  return m.media_path; // client deletes the (now orphaned) storage object
}

async function patchMeta(env: Env, ctx: Ctx, id: string, type: string, patch: Row) {
  const c = needCouple(ctx);
  const m = await env.DB.prepare('SELECT meta FROM messages WHERE id = ? AND type = ? AND couple_id = ? AND sender_id <> ?')
    .bind(id, type, c, ctx.uid).first<{ meta: string }>();
  if (!m) throw new HttpError(403, 'not_allowed');
  const meta = { ...(JSON.parse(m.meta || '{}') as Row), ...patch };
  await env.DB.prepare('UPDATE messages SET meta = ? WHERE id = ?').bind(JSON.stringify(meta), id).run();
  await notify(env, c, [{ table: 'messages', event: 'UPDATE', key: { id } }]);
}

async function complete_dare(env: Env, ctx: Ctx, a: Args) {
  await patchMeta(env, ctx, str(a.message_id), 'dare', { done_at: nowIso(), proof: a.proof_message_id ?? null });
  return null;
}

async function answer_signal(env: Env, ctx: Ctx, a: Args) {
  if (!['yes', 'no'].includes(str(a.answer))) throw new HttpError(400, 'bad_answer');
  await patchMeta(env, ctx, str(a.message_id), 'tonight', { answer: str(a.answer), answered_at: nowIso() });
  return null;
}

async function use_streak_freeze(env: Env, ctx: Ctx) {
  const c = needCouple(ctx);
  try {
    const n = await useStreakFreeze(env, c);
    await notify(env, c, [{ table: 'couples', event: 'UPDATE', key: { id: c } }]);
    return n;
  } catch (e) {
    const code = e instanceof Error ? e.message : 'invalid';
    throw new HttpError(400, code);
  }
}

// ─── decks & games ─────────────────────────────────────────────────────────
async function set_deck_shared(env: Env, ctx: Ctx, a: Args) {
  const c = needCouple(ctx);
  const shared = a.p_shared ? 1 : 0;
  const r = await env.DB.prepare('UPDATE decks SET is_shared = ? WHERE id = ? AND owner_id = ? AND couple_id = ?').bind(shared, str(a.p_deck), ctx.uid, c).run();
  if (!r.meta.changes) throw new HttpError(403, 'not_allowed');
  await env.DB.prepare('UPDATE cards SET is_shared = ? WHERE deck_id = ? AND owner_id = ?').bind(shared, str(a.p_deck), ctx.uid).run();
  await notify(env, c, [{ table: 'decks', event: 'UPDATE', key: { id: str(a.p_deck) } }, { table: 'cards', event: 'UPDATE', key: {} }]);
  return null;
}

/** Optimistic concurrency: the write wins only if p_expected_version matches. */
async function game_apply(env: Env, ctx: Ctx, a: Args) {
  const c = needCouple(ctx);
  const g = await env.DB.prepare('SELECT status FROM game_sessions WHERE id = ? AND couple_id = ?').bind(str(a.p_id), c).first<{ status: string }>();
  if (!g) throw new HttpError(404, 'not_found');
  const status = a.p_status == null ? null : str(a.p_status);
  if (status && !['invited', 'active', 'finished', 'cancelled'].includes(status)) throw new HttpError(400, 'invalid');
  const r = await env.DB.prepare(
    `UPDATE game_sessions SET state_ciphertext = ?, state_nonce = ?, version = version + 1,
       turn_user_id = coalesce(?, turn_user_id), status = coalesce(?, status), updated_at = ?
     WHERE id = ? AND couple_id = ? AND version = ?`,
  ).bind(str(a.p_state_ciphertext), str(a.p_state_nonce), a.p_turn_user_id ?? null, status, nowIso(), str(a.p_id), c, Number(a.p_expected_version)).run();
  if (!r.meta.changes) throw new HttpError(409, 'version_conflict');
  const row = await env.DB.prepare('SELECT * FROM game_sessions WHERE id = ?').bind(str(a.p_id)).first<Row>();
  if (row && row.status === 'finished' && g.status !== 'finished') await registerGamePlayed(env, c);
  await notify(env, c, [{ table: 'game_sessions', event: 'UPDATE', key: { id: str(a.p_id) } }]);
  return row ? decode(TABLES.game_sessions, row) : null;
}

// ─── spicy hub: the ONLY place private answers are compared ────────────────
export async function ynmMatches(env: Env, ctx: Ctx) {
  if (!ctx.coupleId || !ctx.partnerId || !ctx.spicy) return [];
  const r = await env.DB.prepare(
    `SELECT mine.item_key AS item_key, mine.answer AS my_answer, theirs.answer AS partner_answer
     FROM ynm_answers mine JOIN ynm_answers theirs
       ON theirs.item_key = mine.item_key AND theirs.couple_id = mine.couple_id AND theirs.user_id = ?
     WHERE mine.user_id = ? AND mine.couple_id = ?
       AND mine.answer IN ('yes','maybe') AND theirs.answer IN ('yes','maybe')
       AND (mine.answer = 'yes' OR theirs.answer = 'yes')`,
  ).bind(ctx.partnerId, ctx.uid, ctx.coupleId).all<{ item_key: string; my_answer: string; partner_answer: string }>();
  return r.results ?? [];
}

async function body_map_matches(env: Env, ctx: Ctx) {
  if (!ctx.coupleId || !ctx.partnerId || !ctx.spicy) return [];
  const r = await env.DB.prepare(
    `SELECT me.area AS area, CASE WHEN me.side = 'mine' THEN 'on_me' ELSE 'on_you' END AS kind,
            min(me.intensity, them.intensity) AS intensity
     FROM body_map_answers me JOIN body_map_answers them
       ON them.area = me.area AND them.user_id = ? AND them.couple_id = me.couple_id AND them.side <> me.side
     WHERE me.user_id = ? AND me.couple_id = ?`,
  ).bind(ctx.partnerId, ctx.uid, ctx.coupleId).all();
  return r.results ?? [];
}

async function list_fantasies(env: Env, ctx: Ctx) {
  if (!ctx.coupleId || !ctx.spicy) return [];
  const r = await env.DB.prepare('SELECT * FROM fantasies WHERE couple_id = ? ORDER BY created_at DESC').bind(ctx.coupleId).all<Row>();
  return (r.results ?? []).map((f) => {
    const mine = f.author_id === ctx.uid;
    const open = mine || !!f.partner_interested;
    return {
      id: f.id, is_mine: mine, category: f.category, heat: f.heat, revealed: !!f.partner_interested,
      text_ciphertext: open ? f.text_ciphertext : null, nonce: open ? f.nonce : null, created_at: f.created_at,
    };
  });
}

async function fantasy_interest(env: Env, ctx: Ctx, a: Args) {
  const c = needCouple(ctx);
  if (!ctx.spicy) throw new HttpError(403, 'not_allowed');
  const on = !!a.p_interested;
  const r = await env.DB.prepare('UPDATE fantasies SET partner_interested = ?, interested_at = ? WHERE id = ? AND couple_id = ? AND author_id <> ?')
    .bind(on ? 1 : 0, on ? nowIso() : null, str(a.p_id), c, ctx.uid).run();
  if (!r.meta.changes) throw new HttpError(403, 'not_allowed');
  return null;
}

// ─── vault ─────────────────────────────────────────────────────────────────
/** Returns paths to delete, or null while waiting for the partner's agreement. */
async function vault_delete(env: Env, ctx: Ctx, a: Args) {
  const c = needCouple(ctx);
  const it = await env.DB.prepare('SELECT * FROM vault_items WHERE id = ? AND couple_id = ?').bind(str(a.p_item), c).first<Row>();
  if (!it) throw new HttpError(404, 'not_found');
  const cpl = await couple(env, c);
  const events: ChangeEvent[] = [];
  if (cpl.vault_delete_protection) {
    const req = await env.DB.prepare('SELECT requested_by FROM vault_delete_requests WHERE item_id = ?').bind(it.id).first<{ requested_by: string }>();
    if (!req) {
      await env.DB.prepare('INSERT INTO vault_delete_requests (item_id, couple_id, requested_by) VALUES (?, ?, ?)').bind(it.id, c, ctx.uid).run();
      await notify(env, c, [{ table: 'vault_delete_requests', event: 'INSERT', key: { item_id: it.id } }]);
      return null;
    }
    if (req.requested_by === ctx.uid) return null;
  }
  await env.DB.prepare('DELETE FROM vault_items WHERE id = ?').bind(it.id).run();
  events.push({ table: 'vault_items', event: 'DELETE', key: { id: it.id } });
  await notify(env, c, events);
  return [it.storage_path, it.thumb_path].filter((p): p is string => typeof p === 'string');
}

// ─── closeness ─────────────────────────────────────────────────────────────
async function open_envelope(env: Env, ctx: Ctx, a: Args) {
  const c = needCouple(ctx);
  const r = await env.DB.prepare(
    `UPDATE envelopes SET opened_at = coalesce(opened_at, ?)
     WHERE id = ? AND couple_id = ? AND author_id <> ? AND (kind = 'when' OR unlock_at <= ?)`,
  ).bind(nowIso(), str(a.p_id), c, ctx.uid, nowIso()).run();
  if (!r.meta.changes) throw new HttpError(403, 'locked');
  await notify(env, c, [{ table: 'envelopes', event: 'UPDATE', key: { id: str(a.p_id) } }]);
  return null;
}

async function my_couple_id(_env: Env, ctx: Ctx) {
  return ctx.coupleId;
}
async function partner_id(_env: Env, ctx: Ctx) {
  return ctx.partnerId;
}

const RPCS: Record<string, (env: Env, ctx: Ctx, a: Args) => Promise<unknown>> = {
  create_couple, create_invite, redeem_invite, set_spicy, update_couple_settings,
  mark_messages_seen, delete_message, complete_dare, answer_signal, use_streak_freeze,
  set_deck_shared, game_apply,
  ynm_matches: (env, ctx) => ynmMatches(env, ctx),
  body_map_matches, list_fantasies, fantasy_interest, vault_delete, open_envelope,
  my_couple_id, partner_id,
};

export async function runRpc(env: Env, user: { id: string; email: string }, name: string, args: Args): Promise<unknown> {
  const fn = Object.prototype.hasOwnProperty.call(RPCS, name) ? RPCS[name] : undefined;
  if (!fn) throw new HttpError(404, 'unknown_function');
  return fn(env, await loadCtx(env, user), args ?? {});
}
