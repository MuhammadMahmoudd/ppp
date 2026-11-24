/**
 * Table registry + access rules (the Worker's version of row-level security).
 *
 * Every client read/write goes through server/src/db.ts, which only touches
 * tables listed here, only the listed columns, and always ANDs the table's
 * `select` / `update` / `delete` rule into the SQL. Inserts must pass
 * `insert`. A table without a rule for an operation refuses it.
 *
 * Private tables (Yes/No/Maybe answers, body map, fantasies, scheduled
 * surprises, key backups, devices) are author-only: the partner can never
 * read them; only the match functions in rpc.ts compare them.
 */
import type { Ctx } from './context';
import type { Row } from './util';

export type ColType = 'text' | 'int' | 'bool' | 'json';
export type Where = { sql: string; args: unknown[] };

export type TableDef = {
  cols: Record<string, ColType>;
  pk: string[];
  /** columns filled with the caller's id when missing */
  ownerCols?: string[];
  /** generate a uuid for this column when missing */
  autoId?: boolean;
  select?: (c: Ctx) => Where | null;
  insert?: (c: Ctx, row: Row) => boolean;
  update?: { where: (c: Ctx) => Where | null; check: (c: Ctx, row: Row) => boolean; columns: string[] };
  delete?: (c: Ctx) => Where | null;
  /** emit realtime change events to the couple */
  live?: boolean;
  /** server-managed fields to normalise before insert (trigger emulation) */
  beforeInsert?: (c: Ctx, row: Row) => void;
};

const W = (sql: string, ...args: unknown[]): Where => ({ sql, args });
const couple = (c: Ctx) => (c.coupleId ? W('couple_id = ?', c.coupleId) : null);
const own = (col: string) => (c: Ctx) => W(`${col} = ?`, c.uid);
const isMine = (col: string) => (c: Ctx, r: Row) => r[col] === c.uid && r.couple_id === c.coupleId && !!c.coupleId;
const inCouple = (c: Ctx, r: Row) => !!c.coupleId && r.couple_id === c.coupleId;

export const TABLES: Record<string, TableDef> = {
  couples: {
    cols: {
      id: 'text', created_at: 'text', home_timezone: 'text', anniversary: 'text',
      adult_confirmed_a: 'bool', adult_confirmed_b: 'bool', spicy_enabled_a: 'bool', spicy_enabled_b: 'bool',
      streak_count: 'int', streak_best: 'int', streak_last_day: 'text', streak_warned_day: 'text',
      streak_freezes_left: 'int', streak_freeze_month: 'text', question_streak: 'int', question_last_day: 'text',
      game_streak: 'int', game_last_day: 'text', couple_xp: 'int', chat_disappear_mode: 'text', vault_delete_protection: 'bool',
    },
    pk: ['id'],
    select: (c) => (c.coupleId ? W('id = ?', c.coupleId) : null),
    live: true,
  },
  couple_members: {
    cols: { couple_id: 'text', user_id: 'text', role: 'text', joined_at: 'text' },
    pk: ['couple_id', 'user_id'],
    select: couple,
    live: true,
  },
  profiles: {
    cols: {
      user_id: 'text', display_name: 'text', avatar_path: 'text', avatar_nonce: 'text', timezone: 'text',
      public_key: 'text', birthday: 'text', locale: 'text', created_at: 'text', updated_at: 'text',
    },
    pk: ['user_id'],
    select: (c) => (c.partnerId ? W('user_id IN (?, ?)', c.uid, c.partnerId) : W('user_id = ?', c.uid)),
    update: {
      where: own('user_id'),
      check: (c, r) => r.user_id === c.uid,
      columns: ['display_name', 'avatar_path', 'avatar_nonce', 'timezone', 'public_key', 'birthday', 'locale'],
    },
    live: true,
  },
  devices: {
    cols: { user_id: 'text', push_token: 'text', push_previews: 'bool', updated_at: 'text' },
    pk: ['user_id'],
    ownerCols: ['user_id'],
    select: own('user_id'),
    insert: (c, r) => r.user_id === c.uid,
    update: { where: own('user_id'), check: (c, r) => r.user_id === c.uid, columns: ['push_token', 'push_previews'] },
  },
  invites: {
    cols: { id: 'text', code: 'text', couple_id: 'text', created_by: 'text', created_at: 'text', expires_at: 'text', used_at: 'text', used_by: 'text' },
    pk: ['id'],
    select: couple,
  },
  key_backups: {
    cols: { user_id: 'text', public_key: 'text', salt: 'text', nonce: 'text', ciphertext: 'text', kdf: 'text', iterations: 'int', updated_at: 'text' },
    pk: ['user_id'],
    ownerCols: ['user_id'],
    select: own('user_id'),
    insert: (c, r) => r.user_id === c.uid,
    update: { where: own('user_id'), check: (c, r) => r.user_id === c.uid, columns: ['public_key', 'salt', 'nonce', 'ciphertext', 'kdf', 'iterations'] },
    delete: own('user_id'),
  },

  // ─── chat ────────────────────────────────────────────────────────────────
  messages: {
    cols: {
      id: 'text', couple_id: 'text', sender_id: 'text', type: 'text', ciphertext: 'text', nonce: 'text',
      media_path: 'text', media_nonce: 'text', reply_to: 'text', disappear_mode: 'text', meta: 'json',
      created_at: 'text', seen_at: 'text', expires_at: 'text', deleted_at: 'text',
    },
    pk: ['id'],
    autoId: true,
    ownerCols: ['sender_id'],
    select: couple,
    insert: (c, r) => isMine('sender_id')(c, r) && c.paired,
    beforeInsert: (_c, r) => {
      const now = new Date();
      r.created_at = now.toISOString();
      r.seen_at = null;
      r.deleted_at = null;
      r.expires_at = r.disappear_mode === '24h' ? new Date(now.getTime() + 24 * 3600_000).toISOString() : null;
    },
    live: true,
  },
  message_reactions: {
    cols: { message_id: 'text', user_id: 'text', couple_id: 'text', emoji: 'text', created_at: 'text' },
    pk: ['message_id', 'user_id'],
    ownerCols: ['user_id'],
    select: couple,
    insert: isMine('user_id'),
    update: { where: own('user_id'), check: isMine('user_id'), columns: ['emoji'] },
    delete: own('user_id'),
    live: true,
  },
  snaps: {
    cols: {
      id: 'text', couple_id: 'text', sender_id: 'text', storage_path: 'text', nonce: 'text', meta_ciphertext: 'text',
      meta_nonce: 'text', media_kind: 'text', duration: 'int', allow_save: 'bool', spicy_blur: 'bool', view_once: 'bool',
      proof_for: 'text', created_at: 'text', opened_at: 'text', expires_at: 'text',
    },
    pk: ['id'],
    autoId: true,
    ownerCols: ['sender_id'],
    select: couple,
    insert: (c, r) => isMine('sender_id')(c, r) && c.paired,
    beforeInsert: (_c, r) => {
      r.created_at = new Date().toISOString();
      r.opened_at = null;
      r.expires_at = new Date(Date.now() + 7 * 24 * 3600_000).toISOString();
    },
    live: true,
  },
  screenshot_events: {
    cols: { id: 'text', couple_id: 'text', user_id: 'text', context: 'text', target_id: 'text', created_at: 'text' },
    pk: ['id'],
    autoId: true,
    ownerCols: ['user_id'],
    select: couple,
    insert: isMine('user_id'),
    live: true,
  },
  streak_days: {
    cols: { couple_id: 'text', day: 'text', a_sent: 'bool', b_sent: 'bool', completed: 'bool', frozen: 'bool' },
    pk: ['couple_id', 'day'],
    select: couple,
    live: true,
  },

  // ─── decks & games ───────────────────────────────────────────────────────
  decks: {
    cols: { id: 'text', couple_id: 'text', owner_id: 'text', kind: 'text', name_ciphertext: 'text', name_nonce: 'text', is_shared: 'bool', created_at: 'text' },
    pk: ['id'],
    autoId: true,
    ownerCols: ['owner_id'],
    // secret decks: only the creator sees them until shared
    select: (c) => (c.coupleId ? W('couple_id = ? AND (owner_id = ? OR is_shared = 1)', c.coupleId, c.uid) : null),
    insert: isMine('owner_id'),
    update: { where: own('owner_id'), check: isMine('owner_id'), columns: ['kind', 'name_ciphertext', 'name_nonce'] },
    delete: own('owner_id'),
    live: true,
  },
  cards: {
    cols: {
      id: 'text', deck_id: 'text', couple_id: 'text', owner_id: 'text', heat: 'int', category: 'text',
      text_ciphertext: 'text', nonce: 'text', is_shared: 'bool', created_at: 'text',
    },
    pk: ['id'],
    autoId: true,
    ownerCols: ['owner_id'],
    // shared cards visible to the partner; level 4 only while Spicy is on for both
    select: (c) =>
      c.coupleId
        ? W('couple_id = ? AND (owner_id = ? OR (is_shared = 1 AND (heat < 4 OR ?)))', c.coupleId, c.uid, c.spicy ? 1 : 0)
        : null,
    insert: isMine('owner_id'), // deck ownership checked in db.ts (cards hook)
    update: { where: own('owner_id'), check: isMine('owner_id'), columns: ['heat', 'category', 'text_ciphertext', 'nonce', 'is_shared'] },
    delete: own('owner_id'),
    live: true,
  },
  game_sessions: {
    cols: {
      id: 'text', couple_id: 'text', game_type: 'text', state_ciphertext: 'text', state_nonce: 'text', version: 'int',
      turn_user_id: 'text', status: 'text', created_by: 'text', created_at: 'text', updated_at: 'text',
    },
    pk: ['id'],
    autoId: true,
    ownerCols: ['created_by'],
    select: couple,
    insert: (c, r) =>
      isMine('created_by')(c, r) && c.paired && (!['strip', 'roleplay', 'tease_timer'].includes(String(r.game_type)) || c.spicy),
    beforeInsert: (_c, r) => {
      r.version = 0;
      r.created_at = r.updated_at = new Date().toISOString();
    },
    live: true,
  },

  // ─── spicy hub ───────────────────────────────────────────────────────────
  ynm_items: {
    cols: { id: 'text', couple_id: 'text', created_by: 'text', category: 'text', text_ciphertext: 'text', nonce: 'text', created_at: 'text' },
    pk: ['id'],
    autoId: true,
    ownerCols: ['created_by'],
    select: (c) => (c.coupleId && c.spicy ? W('couple_id = ?', c.coupleId) : null),
    insert: (c, r) => isMine('created_by')(c, r) && c.spicy,
    delete: own('created_by'),
  },
  ynm_answers: {
    cols: { user_id: 'text', couple_id: 'text', item_key: 'text', answer: 'text', updated_at: 'text' },
    pk: ['user_id', 'item_key'],
    ownerCols: ['user_id'],
    select: own('user_id'),
    insert: isMine('user_id'),
    update: { where: own('user_id'), check: isMine('user_id'), columns: ['answer', 'updated_at'] },
    delete: own('user_id'),
  },
  ynm_try_soon: {
    cols: { couple_id: 'text', item_key: 'text', added_by: 'text', added_at: 'text', done_at: 'text' },
    pk: ['couple_id', 'item_key'],
    ownerCols: ['added_by'],
    select: couple,
    insert: isMine('added_by'), // must be a real match: checked in db.ts hook
    update: { where: couple, check: inCouple, columns: ['done_at'] },
    delete: couple,
    live: true,
  },
  boundary_checkins: {
    cols: { user_id: 'text', couple_id: 'text', at: 'text' },
    pk: ['user_id', 'at'],
    ownerCols: ['user_id'],
    select: own('user_id'),
    insert: isMine('user_id'),
    delete: own('user_id'),
  },
  body_map_answers: {
    cols: { user_id: 'text', couple_id: 'text', side: 'text', area: 'text', intensity: 'int', updated_at: 'text' },
    pk: ['user_id', 'side', 'area'],
    ownerCols: ['user_id'],
    select: own('user_id'),
    insert: isMine('user_id'),
    update: { where: own('user_id'), check: isMine('user_id'), columns: ['intensity', 'updated_at'] },
    delete: own('user_id'),
  },
  fantasies: {
    cols: {
      id: 'text', couple_id: 'text', author_id: 'text', category: 'text', heat: 'int', text_ciphertext: 'text',
      nonce: 'text', partner_interested: 'bool', interested_at: 'text', created_at: 'text',
    },
    pk: ['id'],
    autoId: true,
    ownerCols: ['author_id'],
    select: own('author_id'), // partners see teasers via rpc list_fantasies
    insert: (c, r) => isMine('author_id')(c, r) && c.spicy,
    delete: own('author_id'),
  },

  // ─── vault ───────────────────────────────────────────────────────────────
  vault_albums: {
    cols: { id: 'text', couple_id: 'text', created_by: 'text', name_ciphertext: 'text', name_nonce: 'text', created_at: 'text' },
    pk: ['id'],
    autoId: true,
    ownerCols: ['created_by'],
    select: couple,
    insert: isMine('created_by'),
    update: { where: couple, check: inCouple, columns: ['name_ciphertext', 'name_nonce'] },
    delete: couple,
    live: true,
  },
  vault_items: {
    cols: {
      id: 'text', couple_id: 'text', uploader_id: 'text', album_id: 'text', kind: 'text', storage_path: 'text', nonce: 'text',
      thumb_path: 'text', thumb_nonce: 'text', meta_ciphertext: 'text', meta_nonce: 'text', created_at: 'text',
    },
    pk: ['id'],
    autoId: true,
    ownerCols: ['uploader_id'],
    select: couple,
    insert: isMine('uploader_id'),
    update: { where: couple, check: inCouple, columns: ['album_id', 'meta_ciphertext', 'meta_nonce', 'thumb_path', 'thumb_nonce'] },
    live: true,
  },
  vault_delete_requests: {
    cols: { item_id: 'text', couple_id: 'text', requested_by: 'text', requested_at: 'text' },
    pk: ['item_id'],
    select: couple,
    delete: couple,
    live: true,
  },

  // ─── closeness ───────────────────────────────────────────────────────────
  scheduled_items: {
    cols: {
      id: 'text', couple_id: 'text', sender_id: 'text', kind: 'text', message_type: 'text', payload_ciphertext: 'text',
      nonce: 'text', media_path: 'text', media_nonce: 'text', deliver_at: 'text', delivered_at: 'text', created_at: 'text',
    },
    pk: ['id'],
    autoId: true,
    ownerCols: ['sender_id'],
    select: own('sender_id'), // surprises stay hidden from the receiver
    insert: (c, r) => isMine('sender_id')(c, r) && !r.delivered_at,
    update: { where: (c) => W('sender_id = ? AND delivered_at IS NULL', c.uid), check: isMine('sender_id'), columns: ['deliver_at', 'payload_ciphertext', 'nonce'] },
    delete: (c) => W('sender_id = ? AND delivered_at IS NULL', c.uid),
  },
  envelopes: {
    cols: {
      id: 'text', couple_id: 'text', author_id: 'text', kind: 'text', title_ciphertext: 'text', title_nonce: 'text',
      unlock_at: 'text', opened_at: 'text', created_at: 'text',
    },
    pk: ['id'],
    autoId: true,
    ownerCols: ['author_id'],
    select: couple,
    insert: isMine('author_id'),
    delete: own('author_id'),
    live: true,
  },
  envelope_contents: {
    cols: { envelope_id: 'text', couple_id: 'text', ciphertext: 'text', nonce: 'text' },
    pk: ['envelope_id'],
    // author always; partner only once unlocked ("open when…" letters: any time)
    select: (c) =>
      c.coupleId
        ? W(
            `couple_id = ? AND EXISTS (SELECT 1 FROM envelopes e WHERE e.id = envelope_contents.envelope_id
               AND (e.author_id = ? OR e.kind = 'when' OR e.unlock_at <= ?))`,
            c.coupleId, c.uid, new Date().toISOString(),
          )
        : null,
    insert: inCouple, // envelope authorship checked in db.ts hook
  },
  countdowns: {
    cols: { id: 'text', couple_id: 'text', created_by: 'text', title_ciphertext: 'text', title_nonce: 'text', target_at: 'text', created_at: 'text' },
    pk: ['id'],
    autoId: true,
    ownerCols: ['created_by'],
    select: couple,
    insert: isMine('created_by'),
    update: { where: couple, check: inCouple, columns: ['title_ciphertext', 'title_nonce', 'target_at'] },
    delete: couple,
    live: true,
  },
  plan_items: {
    cols: { id: 'text', countdown_id: 'text', couple_id: 'text', author_id: 'text', ciphertext: 'text', nonce: 'text', created_at: 'text' },
    pk: ['id'],
    autoId: true,
    ownerCols: ['author_id'],
    // locked "first night back" plan: partner's items unlock when the countdown ends
    select: (c) =>
      c.coupleId
        ? W(
            `couple_id = ? AND (author_id = ? OR EXISTS (SELECT 1 FROM countdowns d WHERE d.id = plan_items.countdown_id AND d.target_at <= ?))`,
            c.coupleId, c.uid, new Date().toISOString(),
          )
        : null,
    insert: isMine('author_id'),
    delete: own('author_id'),
    live: true,
  },
  daily_answers: {
    cols: {
      couple_id: 'text', user_id: 'text', day: 'text', pool: 'text', question_idx: 'int', ciphertext: 'text', nonce: 'text', created_at: 'text',
    },
    pk: ['couple_id', 'user_id', 'day', 'pool'],
    ownerCols: ['user_id'],
    // partner's answer only after you answered the same day + pool
    select: (c) =>
      c.coupleId
        ? W(
            `couple_id = ? AND (user_id = ? OR EXISTS (SELECT 1 FROM daily_answers mine WHERE mine.couple_id = daily_answers.couple_id
               AND mine.user_id = ? AND mine.day = daily_answers.day AND mine.pool = daily_answers.pool))`,
            c.coupleId, c.uid, c.uid,
          )
        : null,
    insert: (c, r) => isMine('user_id')(c, r) && (r.pool === 'sweet' || c.spicy),
    live: true,
  },
  miss_you_events: {
    cols: { id: 'text', couple_id: 'text', sender_id: 'text', created_at: 'text' },
    pk: ['id'],
    autoId: true,
    ownerCols: ['sender_id'],
    select: couple,
    insert: isMine('sender_id'),
    live: true,
  },
  shared_items: {
    cols: {
      id: 'text', couple_id: 'text', created_by: 'text', kind: 'text', ciphertext: 'text', nonce: 'text',
      happened_on: 'text', done_at: 'text', created_at: 'text',
    },
    pk: ['id'],
    autoId: true,
    ownerCols: ['created_by'],
    select: couple,
    insert: isMine('created_by'),
    update: { where: couple, check: inCouple, columns: ['ciphertext', 'nonce', 'happened_on', 'done_at'] },
    delete: couple,
    live: true,
  },
};
