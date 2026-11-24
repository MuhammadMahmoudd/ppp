-- ═══════════════════════════════════════════════════════════════════════════
-- دڵدار (Dildar) — Cloudflare D1 schema (SQLite).
-- Access rules live in the Worker (server/src/tables.ts); the hard invariants
-- that must never break are also enforced here with triggers/constraints.
-- Times are ISO-8601 UTC strings ("2026-11-23T10:00:00.000Z").
-- Booleans are 0/1. All private content columns hold tweetnacl ciphertext.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── auth ──────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  iterations    INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at  TEXT NOT NULL
);
CREATE INDEX sessions_user ON sessions(user_id);

CREATE TABLE login_attempts (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  email  TEXT NOT NULL COLLATE NOCASE,
  at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX login_attempts_email_at ON login_attempts(email, at);

-- ─── couples ───────────────────────────────────────────────────────────────
CREATE TABLE couples (
  id                      TEXT PRIMARY KEY,
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  home_timezone           TEXT NOT NULL DEFAULT 'Asia/Baghdad',
  anniversary             TEXT,
  adult_confirmed_a       INTEGER NOT NULL DEFAULT 0,
  adult_confirmed_b       INTEGER NOT NULL DEFAULT 0,
  spicy_enabled_a         INTEGER NOT NULL DEFAULT 0,
  spicy_enabled_b         INTEGER NOT NULL DEFAULT 0,
  streak_count            INTEGER NOT NULL DEFAULT 0,
  streak_best             INTEGER NOT NULL DEFAULT 0,
  streak_last_day         TEXT,
  streak_warned_day       TEXT,
  streak_freezes_left     INTEGER NOT NULL DEFAULT 1,
  streak_freeze_month     TEXT,
  question_streak         INTEGER NOT NULL DEFAULT 0,
  question_last_day       TEXT,
  game_streak             INTEGER NOT NULL DEFAULT 0,
  game_last_day           TEXT,
  couple_xp               INTEGER NOT NULL DEFAULT 0,
  chat_disappear_mode     TEXT NOT NULL DEFAULT 'off' CHECK (chat_disappear_mode IN ('off','view','24h')),
  vault_delete_protection INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE couple_members (
  couple_id  TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('a','b')),
  joined_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (couple_id, user_id),
  UNIQUE (couple_id, role)
);

-- Two members per couple, ever. Enforced by the database itself.
CREATE TRIGGER couple_members_max_two
BEFORE INSERT ON couple_members
WHEN (SELECT count(*) FROM couple_members WHERE couple_id = NEW.couple_id) >= 2
BEGIN SELECT RAISE(ABORT, 'couple_full'); END;

CREATE TRIGGER couple_members_immutable
BEFORE UPDATE ON couple_members
BEGIN SELECT RAISE(ABORT, 'member_immutable'); END;

-- ─── profiles / devices / invites / keys ───────────────────────────────────
CREATE TABLE profiles (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name  TEXT NOT NULL DEFAULT '' CHECK (length(display_name) <= 60),
  avatar_path   TEXT,
  avatar_nonce  TEXT,
  timezone      TEXT NOT NULL DEFAULT 'Asia/Baghdad',
  public_key    TEXT,
  birthday      TEXT,
  locale        TEXT NOT NULL DEFAULT 'ckb' CHECK (locale IN ('ckb','en')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE devices (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  push_token     TEXT,
  push_previews  INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE invites (
  id          TEXT PRIMARY KEY,
  code        TEXT NOT NULL CHECK (length(code) = 6),
  couple_id   TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  created_by  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  used_by     TEXT REFERENCES users(id)
);
CREATE UNIQUE INDEX invites_active_code ON invites(code) WHERE used_at IS NULL;

CREATE TABLE invite_attempts (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX invite_attempts_user_at ON invite_attempts(user_id, at);

CREATE TABLE key_backups (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_key  TEXT NOT NULL,
  salt        TEXT NOT NULL,
  nonce       TEXT NOT NULL,
  ciphertext  TEXT NOT NULL,
  kdf         TEXT NOT NULL DEFAULT 'pbkdf2-sha512',
  iterations  INTEGER NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ─── chat ──────────────────────────────────────────────────────────────────
CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  couple_id       TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('text','image','video','voice','game_result','dare','tonight',
                    'miss_you','touch','screenshot','system','snap','envelope','streak')),
  ciphertext      TEXT,
  nonce           TEXT,
  media_path      TEXT,
  media_nonce     TEXT,
  reply_to        TEXT REFERENCES messages(id) ON DELETE SET NULL,
  disappear_mode  TEXT NOT NULL DEFAULT 'off' CHECK (disappear_mode IN ('off','view','24h')),
  meta            TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  seen_at         TEXT,
  expires_at      TEXT,
  deleted_at      TEXT
);
CREATE INDEX messages_couple_created ON messages(couple_id, created_at DESC);
CREATE INDEX messages_expires ON messages(expires_at) WHERE expires_at IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE message_reactions (
  message_id  TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  couple_id   TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  emoji       TEXT NOT NULL CHECK (length(emoji) <= 16),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX reactions_couple ON message_reactions(couple_id);

-- ─── snaps + streaks ───────────────────────────────────────────────────────
CREATE TABLE snaps (
  id              TEXT PRIMARY KEY,
  couple_id       TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path    TEXT,
  nonce           TEXT NOT NULL,
  meta_ciphertext TEXT,
  meta_nonce      TEXT,
  media_kind      TEXT NOT NULL CHECK (media_kind IN ('image','video')),
  duration        INTEGER NOT NULL DEFAULT 5 CHECK (duration IN (0,3,5,10)),
  allow_save      INTEGER NOT NULL DEFAULT 0,
  spicy_blur      INTEGER NOT NULL DEFAULT 0,
  view_once       INTEGER NOT NULL DEFAULT 1,
  proof_for       TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  opened_at       TEXT,
  expires_at      TEXT NOT NULL
);
CREATE INDEX snaps_couple_created ON snaps(couple_id, created_at DESC);

CREATE TABLE screenshot_events (
  id          TEXT PRIMARY KEY,
  couple_id   TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  context     TEXT NOT NULL CHECK (context IN ('snap','vault','spicy','chat','game')),
  target_id   TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE streak_days (
  couple_id   TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  day         TEXT NOT NULL,
  a_sent      INTEGER NOT NULL DEFAULT 0,
  b_sent      INTEGER NOT NULL DEFAULT 0,
  completed   INTEGER NOT NULL DEFAULT 0,
  frozen      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (couple_id, day)
);

-- ─── decks / games ─────────────────────────────────────────────────────────
CREATE TABLE decks (
  id               TEXT PRIMARY KEY,
  couple_id        TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  owner_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('truth','dare','forfeit','would_you_rather','roleplay_setting',
                     'roleplay_character','roleplay_goal','dice','tease','know_me','general')),
  name_ciphertext  TEXT NOT NULL,
  name_nonce       TEXT NOT NULL,
  is_shared        INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX decks_couple ON decks(couple_id);

CREATE TABLE cards (
  id               TEXT PRIMARY KEY,
  deck_id          TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  couple_id        TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  owner_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  heat             INTEGER NOT NULL DEFAULT 1 CHECK (heat BETWEEN 1 AND 4),
  category         TEXT NOT NULL DEFAULT 'general' CHECK (length(category) <= 40),
  text_ciphertext  TEXT NOT NULL,
  nonce            TEXT NOT NULL,
  is_shared        INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX cards_deck ON cards(deck_id);

CREATE TABLE game_sessions (
  id                TEXT PRIMARY KEY,
  couple_id         TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  game_type         TEXT NOT NULL CHECK (game_type IN ('truth_dare','dice','would_you_rather','strip','roleplay','tease_timer','know_me')),
  state_ciphertext  TEXT,
  state_nonce       TEXT,
  version           INTEGER NOT NULL DEFAULT 0,
  turn_user_id      TEXT REFERENCES users(id),
  status            TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','finished','cancelled')),
  created_by        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX game_sessions_couple ON game_sessions(couple_id, created_at DESC);

-- ─── spicy hub (private answers: author-only, matched server-side) ─────────
CREATE TABLE ynm_items (
  id               TEXT PRIMARY KEY,
  couple_id        TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  created_by       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category         TEXT NOT NULL DEFAULT 'custom',
  text_ciphertext  TEXT NOT NULL,
  nonce            TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE ynm_answers (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  couple_id   TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  item_key    TEXT NOT NULL CHECK (length(item_key) <= 64),
  answer      TEXT NOT NULL CHECK (answer IN ('yes','no','maybe')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, item_key)
);

CREATE TABLE ynm_try_soon (
  couple_id   TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  item_key    TEXT NOT NULL,
  added_by    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  done_at     TEXT,
  PRIMARY KEY (couple_id, item_key)
);

CREATE TABLE boundary_checkins (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  couple_id  TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, at)
);

CREATE TABLE body_map_answers (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  couple_id   TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  side        TEXT NOT NULL CHECK (side IN ('mine','yours')),
  area        TEXT NOT NULL CHECK (length(area) <= 32),
  intensity   INTEGER NOT NULL CHECK (intensity BETWEEN 1 AND 3),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (user_id, side, area)
);

CREATE TABLE fantasies (
  id                 TEXT PRIMARY KEY,
  couple_id          TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  author_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category           TEXT NOT NULL DEFAULT 'general',
  heat               INTEGER NOT NULL DEFAULT 2 CHECK (heat BETWEEN 1 AND 4),
  text_ciphertext    TEXT NOT NULL,
  nonce              TEXT NOT NULL,
  partner_interested INTEGER NOT NULL DEFAULT 0,
  interested_at      TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ─── vault ─────────────────────────────────────────────────────────────────
CREATE TABLE vault_albums (
  id               TEXT PRIMARY KEY,
  couple_id        TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  created_by       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name_ciphertext  TEXT NOT NULL,
  name_nonce       TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE vault_items (
  id               TEXT PRIMARY KEY,
  couple_id        TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  uploader_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  album_id         TEXT REFERENCES vault_albums(id) ON DELETE SET NULL,
  kind             TEXT NOT NULL CHECK (kind IN ('image','video','voice')),
  storage_path     TEXT NOT NULL,
  nonce            TEXT NOT NULL,
  thumb_path       TEXT,
  thumb_nonce      TEXT,
  meta_ciphertext  TEXT,
  meta_nonce       TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX vault_items_couple ON vault_items(couple_id, created_at DESC);

CREATE TABLE vault_delete_requests (
  item_id       TEXT PRIMARY KEY REFERENCES vault_items(id) ON DELETE CASCADE,
  couple_id     TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  requested_by  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ─── closeness ─────────────────────────────────────────────────────────────
CREATE TABLE scheduled_items (
  id                  TEXT PRIMARY KEY,
  couple_id           TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  sender_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL DEFAULT 'message' CHECK (kind IN ('message','snap')),
  message_type        TEXT NOT NULL DEFAULT 'text',
  payload_ciphertext  TEXT,
  nonce               TEXT,
  media_path          TEXT,
  media_nonce         TEXT,
  deliver_at          TEXT NOT NULL,
  delivered_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX scheduled_due ON scheduled_items(deliver_at) WHERE delivered_at IS NULL;

CREATE TABLE envelopes (
  id                TEXT PRIMARY KEY,
  couple_id         TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  author_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('date','when')),
  title_ciphertext  TEXT NOT NULL,
  title_nonce       TEXT NOT NULL,
  unlock_at         TEXT,
  opened_at         TEXT,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  CHECK (kind = 'when' OR unlock_at IS NOT NULL)
);

CREATE TABLE envelope_contents (
  envelope_id  TEXT PRIMARY KEY REFERENCES envelopes(id) ON DELETE CASCADE,
  couple_id    TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  ciphertext   TEXT NOT NULL,
  nonce        TEXT NOT NULL
);

CREATE TABLE countdowns (
  id                TEXT PRIMARY KEY,
  couple_id         TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  created_by        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_ciphertext  TEXT,
  title_nonce       TEXT,
  target_at         TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE plan_items (
  id            TEXT PRIMARY KEY,
  countdown_id  TEXT NOT NULL REFERENCES countdowns(id) ON DELETE CASCADE,
  couple_id     TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  author_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ciphertext    TEXT NOT NULL,
  nonce         TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE daily_answers (
  couple_id     TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day           TEXT NOT NULL,
  pool          TEXT NOT NULL CHECK (pool IN ('sweet','spicy')),
  question_idx  INTEGER NOT NULL,
  ciphertext    TEXT NOT NULL,
  nonce         TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (couple_id, user_id, day, pool)
);

CREATE TABLE miss_you_events (
  id          TEXT PRIMARY KEY,
  couple_id   TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX miss_you_couple ON miss_you_events(couple_id, created_at DESC);

CREATE TABLE shared_items (
  id           TEXT PRIMARY KEY,
  couple_id    TEXT NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('bucket','coupon','memory')),
  ciphertext   TEXT NOT NULL,
  nonce        TEXT NOT NULL,
  happened_on  TEXT,
  done_at      TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX shared_items_couple ON shared_items(couple_id, kind, created_at DESC);
