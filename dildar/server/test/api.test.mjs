// Runs the real Worker in workerd (Miniflare) with D1, R2 and the couple
// Durable Object, then exercises auth, pairing, access rules, streaks,
// private matching, storage, cron and live sync like two phones would.
//   npm run test:server
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
let mf;
let db;

/** Splits the migration into statements, keeping trigger bodies intact. */
function statements(sql) {
  const out = [];
  let buf = '';
  let depth = 0;
  for (const line of sql.split('\n')) {
    const clean = line.replace(/--.*$/, '');
    if (!clean.trim() && !buf.trim()) continue;
    buf += clean + '\n';
    if (/\bBEGIN\b/i.test(clean)) depth++;
    if (/\bEND;\s*$/i.test(clean)) depth--;
    if (depth === 0 && /;\s*$/.test(clean)) {
      out.push(buf.trim());
      buf = '';
    }
  }
  return out;
}

before(async () => {
  const outfile = join(root, '.build', 'worker.mjs');
  await build({ entryPoints: [join(root, 'src', 'index.ts')], bundle: true, format: 'esm', platform: 'neutral', target: 'es2022', outfile, logLevel: 'error', mainFields: ['module', 'main'] });
  mf = new Miniflare({
    modules: true,
    scriptPath: outfile,
    compatibilityDate: '2025-09-01',
    d1Databases: { DB: 'dildar-test' },
    r2Buckets: { MEDIA: 'media-test' },
    durableObjects: { ROOMS: 'CoupleRoom' },
    bindings: { MAX_USERS: '4' },
    unsafeTriggerHandlers: true,
  });
  db = await mf.getD1Database('DB');
  for (const s of statements(readFileSync(join(root, 'migrations', '0001_init.sql'), 'utf8'))) await db.prepare(s).run();
});

after(async () => {
  await mf?.dispose();
});

async function call(token, path, body, method = 'POST') {
  const res = await mf.dispatchFetch(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await res.json();
  return { status: res.status, ...j };
}
const rest = (t, table, q) => call(t, `/api/rest/${table}`, q);
const rpc = (t, name, args = {}) => call(t, `/api/rpc/${name}`, args);
const sel = async (t, table, filters = [], extra = {}) => (await rest(t, table, { op: 'select', filters, ...extra })).data;
const errCode = (r) => r.error?.code;

const U = {};
const email = (n) => `${n}@x.test`;

test('auth: sign-up, sign-in, wrong password, account cap', async () => {
  for (const n of ['ari', 'bahar', 'cey', 'dara']) {
    const r = await call(null, '/api/auth/signup', { email: email(n), password: 'correct horse 1' });
    assert.equal(r.status, 200, JSON.stringify(r));
    U[n] = { token: r.session.access_token, id: r.session.user.id };
  }
  assert.equal(errCode(await call(null, '/api/auth/signup', { email: 'eve@x.test', password: 'correct horse 1' })), 'signups_closed');
  assert.equal(errCode(await call(null, '/api/auth/signin', { email: email('ari'), password: 'nope nope' })), 'invalid_login');
  const ok = await call(null, '/api/auth/signin', { email: 'ARI@x.test', password: 'correct horse 1' });
  assert.equal(ok.session.user.id, U.ari.id);
  assert.equal((await call('garbage', '/api/rest/profiles', { op: 'select' })).status, 401);
  const prof = await sel(U.ari.token, 'profiles');
  assert.deepEqual(prof.map((p) => p.user_id), [U.ari.id]);
});

let coupleId;
let code;

test('pairing: 18+ required, single-use code, nobody else can join', async () => {
  assert.equal(errCode(await rpc(U.ari.token, 'create_couple', { adult_confirmed: false })), 'adult_required');
  coupleId = (await rpc(U.ari.token, 'create_couple', { adult_confirmed: true })).data;
  assert.ok(coupleId);
  assert.equal((await rpc(U.ari.token, 'create_couple', { adult_confirmed: true })).data, coupleId);
  code = (await rpc(U.ari.token, 'create_invite')).data[0].code;
  assert.match(code, /^\d{6}$/);
  assert.equal(errCode(await rpc(U.bahar.token, 'redeem_invite', { invite_code: code, adult_confirmed: false })), 'adult_required');
  assert.equal((await rpc(U.bahar.token, 'redeem_invite', { invite_code: '000000', adult_confirmed: true })).data, null);
  assert.equal((await rpc(U.bahar.token, 'redeem_invite', { invite_code: code, adult_confirmed: true })).data, coupleId);
  const c = (await sel(U.ari.token, 'couples'))[0];
  assert.equal(c.adult_confirmed_a, true);
  assert.equal(c.adult_confirmed_b, true);
  // used code, full couple, no direct inserts, DB trigger as last line of defence
  assert.equal((await rpc(U.dara.token, 'redeem_invite', { invite_code: code, adult_confirmed: true })).data, null);
  assert.equal(errCode(await rpc(U.ari.token, 'create_invite')), 'couple_full');
  assert.equal(errCode(await rest(U.dara.token, 'couple_members', { op: 'insert', rows: [{ couple_id: coupleId, user_id: U.dara.id, role: 'b' }] })), 'not_allowed');
  await assert.rejects(db.prepare("INSERT INTO couple_members (couple_id, user_id, role) VALUES (?, ?, 'a')").bind(coupleId, U.dara.id).run(), /couple_full|UNIQUE/);
});

test('pairing: expired codes fail, attempts are rate limited', async () => {
  await rpc(U.cey.token, 'create_couple', { adult_confirmed: true });
  const c = (await rpc(U.cey.token, 'create_invite')).data[0].code;
  await db.prepare("UPDATE invites SET expires_at = '2000-01-01T00:00:00.000Z' WHERE code = ?").bind(c).run();
  assert.equal((await rpc(U.dara.token, 'redeem_invite', { invite_code: c, adult_confirmed: true })).data, null);
  for (let i = 0; i < 8; i++) assert.equal((await rpc(U.dara.token, 'redeem_invite', { invite_code: '999999', adult_confirmed: true })).data, null);
  assert.equal(errCode(await rpc(U.dara.token, 'redeem_invite', { invite_code: '999999', adult_confirmed: true })), 'too_many_attempts');
});

test('profiles + devices: partner visible, outsider not, push tokens private', async () => {
  assert.deepEqual((await sel(U.ari.token, 'profiles')).map((p) => p.user_id).sort(), [U.ari.id, U.bahar.id].sort());
  assert.equal((await sel(U.cey.token, 'profiles', [['user_id', 'eq', U.ari.id]])).length, 0);
  await rest(U.bahar.token, 'devices', { op: 'upsert', rows: [{ user_id: U.bahar.id, push_token: 'ExponentPushToken[b]' }] });
  assert.equal((await sel(U.ari.token, 'devices', [['user_id', 'eq', U.bahar.id]])).length, 0);
  assert.equal((await sel(U.bahar.token, 'devices'))[0].push_token, 'ExponentPushToken[b]');
  const r = await rest(U.ari.token, 'profiles', { op: 'update', values: { display_name: 'hacked' }, filters: [['user_id', 'eq', U.bahar.id]], returning: true });
  assert.deepEqual(r.data, []);
  await rest(U.ari.token, 'profiles', { op: 'update', values: { display_name: 'Ari', public_key: 'pk-a' }, filters: [['user_id', 'eq', U.ari.id]] });
  assert.equal((await sel(U.bahar.token, 'profiles', [['user_id', 'eq', U.ari.id]]))[0].display_name, 'Ari');
  assert.equal(errCode(await rest(U.ari.token, 'nope_table', { op: 'select' })), 'unknown_table');
  assert.equal(errCode(await rest(U.ari.token, 'profiles', { op: 'select', filters: [['user_id; DROP TABLE users', 'eq', 1]] })), 'unknown_column');
});

const M1 = '11111111-1111-4111-8111-111111111111';
test('messages: couple-only, no spoofing, idempotent retries, seen + delete', async () => {
  const ins = await rest(U.ari.token, 'messages', { op: 'upsert', rows: [{ id: M1, couple_id: coupleId, type: 'text', ciphertext: 'c', nonce: 'n', meta: { a: 1 } }], onConflict: 'id', ignoreDuplicates: true });
  assert.equal(ins.status, 200, JSON.stringify(ins));
  await rest(U.ari.token, 'messages', { op: 'upsert', rows: [{ id: M1, couple_id: coupleId, type: 'text', ciphertext: 'c2', nonce: 'n' }], onConflict: 'id', ignoreDuplicates: true });
  const rows = await sel(U.bahar.token, 'messages');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ciphertext, 'c'); // retry ignored
  assert.deepEqual(rows[0].meta, { a: 1 });
  assert.equal(errCode(await rest(U.bahar.token, 'messages', { op: 'insert', rows: [{ couple_id: coupleId, sender_id: U.ari.id, type: 'text' }] })), 'not_allowed');
  assert.equal(errCode(await rest(U.cey.token, 'messages', { op: 'insert', rows: [{ couple_id: coupleId, type: 'text' }] })), 'not_allowed');
  assert.equal((await sel(U.cey.token, 'messages')).length, 0);
  assert.equal((await rpc(U.bahar.token, 'mark_messages_seen')).data, 1);
  assert.ok((await sel(U.ari.token, 'messages', [['id', 'eq', M1]]))[0].seen_at);
  assert.equal(errCode(await rpc(U.bahar.token, 'delete_message', { message_id: M1 })), 'not_allowed');
  await rest(U.bahar.token, 'message_reactions', { op: 'upsert', rows: [{ message_id: M1, couple_id: coupleId, emoji: '❤️' }], onConflict: 'message_id,user_id' });
  await rest(U.bahar.token, 'message_reactions', { op: 'upsert', rows: [{ message_id: M1, couple_id: coupleId, emoji: '😂' }], onConflict: 'message_id,user_id' });
  assert.deepEqual((await sel(U.ari.token, 'message_reactions')).map((r) => r.emoji), ['😂']);
  await rpc(U.ari.token, 'delete_message', { message_id: M1 });
  const del = (await sel(U.bahar.token, 'messages', [['id', 'eq', M1]]))[0];
  assert.equal(del.ciphertext, null);
  assert.ok(del.deleted_at);
});

test('snaps + streak: both sending today completes the day', async () => {
  for (const who of ['ari', 'bahar']) {
    const r = await rest(U[who].token, 'snaps', { op: 'insert', rows: [{ id: crypto.randomUUID(), couple_id: coupleId, nonce: 'n', media_kind: 'image', storage_path: `${coupleId}/x${who}xxxxxx` }] });
    assert.equal(r.status, 200, JSON.stringify(r));
  }
  const c = (await sel(U.ari.token, 'couples'))[0];
  assert.equal(c.streak_count, 1);
  const days = await sel(U.ari.token, 'streak_days');
  assert.equal(days.length, 1);
  assert.equal(days[0].a_sent && days[0].b_sent && days[0].completed, true);
});

test('streak freeze: once a month, only when exactly yesterday was missed', async () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad' }).format(new Date());
  const minus = (n) => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  await db.prepare('UPDATE couples SET streak_count = 9, streak_last_day = ?, streak_freezes_left = 1, streak_freeze_month = NULL WHERE id = ?').bind(minus(2), coupleId).run();
  assert.equal((await rpc(U.ari.token, 'use_streak_freeze')).data, 9);
  const c = (await sel(U.ari.token, 'couples'))[0];
  assert.equal(c.streak_last_day, minus(1));
  assert.equal(c.streak_freezes_left, 0);
  await db.prepare('UPDATE couples SET streak_last_day = ? WHERE id = ?').bind(minus(2), coupleId).run();
  assert.equal(errCode(await rpc(U.bahar.token, 'use_streak_freeze')), 'no_freezes_left');
});

test('spicy: locked until both opt in; YNM answers private; only overlaps', async () => {
  const ans = (who, key, answer) => rest(U[who].token, 'ynm_answers', { op: 'upsert', rows: [{ couple_id: coupleId, item_key: key, answer }], onConflict: 'user_id,item_key' });
  await ans('ari', 's:massage', 'yes'); await ans('bahar', 's:massage', 'maybe');
  await ans('ari', 's:blindfold', 'maybe'); await ans('bahar', 's:blindfold', 'maybe');
  await ans('ari', 's:roleplay', 'yes'); await ans('bahar', 's:roleplay', 'no');
  await ans('ari', 's:roleplay', 'yes'); // upsert again
  assert.equal((await sel(U.ari.token, 'ynm_answers', [['user_id', 'eq', U.bahar.id]])).length, 0);
  assert.equal((await rpc(U.ari.token, 'set_spicy', { enabled: true })).data, false);
  assert.deepEqual((await rpc(U.ari.token, 'ynm_matches')).data, []);
  assert.equal((await rpc(U.bahar.token, 'set_spicy', { enabled: true })).data, true);
  assert.deepEqual((await rpc(U.bahar.token, 'ynm_matches')).data, [{ item_key: 's:massage', my_answer: 'maybe', partner_answer: 'yes' }]);
  assert.equal(errCode(await rest(U.ari.token, 'ynm_try_soon', { op: 'insert', rows: [{ couple_id: coupleId, item_key: 's:roleplay' }] })), 'not_a_match');
  assert.equal((await rest(U.ari.token, 'ynm_try_soon', { op: 'insert', rows: [{ couple_id: coupleId, item_key: 's:massage' }] })).status, 200);
});

test('spicy: body map overlaps only; fantasies hidden until interested', async () => {
  await rest(U.ari.token, 'body_map_answers', { op: 'insert', rows: [{ couple_id: coupleId, side: 'mine', area: 'neck', intensity: 3 }, { couple_id: coupleId, side: 'mine', area: 'back', intensity: 2 }] });
  await rest(U.bahar.token, 'body_map_answers', { op: 'insert', rows: [{ couple_id: coupleId, side: 'yours', area: 'neck', intensity: 2 }, { couple_id: coupleId, side: 'mine', area: 'back', intensity: 3 }] });
  assert.equal((await sel(U.bahar.token, 'body_map_answers', [['user_id', 'eq', U.ari.id]])).length, 0);
  assert.deepEqual((await rpc(U.ari.token, 'body_map_matches')).data, [{ area: 'neck', kind: 'on_me', intensity: 2 }]);
  await rest(U.ari.token, 'fantasies', { op: 'insert', rows: [{ couple_id: coupleId, category: 'place', heat: 3, text_ciphertext: 'secret', nonce: 'n' }] });
  assert.equal((await sel(U.bahar.token, 'fantasies')).length, 0);
  let f = (await rpc(U.bahar.token, 'list_fantasies')).data[0];
  assert.equal(f.is_mine, false);
  assert.equal(f.text_ciphertext, null);
  assert.equal(errCode(await rpc(U.ari.token, 'fantasy_interest', { p_id: f.id, p_interested: true })), 'not_allowed');
  await rpc(U.bahar.token, 'fantasy_interest', { p_id: f.id, p_interested: true });
  f = (await rpc(U.bahar.token, 'list_fantasies')).data[0];
  assert.equal(f.text_ciphertext, 'secret');
});

test('decks secret until shared; level 4 hidden while spicy off; games', async () => {
  const deck = (await rest(U.ari.token, 'decks', { op: 'insert', rows: [{ couple_id: coupleId, kind: 'dare', name_ciphertext: 'x', name_nonce: 'n' }], returning: true })).data[0];
  await rest(U.ari.token, 'cards', { op: 'insert', rows: [{ deck_id: deck.id, couple_id: coupleId, heat: 4, text_ciphertext: 'c', nonce: 'n' }] });
  assert.equal((await sel(U.bahar.token, 'cards')).length, 0);
  assert.equal((await sel(U.bahar.token, 'decks')).length, 0);
  assert.equal(errCode(await rest(U.bahar.token, 'cards', { op: 'insert', rows: [{ deck_id: deck.id, couple_id: coupleId, text_ciphertext: 'c', nonce: 'n' }] })), 'deck_mismatch');
  await rpc(U.ari.token, 'set_deck_shared', { p_deck: deck.id, p_shared: true });
  assert.equal((await sel(U.bahar.token, 'cards')).length, 1);
  await rpc(U.bahar.token, 'set_spicy', { enabled: false });
  assert.equal((await sel(U.bahar.token, 'cards')).length, 0);
  assert.equal(errCode(await rest(U.ari.token, 'game_sessions', { op: 'insert', rows: [{ couple_id: coupleId, game_type: 'strip' }] })), 'not_allowed');
  await rpc(U.bahar.token, 'set_spicy', { enabled: true });
  const g = (await rest(U.ari.token, 'game_sessions', { op: 'insert', rows: [{ couple_id: coupleId, game_type: 'truth_dare' }], returning: true })).data[0];
  assert.equal((await rpc(U.bahar.token, 'game_apply', { p_id: g.id, p_expected_version: 0, p_state_ciphertext: 'ct', p_state_nonce: 'n', p_status: 'active' })).data.version, 1);
  assert.equal(errCode(await rpc(U.ari.token, 'game_apply', { p_id: g.id, p_expected_version: 0, p_state_ciphertext: 'x', p_state_nonce: 'n' })), 'version_conflict');
  assert.equal(errCode(await rpc(U.cey.token, 'game_apply', { p_id: g.id, p_expected_version: 1, p_state_ciphertext: 'x', p_state_nonce: 'n' })), 'not_found');
  await rpc(U.ari.token, 'game_apply', { p_id: g.id, p_expected_version: 1, p_state_ciphertext: 'ct', p_state_nonce: 'n', p_status: 'finished' });
  assert.equal((await sel(U.ari.token, 'couples'))[0].game_streak, 1);
});

test('daily question: partner answer hidden until you answer', async () => {
  const add = (who, c) => rest(U[who].token, 'daily_answers', { op: 'insert', rows: [{ couple_id: coupleId, day: '2026-04-01', pool: 'sweet', question_idx: 3, ciphertext: c, nonce: 'n' }] });
  await add('ari', 'a');
  assert.equal((await sel(U.bahar.token, 'daily_answers', [['user_id', 'eq', U.ari.id]])).length, 0);
  await add('bahar', 'b');
  assert.equal((await sel(U.bahar.token, 'daily_answers', [['user_id', 'eq', U.ari.id]])).length, 1);
  assert.equal((await sel(U.ari.token, 'couples'))[0].question_streak, 1);
});

test('envelopes, locked plan and scheduled surprises stay hidden until their time', async () => {
  const future = new Date(Date.now() + 86400_000).toISOString();
  const e = (await rest(U.ari.token, 'envelopes', { op: 'insert', rows: [{ couple_id: coupleId, kind: 'date', title_ciphertext: 't', title_nonce: 'n', unlock_at: future }], returning: true })).data[0];
  assert.equal(errCode(await rest(U.bahar.token, 'envelope_contents', { op: 'insert', rows: [{ envelope_id: e.id, couple_id: coupleId, ciphertext: 'fake', nonce: 'n' }] })), 'not_allowed');
  await rest(U.ari.token, 'envelope_contents', { op: 'insert', rows: [{ envelope_id: e.id, couple_id: coupleId, ciphertext: 'letter', nonce: 'n' }] });
  assert.equal((await sel(U.bahar.token, 'envelope_contents')).length, 0);
  assert.equal(errCode(await rpc(U.bahar.token, 'open_envelope', { p_id: e.id })), 'locked');
  await db.prepare("UPDATE envelopes SET unlock_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").bind(e.id).run();
  assert.equal((await sel(U.bahar.token, 'envelope_contents')).length, 1);

  const cd = (await rest(U.ari.token, 'countdowns', { op: 'insert', rows: [{ couple_id: coupleId, target_at: future }], returning: true })).data[0];
  await rest(U.ari.token, 'plan_items', { op: 'insert', rows: [{ countdown_id: cd.id, couple_id: coupleId, ciphertext: 'plan', nonce: 'n' }] });
  assert.equal((await sel(U.bahar.token, 'plan_items')).length, 0);
  await db.prepare("UPDATE countdowns SET target_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").bind(cd.id).run();
  assert.equal((await sel(U.bahar.token, 'plan_items')).length, 1);

  await rest(U.ari.token, 'scheduled_items', { op: 'insert', rows: [{ couple_id: coupleId, payload_ciphertext: 'surprise', nonce: 'n', deliver_at: '2000-01-01T00:00:00.000Z' }] });
  assert.equal((await sel(U.bahar.token, 'scheduled_items')).length, 0);
  // no internet in tests: don't try to reach Expo's push service
  await db.prepare('UPDATE devices SET push_token = NULL').run();
  const t = await mf.dispatchFetch('http://localhost/cdn-cgi/mf/scheduled?cron=*+*+*+*+*');
  assert.equal(t.status, 200, await t.text());
  await new Promise((r) => setTimeout(r, 300));
  const got = await sel(U.bahar.token, 'messages', [['ciphertext', 'eq', 'surprise']]);
  assert.equal(got.length, 1);
  assert.equal(got[0].sender_id, U.ari.id);
});

test('vault: "both must agree" delete protection', async () => {
  const v = (await rest(U.ari.token, 'vault_items', { op: 'insert', rows: [{ couple_id: coupleId, kind: 'image', storage_path: `${coupleId}/vaultitem1`, nonce: 'n' }], returning: true })).data[0];
  await rpc(U.ari.token, 'update_couple_settings', { p_vault_delete_protection: true });
  assert.equal((await rpc(U.ari.token, 'vault_delete', { p_item: v.id })).data, null);
  assert.equal((await sel(U.bahar.token, 'vault_items')).length, 1);
  assert.deepEqual((await rpc(U.bahar.token, 'vault_delete', { p_item: v.id })).data, [`${coupleId}/vaultitem1`]);
  assert.equal((await sel(U.bahar.token, 'vault_items')).length, 0);
  assert.equal(errCode(await rpc(U.ari.token, 'update_couple_settings', { p_home_timezone: 'Not/AZone' })), 'invalid_timezone');
  assert.equal(errCode(await rest(U.ari.token, 'vault_items', { op: 'delete', filters: [['id', 'eq', v.id]] })), 'not_allowed');
});

test('storage: only the couple can read/write, ciphertext round-trips, orphan-only deletes', async () => {
  const path = `${coupleId}/abcdef12-3456`;
  const bytes = new Uint8Array([1, 2, 3, 250]);
  const put = await mf.dispatchFetch(`http://localhost/api/storage/vault/${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${U.ari.token}` }, body: bytes });
  assert.equal(put.status, 200);
  const again = await mf.dispatchFetch(`http://localhost/api/storage/vault/${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${U.ari.token}` }, body: bytes });
  assert.equal(again.status, 409);
  const get = await mf.dispatchFetch(`http://localhost/api/storage/vault/${path}`, { headers: { Authorization: `Bearer ${U.bahar.token}` } });
  assert.deepEqual([...new Uint8Array(await get.arrayBuffer())], [1, 2, 3, 250]);
  const outsider = await mf.dispatchFetch(`http://localhost/api/storage/vault/${path}`, { headers: { Authorization: `Bearer ${U.cey.token}` } });
  assert.equal(outsider.status, 403);
  await rest(U.ari.token, 'vault_items', { op: 'insert', rows: [{ couple_id: coupleId, kind: 'image', storage_path: path, nonce: 'n' }] });
  assert.deepEqual((await call(U.bahar.token, '/api/storage/vault/remove', { paths: [path] })).data, []);
  const traversal = await mf.dispatchFetch(`http://localhost/api/storage/vault/${coupleId}/..%2F..%2Fx`, { headers: { Authorization: `Bearer ${U.ari.token}` } });
  assert.equal(traversal.status, 403);
});

test('snap_opened: receiver only; view-once deletes the ciphertext', async () => {
  const id = crypto.randomUUID();
  const path = `${coupleId}/snapobject1`;
  await mf.dispatchFetch(`http://localhost/api/storage/snaps/${path}`, { method: 'PUT', headers: { Authorization: `Bearer ${U.ari.token}` }, body: new Uint8Array([9]) });
  await rest(U.ari.token, 'snaps', { op: 'insert', rows: [{ id, couple_id: coupleId, nonce: 'n', media_kind: 'image', storage_path: path }] });
  assert.equal(errCode(await call(U.ari.token, '/api/functions/snap_opened', { snap_id: id })), 'sender_cannot_open');
  assert.equal((await call(U.bahar.token, '/api/functions/snap_opened', { snap_id: id })).data.deleted, true);
  const row = (await sel(U.bahar.token, 'snaps', [['id', 'eq', id]]))[0];
  assert.equal(row.storage_path, null);
  assert.ok(row.opened_at);
  const r2 = await mf.getR2Bucket('MEDIA');
  assert.equal(await r2.head(`snaps/${path}`), null);
});

test('realtime: broadcast relay, presence and change notices per couple', async () => {
  const open = async (token) => {
    const res = await mf.dispatchFetch('http://localhost/api/realtime', { headers: { Upgrade: 'websocket', Authorization: `Bearer ${token}` } });
    assert.equal(res.status, 101);
    const ws = res.webSocket;
    const inbox = [];
    ws.addEventListener('message', (e) => inbox.push(JSON.parse(e.data)));
    ws.accept();
    return { ws, inbox };
  };
  const a = await open(U.ari.token);
  const b = await open(U.bahar.token);
  const outsider = await mf.dispatchFetch('http://localhost/api/realtime', { headers: { Upgrade: 'websocket', Authorization: `Bearer ${U.dara.token}` } });
  assert.equal(outsider.status, 409);
  const wait = (box, pred) => new Promise((res, rej) => {
    const t0 = Date.now();
    const tick = () => { const m = box.find(pred); if (m) return res(m); if (Date.now() - t0 > 3000) return rej(new Error('timeout')); setTimeout(tick, 20); };
    tick();
  });
  a.ws.send(JSON.stringify({ t: 'track', meta: { user_id: U.ari.id, screen: 'chat' } }));
  const p = await wait(b.inbox, (m) => m.t === 'presence' && m.state[U.ari.id]);
  assert.equal(p.state[U.ari.id][0].screen, 'chat');
  a.ws.send(JSON.stringify({ t: 'bc', event: 'typing', payload: { on: true } }));
  const bc = await wait(b.inbox, (m) => m.t === 'bc');
  assert.equal(bc.event, 'typing');
  assert.equal(bc.from, U.ari.id);
  assert.equal(a.inbox.some((m) => m.t === 'bc'), false); // no echo to sender
  await rest(U.ari.token, 'messages', { op: 'insert', rows: [{ couple_id: coupleId, type: 'text', ciphertext: 'live', nonce: 'n' }] });
  const db1 = await wait(b.inbox, (m) => m.t === 'db' && m.events.some((e) => e.table === 'messages' && e.event === 'INSERT'));
  assert.ok(db1.events[0].key.id);
  a.ws.close();
  b.ws.close();
});
