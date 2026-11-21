/**
 * The chat message contract shared by every feature.
 *
 * A message row stores an encrypted JSON `MessageBody` (ciphertext/nonce),
 * optional encrypted media (media_path/media_nonce in chat-media bucket) and
 * a small plaintext `meta` for structure the server must see (deadlines,
 * answered state, linked ids). NEVER put private text in `meta`.
 *
 * postMessage() is optimistic + offline-safe: the message appears in
 * `outboxStore` immediately and is inserted (idempotently, client id) by the
 * offline queue — now, or when the network returns.
 */
import { createStore, useStore } from './store';
import { enqueue, registerRunner } from './offlineQueue';
import { sealJSON, tryOpenJSON } from './crypto';
import { uuid } from './ids';
import { supabase } from './supabase';
import { notifyPartner, type PushKind } from './push';
import type { DisappearMode, GameType, Heat, MessageRow, MessageType } from './database.types';
import type { TouchPattern } from './haptics';

export type MessageBody =
  | { t: 'text'; text: string }
  | { t: 'image'; w?: number; h?: number; mime: string; caption?: string }
  | { t: 'video'; duration?: number; mime: string; caption?: string }
  | { t: 'voice'; duration: number; waveform?: number[] }
  | { t: 'game_result'; game: GameType; summary: string; sessionId?: string }
  | { t: 'dare'; text: string; heat: Heat; proof: 'snap' | 'voice' | null; deadline: string }
  | { t: 'tonight'; heat: Heat; note?: string }
  | { t: 'miss_you'; count?: number }
  | { t: 'touch'; pattern: TouchPattern }
  | { t: 'screenshot'; context: string }
  | { t: 'snap'; snapId: string; kind: 'image' | 'video' }
  | { t: 'envelope'; envelopeId: string; title: string }
  | { t: 'streak'; days: number }
  | { t: 'system'; text: string };

/** Plaintext meta keys by type (server-visible, non-sensitive). */
export type MessageMeta = {
  deadline?: string; // dare
  done_at?: string; // dare
  proof?: string | null; // dare → proof message id
  answer?: 'yes' | 'no'; // tonight
  answered_at?: string;
  snap_id?: string; // snap notice
  context?: string; // screenshot
  scheduled?: boolean;
  game_session?: string;
};

export type OutgoingMessage = {
  id: string;
  couple_id: string;
  sender_id: string;
  type: MessageType;
  ciphertext: string | null;
  nonce: string | null;
  media_path: string | null;
  media_nonce: string | null;
  reply_to: string | null;
  disappear_mode: DisappearMode;
  meta: MessageMeta;
  created_at: string;
  push: PushKind | null;
};

/** Pending (not yet confirmed) messages for optimistic rendering. */
export const outboxStore = createStore<OutgoingMessage[]>([]);
export const useOutbox = () => useStore(outboxStore);

const PUSH_FOR: Partial<Record<MessageType, PushKind>> = {
  text: 'message', image: 'message', video: 'message', voice: 'message',
  dare: 'dare', tonight: 'tonight', miss_you: 'miss_you', touch: 'touch',
  snap: 'snap', envelope: 'envelope', game_result: 'message', screenshot: 'screenshot',
};

registerRunner('message.insert', async (p) => {
  const m = p as unknown as OutgoingMessage;
  const { error } = await supabase.from('messages').upsert(
    {
      id: m.id, couple_id: m.couple_id, sender_id: m.sender_id, type: m.type,
      ciphertext: m.ciphertext, nonce: m.nonce, media_path: m.media_path, media_nonce: m.media_nonce,
      reply_to: m.reply_to, disappear_mode: m.disappear_mode, meta: m.meta,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) throw error;
  outboxStore.set((o) => o.filter((x) => x.id !== m.id));
  if (m.push) notifyPartner(m.push);
});

export type PostOptions = {
  coupleId: string;
  senderId: string;
  key: Uint8Array;
  type: MessageType;
  body: MessageBody;
  media?: { path: string; nonce: string } | null;
  replyTo?: string | null;
  disappear?: DisappearMode;
  meta?: MessageMeta;
  /** override push kind; null = no push */
  push?: PushKind | null;
  id?: string;
};

export async function postMessage(o: PostOptions): Promise<string> {
  const id = o.id ?? uuid();
  const sealed = sealJSON(o.body, o.key);
  const m: OutgoingMessage = {
    id,
    couple_id: o.coupleId,
    sender_id: o.senderId,
    type: o.type,
    ciphertext: sealed.c,
    nonce: sealed.n,
    media_path: o.media?.path ?? null,
    media_nonce: o.media?.nonce ?? null,
    reply_to: o.replyTo ?? null,
    disappear_mode: o.disappear ?? 'off',
    meta: o.meta ?? {},
    created_at: new Date().toISOString(),
    push: o.push === undefined ? PUSH_FOR[o.type] ?? null : o.push,
  };
  outboxStore.set((ob) => [...ob, m]);
  await enqueue('message.insert', id, m as unknown as Record<string, unknown>);
  return id;
}

export function decodeBody(row: Pick<MessageRow, 'ciphertext' | 'nonce'>, key: Uint8Array | null): MessageBody | null {
  return tryOpenJSON<MessageBody>(row.ciphertext, row.nonce, key);
}
