/**
 * Safe, rule-checked table access for the app (POST /api/rest/:table).
 * Only registered tables/columns are reachable, values are always bound
 * parameters, and every statement carries the table's access rule.
 */
import type { Env } from './env';
import type { Ctx } from './context';
import { TABLES, type TableDef, type Where } from './tables';
import { HttpError, nowIso, uuid, type Row } from './util';
import { addXp, notify, registerDailyAnswer, registerStreakActivity, type ChangeEvent } from './logic';

export type Filter = [string, 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'is' | 'in' | 'not.is', unknown];
export type Query = {
  op: 'select' | 'insert' | 'upsert' | 'update' | 'delete';
  columns?: string;
  filters?: Filter[];
  order?: [string, boolean][];
  limit?: number;
  rows?: Row[];
  values?: Row;
  onConflict?: string;
  ignoreDuplicates?: boolean;
  returning?: boolean;
};

const MAX_LIMIT = 1000;

function table(name: string): TableDef {
  const def = Object.prototype.hasOwnProperty.call(TABLES, name) ? TABLES[name] : undefined;
  if (!def) throw new HttpError(404, 'unknown_table');
  return def;
}

function col(def: TableDef, c: string): string {
  if (!Object.prototype.hasOwnProperty.call(def.cols, c)) throw new HttpError(400, 'unknown_column');
  return c;
}

function enc(def: TableDef, c: string, v: unknown): unknown {
  if (v === undefined || v === null) return null;
  switch (def.cols[c]) {
    case 'bool':
      return v ? 1 : 0;
    case 'json':
      return JSON.stringify(v);
    case 'int':
      return typeof v === 'number' ? v : Number(v);
    default:
      return typeof v === 'string' ? v : String(v);
  }
}

export function decode(def: TableDef, row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    const t = def.cols[k];
    if (t === 'bool') out[k] = v === null ? null : !!v;
    else if (t === 'json') {
      try {
        out[k] = v == null ? null : JSON.parse(String(v));
      } catch {
        out[k] = null;
      }
    } else out[k] = v;
  }
  return out;
}

function filtersSql(def: TableDef, filters: Filter[] = []): Where {
  const parts: string[] = [];
  const args: unknown[] = [];
  for (const [c, op, v] of filters) {
    const name = col(def, c);
    switch (op) {
      case 'eq': case 'neq': case 'gt': case 'gte': case 'lt': case 'lte': {
        const sym = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[op];
        parts.push(`${name} ${sym} ?`);
        args.push(enc(def, name, v));
        break;
      }
      case 'is':
        if (v === null) parts.push(`${name} IS NULL`);
        else {
          parts.push(`${name} = ?`);
          args.push(v ? 1 : 0);
        }
        break;
      case 'not.is':
        if (v === null) parts.push(`${name} IS NOT NULL`);
        else {
          parts.push(`${name} <> ?`);
          args.push(v ? 1 : 0);
        }
        break;
      case 'in': {
        const list = Array.isArray(v) ? v.slice(0, 500) : [];
        if (!list.length) parts.push('0');
        else {
          parts.push(`${name} IN (${list.map(() => '?').join(',')})`);
          for (const x of list) args.push(enc(def, name, x));
        }
        break;
      }
      default:
        throw new HttpError(400, 'bad_filter');
    }
  }
  return { sql: parts.length ? parts.join(' AND ') : '1', args };
}

function and(...ws: Where[]): Where {
  return { sql: ws.map((w) => `(${w.sql})`).join(' AND '), args: ws.flatMap((w) => w.args) };
}

function pkWhere(def: TableDef, row: Row): Where {
  return { sql: def.pk.map((k) => `${k} = ?`).join(' AND '), args: def.pk.map((k) => enc(def, k, row[k])) };
}

function pkOf(def: TableDef, row: Row): Row {
  return Object.fromEntries(def.pk.map((k) => [k, row[k]]));
}

async function all(env: Env, sql: string, args: unknown[]): Promise<Row[]> {
  const r = await env.DB.prepare(sql).bind(...args).all<Row>();
  return r.results ?? [];
}

// ─── checks that need the database (trigger emulation) ─────────────────────
async function beforeInsertHook(env: Env, ctx: Ctx, name: string, row: Row): Promise<void> {
  if (name === 'cards') {
    const d = await env.DB.prepare('SELECT owner_id, couple_id, is_shared FROM decks WHERE id = ?').bind(row.deck_id ?? '').first<Row>();
    if (!d || d.owner_id !== ctx.uid || d.couple_id !== row.couple_id) throw new HttpError(403, 'deck_mismatch');
    row.is_shared = !!d.is_shared;
  }
  if (name === 'message_reactions') {
    const m = await env.DB.prepare('SELECT 1 FROM messages WHERE id = ? AND couple_id = ?').bind(row.message_id ?? '', ctx.coupleId).first();
    if (!m) throw new HttpError(403, 'not_allowed');
  }
  if (name === 'envelope_contents') {
    const e = await env.DB.prepare('SELECT 1 FROM envelopes WHERE id = ? AND author_id = ? AND couple_id = ?')
      .bind(row.envelope_id ?? '', ctx.uid, ctx.coupleId).first();
    if (!e) throw new HttpError(403, 'not_allowed');
  }
  if (name === 'ynm_try_soon') {
    const { ynmMatches } = await import('./rpc');
    const matches = await ynmMatches(env, ctx);
    if (!matches.some((m) => m.item_key === row.item_key)) throw new HttpError(403, 'not_a_match');
  }
  if (name === 'messages' && row.reply_to) {
    const r = await env.DB.prepare('SELECT 1 FROM messages WHERE id = ? AND couple_id = ?').bind(row.reply_to, ctx.coupleId).first();
    if (!r) row.reply_to = null;
  }
}

async function afterInsertHook(env: Env, ctx: Ctx, name: string, row: Row): Promise<ChangeEvent[]> {
  const c = ctx.coupleId;
  if (!c) return [];
  if (name === 'messages') {
    await addXp(env, c, 1);
  }
  if (name === 'snaps') {
    const ev = await registerStreakActivity(env, c, ctx.uid, new Date(String(row.created_at)));
    await addXp(env, c, 3);
    return [...ev, { table: 'couples', event: 'UPDATE', key: { id: c } }];
  }
  if (name === 'daily_answers') {
    if (await registerDailyAnswer(env, c, String(row.day), String(row.pool))) return [{ table: 'couples', event: 'UPDATE', key: { id: c } }];
  }
  return [];
}

function prepareInsert(def: TableDef, ctx: Ctx, input: Row): Row {
  const row: Row = {};
  for (const [k, v] of Object.entries(input)) row[col(def, k)] = v;
  for (const o of def.ownerCols ?? []) if (row[o] === undefined || row[o] === null) row[o] = ctx.uid;
  if ('couple_id' in def.cols && (row.couple_id === undefined || row.couple_id === null)) row.couple_id = ctx.coupleId;
  if (def.autoId && !row.id) row.id = uuid();
  if ('updated_at' in def.cols) row.updated_at = nowIso();
  def.beforeInsert?.(ctx, row);
  return row;
}

async function insertOne(env: Env, ctx: Ctx, name: string, def: TableDef, row: Row, events: ChangeEvent[]): Promise<Row> {
  if (!def.insert || !def.insert(ctx, row)) throw new HttpError(403, 'not_allowed');
  await beforeInsertHook(env, ctx, name, row);
  const cols = Object.keys(row);
  await env.DB.prepare(`INSERT INTO ${name} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    .bind(...cols.map((c) => enc(def, c, row[c])))
    .run();
  if (def.live) events.push({ table: name, event: 'INSERT', key: pkOf(def, row) });
  events.push(...(await afterInsertHook(env, ctx, name, row)));
  return row;
}

async function updateRows(env: Env, ctx: Ctx, name: string, def: TableDef, where: Where, values: Row, events: ChangeEvent[]): Promise<Row[]> {
  const upd = def.update;
  if (!upd) throw new HttpError(403, 'not_allowed');
  const policy = upd.where(ctx);
  if (!policy) throw new HttpError(403, 'not_allowed');
  const set: Row = {};
  for (const [k, v] of Object.entries(values)) {
    col(def, k);
    if (!upd.columns.includes(k)) {
      // allow no-op echoes of key/owner columns, refuse real changes
      continue;
    }
    set[k] = v;
  }
  if ('updated_at' in def.cols) set.updated_at = nowIso();
  if (!Object.keys(set).length) return [];
  const targets = await all(env, `SELECT * FROM ${name} WHERE ${and(policy, where).sql}`, and(policy, where).args);
  const out: Row[] = [];
  for (const t of targets) {
    const merged = { ...decode(def, t), ...set };
    if (!upd.check(ctx, merged)) throw new HttpError(403, 'not_allowed');
    const keys = Object.keys(set);
    const pk = pkWhere(def, t);
    await env.DB.prepare(`UPDATE ${name} SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE ${pk.sql}`)
      .bind(...keys.map((k) => enc(def, k, set[k])), ...pk.args)
      .run();
    if (def.live) events.push({ table: name, event: 'UPDATE', key: pkOf(def, t) });
    out.push(merged);
  }
  return out;
}

export async function runQuery(env: Env, ctx: Ctx, name: string, q: Query): Promise<Row[] | null> {
  const def = table(name);
  const events: ChangeEvent[] = [];
  let result: Row[] | null = null;

  if (q.op === 'select') {
    const policy = def.select?.(ctx);
    if (!policy) return [];
    const cols = !q.columns || q.columns.trim() === '*' ? Object.keys(def.cols) : q.columns.split(',').map((c) => col(def, c.trim()));
    const w = and(policy, filtersSql(def, q.filters));
    const order = (q.order ?? []).map(([c, asc]) => `${col(def, c)} ${asc ? 'ASC' : 'DESC'}`).join(', ');
    const limit = Math.min(Math.max(1, Number(q.limit ?? MAX_LIMIT) || MAX_LIMIT), MAX_LIMIT);
    const rows = await all(env, `SELECT ${cols.join(',')} FROM ${name} WHERE ${w.sql}${order ? ` ORDER BY ${order}` : ''} LIMIT ${limit}`, w.args);
    return rows.map((r) => decode(def, r));
  }

  if (q.op === 'insert') {
    const out: Row[] = [];
    for (const input of (q.rows ?? []).slice(0, 200)) out.push(await insertOne(env, ctx, name, def, prepareInsert(def, ctx, input), events));
    result = out;
  }

  if (q.op === 'upsert') {
    const conflict = (q.onConflict ? q.onConflict.split(',') : def.pk).map((c) => col(def, c.trim()));
    const out: Row[] = [];
    for (const input of (q.rows ?? []).slice(0, 200)) {
      const row = prepareInsert(def, ctx, input);
      const cw = { sql: conflict.map((c) => `${c} = ?`).join(' AND '), args: conflict.map((c) => enc(def, c, row[c])) };
      const existing = await env.DB.prepare(`SELECT * FROM ${name} WHERE ${cw.sql}`).bind(...cw.args).first<Row>();
      if (existing) {
        if (q.ignoreDuplicates) continue;
        const values: Row = {};
        for (const [k, v] of Object.entries(input)) if (!conflict.includes(k)) values[k] = v;
        out.push(...(await updateRows(env, ctx, name, def, pkWhere(def, existing), values, events)));
      } else {
        out.push(await insertOne(env, ctx, name, def, row, events));
      }
    }
    result = out;
  }

  if (q.op === 'update') {
    if (!q.filters?.length) throw new HttpError(400, 'filter_required');
    result = await updateRows(env, ctx, name, def, filtersSql(def, q.filters), q.values ?? {}, events);
  }

  if (q.op === 'delete') {
    if (!q.filters?.length) throw new HttpError(400, 'filter_required');
    const policy = def.delete?.(ctx);
    if (!policy) throw new HttpError(403, 'not_allowed');
    const w = and(policy, filtersSql(def, q.filters));
    const rows = await all(env, `SELECT * FROM ${name} WHERE ${w.sql}`, w.args);
    for (const r of rows) {
      const pk = pkWhere(def, r);
      await env.DB.prepare(`DELETE FROM ${name} WHERE ${pk.sql}`).bind(...pk.args).run();
      if (def.live) events.push({ table: name, event: 'DELETE', key: pkOf(def, r) });
    }
    result = rows.map((r) => decode(def, r));
  }

  await notify(env, ctx.coupleId, events);
  if (!q.returning || !result) return null;
  // Return rows as the caller is allowed to see them now.
  const policy = def.select?.(ctx);
  if (!policy) return [];
  const visible: Row[] = [];
  for (const r of result) {
    const pk = pkWhere(def, r);
    const w = and(policy, pk);
    const row = await env.DB.prepare(`SELECT * FROM ${name} WHERE ${w.sql}`).bind(...w.args).first<Row>();
    if (row) visible.push(decode(def, row));
    else if (q.op === 'delete') visible.push(r);
  }
  return visible;
}
