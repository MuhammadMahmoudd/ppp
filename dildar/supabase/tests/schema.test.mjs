// Runs every migration against an in-process Postgres (PGlite) with a tiny
// stub of Supabase's auth schema, then checks RLS, pairing, streaks and the
// private match functions as real users would hit them.
//   npm run test:db
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, '..', 'migrations');

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c'; // outsider with own couple
const D = '00000000-0000-0000-0000-00000000000d'; // outsider trying to join

/** @type {PGlite} */
let db;

async function as(user, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user]);
  await db.exec('set role authenticated');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}
const rows = async (user, sql, params) => (await as(user, sql, params)).rows;
const one = async (user, sql, params) => (await rows(user, sql, params))[0];
async function rejects(promise, re) {
  await assert.rejects(promise, (e) => {
    if (re && !re.test(String(e.message))) throw new Error(`expected ${re}, got: ${e.message}`);
    return true;
  });
}

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    grant select on auth.users to authenticated;
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  `);
  for (const f of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(migrationsDir, f), 'utf8'));
  }
  for (const [id, name] of [[A, 'Ari'], [B, 'Bahar'], [C, 'Cey'], [D, 'Dara']]) {
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`,
      [id, `${name}@x.test`, { display_name: name }]);
  }
});

let coupleId;
let inviteCode;

test('pairing: A creates couple + invite, B redeems with 18+ confirmation', async () => {
  await rejects(as(A, `select public.create_couple(false)`), /adult_required/);
  coupleId = (await one(A, `select public.create_couple(true) as id`)).id;
  assert.ok(coupleId);
  // idempotent
  assert.equal((await one(A, `select public.create_couple(true) as id`)).id, coupleId);
  const inv = await one(A, `select * from public.create_invite()`);
  assert.match(inv.code, /^\d{6}$/);
  inviteCode = inv.code;
  await rejects(as(B, `select public.redeem_invite($1, false)`, [inviteCode]), /adult_required/);
  assert.equal((await one(B, `select public.redeem_invite('000000', true) as id`)).id, null);
  const joined = await one(B, `select public.redeem_invite($1, true) as id`, [inviteCode]);
  assert.equal(joined.id, coupleId);
  const cpl = await one(A, `select adult_confirmed_a, adult_confirmed_b from public.couples`);
  assert.deepEqual(cpl, { adult_confirmed_a: true, adult_confirmed_b: true });
});

test('pairing: the code is single-use and nobody else can ever join', async () => {
  assert.equal((await one(D, `select public.redeem_invite($1, true) as id`, [inviteCode])).id, null);
  await rejects(as(A, `select * from public.create_invite()`), /couple_full/);
  // direct inserts are blocked by RLS (no insert policy)
  await rejects(as(D, `insert into public.couple_members (couple_id, user_id, role) values ($1, $2, 'b')`, [coupleId, D]));
  // and even a superuser cannot add a third member: the trigger enforces it
  await rejects(db.query(`insert into public.couple_members (couple_id, user_id, role) values ($1, $2, 'a')`, [coupleId, D]),
    /couple_full|duplicate key/);
});

test('pairing: expired codes fail and attempts are rate limited', async () => {
  const cId = (await one(C, `select public.create_couple(true) as id`)).id;
  const inv = await one(C, `select * from public.create_invite()`);
  await db.query(`update public.invites set expires_at = now() - interval '1 second' where code = $1`, [inv.code]);
  assert.equal((await one(D, `select public.redeem_invite($1, true) as id`, [inv.code])).id, null);
  // D already used 2 attempts above (single-use + expired)
  for (let i = 0; i < 8; i++) assert.equal((await one(D, `select public.redeem_invite('999999', true) as id`)).id, null);
  await rejects(as(D, `select public.redeem_invite('999999', true)`), /too_many_attempts/);
  assert.ok(cId);
});

test('profiles: partner visible, outsider not; push tokens never shared', async () => {
  const seen = await rows(A, `select user_id from public.profiles order by user_id`);
  assert.deepEqual(seen.map((r) => r.user_id), [A, B]);
  assert.equal((await rows(C, `select * from public.profiles where user_id = $1`, [A])).length, 0);
  await as(B, `update public.devices set push_token = 'ExponentPushToken[b]'`);
  assert.equal((await rows(A, `select * from public.devices where user_id = $1`, [B])).length, 0);
  assert.equal((await rows(B, `select * from public.devices`)).length, 1);
  // cannot edit partner profile
  const r = await as(A, `update public.profiles set display_name = 'hacked' where user_id = $1`, [B]);
  assert.equal(r.affectedRows, 0);
});

test('messages: couple-only, sender must be self, seen + delete RPCs', async () => {
  const m1 = 'aaaaaaaa-0000-0000-0000-000000000001';
  await as(A, `insert into public.messages (id, couple_id, type, ciphertext, nonce) values ($1, $2, 'text', 'c', 'n')`, [m1, coupleId]);
  await rejects(as(B, `insert into public.messages (id, couple_id, sender_id, type) values (gen_random_uuid(), $1, $2, 'text')`, [coupleId, A]));
  await rejects(as(C, `insert into public.messages (id, couple_id, type) values (gen_random_uuid(), $1, 'text')`, [coupleId]));
  assert.equal((await rows(B, `select id from public.messages`)).length, 1);
  assert.equal((await rows(C, `select id from public.messages`)).length, 0);
  assert.equal((await one(B, `select public.mark_messages_seen() as n`)).n, 1);
  assert.ok((await one(A, `select seen_at from public.messages where id = $1`, [m1])).seen_at);
  await rejects(as(B, `select public.delete_message($1)`, [m1]), /not_allowed/);
  await as(A, `select public.delete_message($1)`, [m1]);
  const del = await one(B, `select ciphertext, deleted_at from public.messages where id = $1`, [m1]);
  assert.equal(del.ciphertext, null);
  assert.ok(del.deleted_at);
  // reactions
  await as(B, `insert into public.message_reactions (message_id, couple_id, emoji) values ($1, $2, '❤️')`, [m1, coupleId]);
  await rejects(as(C, `insert into public.message_reactions (message_id, couple_id, emoji) values ($1, $2, '❤️')`, [m1, coupleId]));
});

test('streaks: both must send in the home-time-zone day; gaps reset; freeze saves one day', async () => {
  const reg = (u, ts) => db.query(`select public.register_streak_activity($1, $2, $3)`, [coupleId, u, ts]);
  const streak = async () => (await db.query(`select streak_count, streak_last_day::text as d from public.couples where id = $1`, [coupleId])).rows[0];
  // Day 1 (Baghdad = UTC+3): A at 21:30 UTC (00:30 next day Baghdad!) and B at 23:00 UTC
  await reg(A, '2026-03-01T21:30:00Z');
  await reg(B, '2026-03-01T23:00:00Z');
  assert.deepEqual(await streak(), { streak_count: 1, d: '2026-03-02' });
  // same day again doesn't double count
  await reg(A, '2026-03-02T10:00:00Z');
  assert.equal((await streak()).streak_count, 1);
  // Day 2: only A at 20:59 UTC (23:59 Baghdad), B at 21:01 UTC is already day 3
  await reg(A, '2026-03-02T20:59:00Z');
  await reg(B, '2026-03-02T21:01:00Z');
  assert.equal((await streak()).streak_count, 1, 'not complete for 3/2 local date');
  // Day 3 local (2026-03-03) complete → B already sent at 21:01Z, A sends now
  await reg(A, '2026-03-03T08:00:00Z');
  assert.deepEqual(await streak(), { streak_count: 2, d: '2026-03-03' });
  // skip a day → restarts at 1
  await reg(A, '2026-03-05T08:00:00Z');
  await reg(B, '2026-03-05T09:00:00Z');
  assert.deepEqual(await streak(), { streak_count: 1, d: '2026-03-05' });
});

test('streaks: freeze works once a month when exactly yesterday was missed', async () => {
  await db.query(`update public.couples set streak_count = 9,
      streak_last_day = (now() at time zone home_timezone)::date - 2,
      streak_freezes_left = 1, streak_freeze_month = null where id = $1`, [coupleId]);
  assert.equal((await one(A, `select public.use_streak_freeze() as n`)).n, 9);
  const c = (await db.query(`select streak_count, streak_freezes_left,
      streak_last_day = (now() at time zone home_timezone)::date - 1 as ok from public.couples where id = $1`, [coupleId])).rows[0];
  assert.deepEqual(c, { streak_count: 9, streak_freezes_left: 0, ok: true });
  await db.query(`update public.couples set streak_last_day = (now() at time zone home_timezone)::date - 2 where id = $1`, [coupleId]);
  await rejects(as(B, `select public.use_streak_freeze()`), /no_freezes_left/);
});

test('spicy: locked until BOTH opt in; YNM answers private, only overlaps revealed', async () => {
  await as(A, `insert into public.ynm_answers (couple_id, item_key, answer) values ($1, 's:massage', 'yes')`, [coupleId]);
  await as(B, `insert into public.ynm_answers (couple_id, item_key, answer) values ($1, 's:massage', 'maybe')`, [coupleId]);
  await as(A, `insert into public.ynm_answers (couple_id, item_key, answer) values ($1, 's:blindfold', 'maybe')`, [coupleId]);
  await as(B, `insert into public.ynm_answers (couple_id, item_key, answer) values ($1, 's:blindfold', 'maybe')`, [coupleId]);
  await as(A, `insert into public.ynm_answers (couple_id, item_key, answer) values ($1, 's:roleplay', 'yes')`, [coupleId]);
  await as(B, `insert into public.ynm_answers (couple_id, item_key, answer) values ($1, 's:roleplay', 'no')`, [coupleId]);
  // partner can NEVER read raw answers
  assert.equal((await rows(A, `select * from public.ynm_answers where user_id = $1`, [B])).length, 0);
  // not active yet: only A opted in
  assert.equal((await one(A, `select public.set_spicy(true) as on`)).on, false);
  assert.equal((await rows(A, `select * from public.ynm_matches()`)).length, 0);
  assert.equal((await one(B, `select public.set_spicy(true) as on`)).on, true);
  const m = await rows(B, `select * from public.ynm_matches() order by item_key`);
  assert.deepEqual(m, [{ item_key: 's:massage', my_answer: 'maybe', partner_answer: 'yes' }]);
});

test('spicy: body map overlaps only; fantasies hidden until partner is interested', async () => {
  await as(A, `insert into public.body_map_answers (couple_id, side, area, intensity) values ($1, 'mine', 'neck', 3), ($1, 'mine', 'back', 2)`, [coupleId]);
  await as(B, `insert into public.body_map_answers (couple_id, side, area, intensity) values ($1, 'yours', 'neck', 2), ($1, 'mine', 'back', 3)`, [coupleId]);
  assert.equal((await rows(B, `select * from public.body_map_answers where user_id = $1`, [A])).length, 0);
  assert.deepEqual(await rows(A, `select * from public.body_map_matches()`), [{ area: 'neck', kind: 'on_me', intensity: 2 }]);

  await as(A, `insert into public.fantasies (couple_id, category, heat, text_ciphertext, nonce) values ($1, 'place', 3, 'secret', 'n')`, [coupleId]);
  assert.equal((await rows(B, `select * from public.fantasies`)).length, 0);
  let f = await one(B, `select * from public.list_fantasies()`);
  assert.equal(f.is_mine, false);
  assert.equal(f.text_ciphertext, null);
  await rejects(as(A, `select public.fantasy_interest($1, true)`, [f.id]), /not_allowed/);
  await as(B, `select public.fantasy_interest($1, true)`, [f.id]);
  f = await one(B, `select * from public.list_fantasies()`);
  assert.equal(f.text_ciphertext, 'secret');
});

test('decks: secret until shared; spicy games need both opted in', async () => {
  const deck = await one(A, `insert into public.decks (couple_id, kind, name_ciphertext, name_nonce) values ($1, 'dare', 'x', 'n') returning id`, [coupleId]);
  await as(A, `insert into public.cards (deck_id, couple_id, heat, text_ciphertext, nonce) values ($1, $2, 4, 'c', 'n')`, [deck.id, coupleId]);
  assert.equal((await rows(B, `select * from public.cards`)).length, 0);
  assert.equal((await rows(B, `select * from public.decks`)).length, 0);
  await rejects(as(B, `insert into public.cards (deck_id, couple_id, text_ciphertext, nonce) values ($1, $2, 'c', 'n')`, [deck.id, coupleId]), /deck_mismatch|row-level/);
  await as(A, `select public.set_deck_shared($1, true)`, [deck.id]);
  assert.equal((await rows(B, `select * from public.cards`)).length, 1);

  await as(B, `select public.set_spicy(false)`);
  await rejects(as(A, `insert into public.game_sessions (couple_id, game_type) values ($1, 'strip')`, [coupleId]), /spicy_locked/);
  // level-4 cards also hide from the partner while spicy is off
  assert.equal((await rows(B, `select * from public.cards`)).length, 0);
  await as(B, `select public.set_spicy(true)`);
  const g = await one(A, `insert into public.game_sessions (couple_id, game_type) values ($1, 'truth_dare') returning id, version`, [coupleId]);
  const g1 = await one(B, `select version from public.game_apply($1, 0, 'ct', 'n', null, 'active')`, [g.id]);
  assert.equal(g1.version, 1);
  await rejects(as(A, `select public.game_apply($1, 0, 'ct2', 'n')`, [g.id]), /version_conflict/);
  await rejects(as(C, `select public.game_apply($1, 1, 'x', 'n')`, [g.id]), /not_found/);
  await as(A, `select public.game_apply($1, 1, 'ct', 'n', null, 'finished')`, [g.id]);
  assert.equal((await one(A, `select game_streak from public.couples`)).game_streak, 1);
});

test('daily question: partner answer hidden until you answer', async () => {
  await as(A, `insert into public.daily_answers (couple_id, day, pool, question_idx, ciphertext, nonce) values ($1, '2026-04-01', 'sweet', 3, 'a', 'n')`, [coupleId]);
  assert.equal((await rows(B, `select * from public.daily_answers where user_id = $1`, [A])).length, 0);
  await as(B, `insert into public.daily_answers (couple_id, day, pool, question_idx, ciphertext, nonce) values ($1, '2026-04-01', 'sweet', 3, 'b', 'n')`, [coupleId]);
  assert.equal((await rows(B, `select * from public.daily_answers where user_id = $1`, [A])).length, 1);
  assert.equal((await one(A, `select question_streak from public.couples`)).question_streak, 1);
});

test('envelopes, locked plan, scheduled items stay hidden until their time', async () => {
  const e = await one(A, `insert into public.envelopes (couple_id, kind, title_ciphertext, title_nonce, unlock_at) values ($1, 'date', 't', 'n', now() + interval '1 day') returning id`, [coupleId]);
  await as(A, `insert into public.envelope_contents (envelope_id, couple_id, ciphertext, nonce) values ($1, $2, 'letter', 'n')`, [e.id, coupleId]);
  assert.equal((await rows(B, `select * from public.envelope_contents`)).length, 0);
  assert.equal((await rows(A, `select * from public.envelope_contents`)).length, 1);
  await rejects(as(B, `select public.open_envelope($1)`, [e.id]), /locked/);
  await db.query(`update public.envelopes set unlock_at = now() - interval '1 minute' where id = $1`, [e.id]);
  assert.equal((await rows(B, `select * from public.envelope_contents`)).length, 1);

  const cd = await one(A, `insert into public.countdowns (couple_id, target_at) values ($1, now() + interval '3 days') returning id`, [coupleId]);
  await as(A, `insert into public.plan_items (countdown_id, couple_id, ciphertext, nonce) values ($1, $2, 'plan', 'n')`, [cd.id, coupleId]);
  assert.equal((await rows(B, `select * from public.plan_items`)).length, 0);
  await db.query(`update public.countdowns set target_at = now() - interval '1 second' where id = $1`, [cd.id]);
  assert.equal((await rows(B, `select * from public.plan_items`)).length, 1);

  await as(A, `insert into public.scheduled_items (couple_id, payload_ciphertext, nonce, deliver_at) values ($1, 'surprise', 'n', now() - interval '1 second')`, [coupleId]);
  assert.equal((await rows(B, `select * from public.scheduled_items`)).length, 0);
  const delivered = (await db.query(`select * from public.deliver_due_items()`)).rows;
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].sender_id, A);
  assert.ok((await rows(B, `select * from public.messages where ciphertext = 'surprise'`)).length === 1);
  await rejects(as(A, `select * from public.deliver_due_items()`), /permission denied/);
});

test('vault: "both must agree" delete protection', async () => {
  const v = await one(A, `insert into public.vault_items (couple_id, kind, storage_path, nonce) values ($1, 'image', $2, 'n') returning id`, [coupleId, `${coupleId}/x`]);
  await as(A, `select public.update_couple_settings(p_vault_delete_protection => true)`);
  assert.equal((await one(A, `select public.vault_delete($1) as p`, [v.id])).p, null);
  assert.equal((await rows(B, `select * from public.vault_items`)).length, 1);
  const paths = (await one(B, `select public.vault_delete($1) as p`, [v.id])).p;
  assert.deepEqual(paths, [`${coupleId}/x`]);
  assert.equal((await rows(B, `select * from public.vault_items`)).length, 0);
  await rejects(as(A, `select public.update_couple_settings(p_home_timezone => 'Not/AZone')`));
});

test('internal functions are not callable by clients', async () => {
  await rejects(as(A, `select public.add_xp($1, 1000)`, [coupleId]), /permission denied/);
  await rejects(as(A, `select public.register_streak_activity($1, $2, now())`, [coupleId, A]), /permission denied/);
  await rejects(as(A, `select * from public.streak_warning_targets()`), /permission denied/);
  await rejects(as(A, `update public.couples set streak_count = 999`).then((r) => { if (r.affectedRows === 0) throw new Error('blocked'); }), /blocked|permission/);
});
