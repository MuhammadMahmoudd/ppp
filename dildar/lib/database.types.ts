/**
 * Hand-written types matching supabase/migrations. Once your project exists
 * you can regenerate with:
 *   npx supabase gen types typescript --project-id <ref> > lib/database.types.ts
 * (keep the Row aliases at the bottom).
 */
type Table<R, Req extends keyof R = never> = {
  Row: R;
  Insert: Partial<R> & Pick<R, Req>;
  Update: Partial<R>;
  Relationships: [];
};
type Fn<Args, Ret> = { Args: Args; Returns: Ret };

type ts = string; // timestamptz ISO string
type date = string; // YYYY-MM-DD
type uuid = string;

export type CoupleRow = {
  id: uuid; created_at: ts; home_timezone: string; anniversary: date | null;
  adult_confirmed_a: boolean; adult_confirmed_b: boolean;
  spicy_enabled_a: boolean; spicy_enabled_b: boolean;
  streak_count: number; streak_best: number; streak_last_day: date | null; streak_warned_day: date | null;
  streak_freezes_left: number; streak_freeze_month: string | null;
  question_streak: number; question_last_day: date | null;
  game_streak: number; game_last_day: date | null;
  couple_xp: number;
  chat_disappear_mode: 'off' | 'view' | '24h';
  vault_delete_protection: boolean;
};
export type MemberRow = { couple_id: uuid; user_id: uuid; role: 'a' | 'b'; joined_at: ts };
export type ProfileRow = {
  user_id: uuid; display_name: string; avatar_path: string | null; avatar_nonce: string | null;
  timezone: string; public_key: string | null; birthday: date | null; locale: 'ckb' | 'en';
  created_at: ts; updated_at: ts;
};
export type DeviceRow = { user_id: uuid; push_token: string | null; push_previews: boolean; updated_at: ts };
export type InviteRow = { id: uuid; code: string; couple_id: uuid; created_by: uuid; created_at: ts; expires_at: ts; used_at: ts | null; used_by: uuid | null };
export type KeyBackupRow = { user_id: uuid; public_key: string; salt: string; nonce: string; ciphertext: string; kdf: string; iterations: number; updated_at: ts };

export type MessageType =
  | 'text' | 'image' | 'video' | 'voice' | 'game_result' | 'dare' | 'tonight'
  | 'miss_you' | 'touch' | 'screenshot' | 'system' | 'snap' | 'envelope' | 'streak';
export type DisappearMode = 'off' | 'view' | '24h';
export type MessageRow = {
  id: uuid; couple_id: uuid; sender_id: uuid; type: MessageType;
  ciphertext: string | null; nonce: string | null; media_path: string | null; media_nonce: string | null;
  reply_to: uuid | null; disappear_mode: DisappearMode; meta: Record<string, unknown>;
  created_at: ts; seen_at: ts | null; expires_at: ts | null; deleted_at: ts | null;
};
export type ReactionRow = { message_id: uuid; user_id: uuid; couple_id: uuid; emoji: string; created_at: ts };
export type SnapRow = {
  id: uuid; couple_id: uuid; sender_id: uuid; storage_path: string | null; nonce: string;
  meta_ciphertext: string | null; meta_nonce: string | null; media_kind: 'image' | 'video';
  duration: 0 | 3 | 5 | 10; allow_save: boolean; spicy_blur: boolean; view_once: boolean;
  proof_for: uuid | null; created_at: ts; opened_at: ts | null; expires_at: ts;
};
export type ScreenshotContext = 'snap' | 'vault' | 'spicy' | 'chat' | 'game';
export type ScreenshotRow = { id: uuid; couple_id: uuid; user_id: uuid; context: ScreenshotContext; target_id: uuid | null; created_at: ts };
export type StreakDayRow = { couple_id: uuid; day: date; a_sent: boolean; b_sent: boolean; completed: boolean; frozen: boolean };

export type DeckKind =
  | 'truth' | 'dare' | 'forfeit' | 'would_you_rather' | 'roleplay_setting' | 'roleplay_character'
  | 'roleplay_goal' | 'dice' | 'tease' | 'know_me' | 'general';
export type DeckRow = { id: uuid; couple_id: uuid; owner_id: uuid; kind: DeckKind; name_ciphertext: string; name_nonce: string; is_shared: boolean; created_at: ts };
export type Heat = 1 | 2 | 3 | 4;
export type CardRow = { id: uuid; deck_id: uuid; couple_id: uuid; owner_id: uuid; heat: Heat; category: string; text_ciphertext: string; nonce: string; is_shared: boolean; created_at: ts };
export type GameType = 'truth_dare' | 'dice' | 'would_you_rather' | 'strip' | 'roleplay' | 'tease_timer' | 'know_me';
export type GameStatus = 'invited' | 'active' | 'finished' | 'cancelled';
export type GameSessionRow = {
  id: uuid; couple_id: uuid; game_type: GameType; state_ciphertext: string | null; state_nonce: string | null;
  version: number; turn_user_id: uuid | null; status: GameStatus; created_by: uuid; created_at: ts; updated_at: ts;
};
export type YnmAnswer = 'yes' | 'no' | 'maybe';
export type YnmItemRow = { id: uuid; couple_id: uuid; created_by: uuid; category: string; text_ciphertext: string; nonce: string; created_at: ts };
export type YnmAnswerRow = { user_id: uuid; couple_id: uuid; item_key: string; answer: YnmAnswer; updated_at: ts };
export type TrySoonRow = { couple_id: uuid; item_key: string; added_by: uuid; added_at: ts; done_at: ts | null };
export type CheckinRow = { user_id: uuid; couple_id: uuid; at: ts };
export type BodyMapRow = { user_id: uuid; couple_id: uuid; side: 'mine' | 'yours'; area: string; intensity: 1 | 2 | 3; updated_at: ts };
export type FantasyRow = { id: uuid; couple_id: uuid; author_id: uuid; category: string; heat: Heat; text_ciphertext: string; nonce: string; partner_interested: boolean; interested_at: ts | null; created_at: ts };
export type FantasyListRow = { id: uuid; is_mine: boolean; category: string; heat: Heat; revealed: boolean; text_ciphertext: string | null; nonce: string | null; created_at: ts };

export type VaultAlbumRow = { id: uuid; couple_id: uuid; created_by: uuid; name_ciphertext: string; name_nonce: string; created_at: ts };
export type VaultItemRow = {
  id: uuid; couple_id: uuid; uploader_id: uuid; album_id: uuid | null; kind: 'image' | 'video' | 'voice';
  storage_path: string; nonce: string; thumb_path: string | null; thumb_nonce: string | null;
  meta_ciphertext: string | null; meta_nonce: string | null; created_at: ts;
};
export type VaultDeleteRequestRow = { item_id: uuid; couple_id: uuid; requested_by: uuid; requested_at: ts };
export type ScheduledItemRow = {
  id: uuid; couple_id: uuid; sender_id: uuid; kind: 'message' | 'snap'; message_type: MessageType;
  payload_ciphertext: string | null; nonce: string | null; media_path: string | null; media_nonce: string | null;
  deliver_at: ts; delivered_at: ts | null; created_at: ts;
};
export type EnvelopeRow = { id: uuid; couple_id: uuid; author_id: uuid; kind: 'date' | 'when'; title_ciphertext: string; title_nonce: string; unlock_at: ts | null; opened_at: ts | null; created_at: ts };
export type EnvelopeContentRow = { envelope_id: uuid; couple_id: uuid; ciphertext: string; nonce: string };
export type CountdownRow = { id: uuid; couple_id: uuid; created_by: uuid; title_ciphertext: string | null; title_nonce: string | null; target_at: ts; created_at: ts };
export type PlanItemRow = { id: uuid; countdown_id: uuid; couple_id: uuid; author_id: uuid; ciphertext: string; nonce: string; created_at: ts };
export type DailyAnswerRow = { couple_id: uuid; user_id: uuid; day: date; pool: 'sweet' | 'spicy'; question_idx: number; ciphertext: string; nonce: string; created_at: ts };
export type MissYouRow = { id: uuid; couple_id: uuid; sender_id: uuid; created_at: ts };
export type SharedItemRow = { id: uuid; couple_id: uuid; created_by: uuid; kind: 'bucket' | 'coupon' | 'memory'; ciphertext: string; nonce: string; happened_on: date | null; done_at: ts | null; created_at: ts };

export type Database = {
  __InternalSupabase: { PostgrestVersion: '12' };
  public: {
    Tables: {
      couples: Table<CoupleRow>;
      couple_members: Table<MemberRow>;
      profiles: Table<ProfileRow, 'user_id'>;
      devices: Table<DeviceRow, 'user_id'>;
      invites: Table<InviteRow>;
      key_backups: Table<KeyBackupRow, 'user_id' | 'public_key' | 'salt' | 'nonce' | 'ciphertext' | 'iterations'>;
      messages: Table<MessageRow, 'id' | 'couple_id' | 'type'>;
      message_reactions: Table<ReactionRow, 'message_id' | 'couple_id' | 'emoji'>;
      snaps: Table<SnapRow, 'id' | 'couple_id' | 'nonce' | 'media_kind'>;
      screenshot_events: Table<ScreenshotRow, 'couple_id' | 'context'>;
      streak_days: Table<StreakDayRow>;
      decks: Table<DeckRow, 'couple_id' | 'kind' | 'name_ciphertext' | 'name_nonce'>;
      cards: Table<CardRow, 'deck_id' | 'couple_id' | 'text_ciphertext' | 'nonce'>;
      game_sessions: Table<GameSessionRow, 'couple_id' | 'game_type'>;
      ynm_items: Table<YnmItemRow, 'couple_id' | 'text_ciphertext' | 'nonce'>;
      ynm_answers: Table<YnmAnswerRow, 'couple_id' | 'item_key' | 'answer'>;
      ynm_try_soon: Table<TrySoonRow, 'couple_id' | 'item_key'>;
      boundary_checkins: Table<CheckinRow, 'couple_id'>;
      body_map_answers: Table<BodyMapRow, 'couple_id' | 'side' | 'area' | 'intensity'>;
      fantasies: Table<FantasyRow, 'couple_id' | 'text_ciphertext' | 'nonce'>;
      vault_albums: Table<VaultAlbumRow, 'couple_id' | 'name_ciphertext' | 'name_nonce'>;
      vault_items: Table<VaultItemRow, 'couple_id' | 'kind' | 'storage_path' | 'nonce'>;
      vault_delete_requests: Table<VaultDeleteRequestRow, 'item_id' | 'couple_id'>;
      scheduled_items: Table<ScheduledItemRow, 'couple_id' | 'deliver_at'>;
      envelopes: Table<EnvelopeRow, 'couple_id' | 'kind' | 'title_ciphertext' | 'title_nonce'>;
      envelope_contents: Table<EnvelopeContentRow, 'envelope_id' | 'couple_id' | 'ciphertext' | 'nonce'>;
      countdowns: Table<CountdownRow, 'couple_id' | 'target_at'>;
      plan_items: Table<PlanItemRow, 'countdown_id' | 'couple_id' | 'ciphertext' | 'nonce'>;
      daily_answers: Table<DailyAnswerRow, 'couple_id' | 'day' | 'pool' | 'question_idx' | 'ciphertext' | 'nonce'>;
      miss_you_events: Table<MissYouRow, 'couple_id'>;
      shared_items: Table<SharedItemRow, 'couple_id' | 'kind' | 'ciphertext' | 'nonce'>;
    };
    Views: Record<string, never>;
    Functions: {
      create_couple: Fn<{ adult_confirmed: boolean }, uuid>;
      create_invite: Fn<Record<string, never>, { code: string; expires_at: ts }[]>;
      redeem_invite: Fn<{ invite_code: string; adult_confirmed: boolean }, uuid | null>;
      set_spicy: Fn<{ enabled: boolean }, boolean>;
      update_couple_settings: Fn<{
        p_home_timezone?: string; p_anniversary?: date; p_chat_disappear_mode?: DisappearMode; p_vault_delete_protection?: boolean;
      }, undefined>;
      my_couple_id: Fn<Record<string, never>, uuid | null>;
      partner_id: Fn<Record<string, never>, uuid | null>;
      mark_messages_seen: Fn<Record<string, never>, number>;
      delete_message: Fn<{ message_id: uuid }, string | null>;
      complete_dare: Fn<{ message_id: uuid; proof_message_id?: uuid }, undefined>;
      answer_signal: Fn<{ message_id: uuid; answer: 'yes' | 'no' }, undefined>;
      use_streak_freeze: Fn<Record<string, never>, number>;
      set_deck_shared: Fn<{ p_deck: uuid; p_shared: boolean }, undefined>;
      game_apply: Fn<{
        p_id: uuid; p_expected_version: number; p_state_ciphertext: string; p_state_nonce: string;
        p_turn_user_id?: uuid; p_status?: GameStatus;
      }, GameSessionRow>;
      ynm_matches: Fn<Record<string, never>, { item_key: string; my_answer: YnmAnswer; partner_answer: YnmAnswer }[]>;
      body_map_matches: Fn<Record<string, never>, { area: string; kind: 'on_me' | 'on_you'; intensity: number }[]>;
      list_fantasies: Fn<Record<string, never>, FantasyListRow[]>;
      fantasy_interest: Fn<{ p_id: uuid; p_interested: boolean }, undefined>;
      vault_delete: Fn<{ p_item: uuid }, string[] | null>;
      open_envelope: Fn<{ p_id: uuid }, undefined>;
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
