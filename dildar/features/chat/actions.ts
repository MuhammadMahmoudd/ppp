/** Chat actions: send text/media/voice, react, delete, dares, signals. */
import { Alert } from 'react-native';
import { postMessage, type MessageBody } from '@/lib/messages';
import { encryptAndUpload, removeObjects } from '@/lib/media';
import { supabase } from '@/lib/supabase';
import { haptic } from '@/lib/haptics';
import { uuid } from '@/lib/ids';
import { broadcast } from '@/lib/realtime';
import { createStore, useStore } from '@/lib/store';
import { currentStrings } from '@/lib/i18n';
import type { DisappearMode, MessageType } from '@/lib/database.types';

export type ChatCtx = { coupleId: string; userId: string; key: Uint8Array };

/** Local plaintext previews for media I just sent (never persisted). */
const localMedia = new Map<string, string>();
export const localMediaUri = (id: string) => localMedia.get(id);

/** Media still uploading (shown as optimistic bubbles before postMessage). */
export type PendingUpload = { id: string; kind: 'image' | 'video' | 'voice'; uri: string; created_at: string; failed: boolean; retry: () => void };
export const uploadsStore = createStore<PendingUpload[]>([]);
export const useUploads = () => useStore(uploadsStore);

export async function sendText(ctx: ChatCtx, text: string, opts: { replyTo?: string | null; disappear: DisappearMode }) {
  const t = text.trim();
  if (!t) return;
  haptic.send();
  broadcast('typing', { on: false });
  await postMessage({
    coupleId: ctx.coupleId, senderId: ctx.userId, key: ctx.key, type: 'text',
    body: { t: 'text', text: t }, replyTo: opts.replyTo ?? null, disappear: opts.disappear,
  });
}

export async function sendMedia(
  ctx: ChatCtx,
  m: { uri: string; kind: 'image' | 'video' | 'voice'; mime: string; width?: number; height?: number; duration?: number; waveform?: number[] },
  opts: { replyTo?: string | null; disappear: DisappearMode; extraMeta?: Record<string, unknown> },
): Promise<string | null> {
  const id = uuid();
  localMedia.set(id, m.uri);
  haptic.send();
  const attempt = async (): Promise<string | null> => {
    uploadsStore.set((u) => [
      ...u.filter((x) => x.id !== id),
      { id, kind: m.kind, uri: m.uri, created_at: new Date().toISOString(), failed: false, retry: () => { attempt(); } },
    ]);
    try {
      const up = await encryptAndUpload('chat-media', ctx.coupleId, m.uri, ctx.key);
      const type: MessageType = m.kind;
      const body: MessageBody =
        m.kind === 'image' ? { t: 'image', mime: m.mime, w: m.width, h: m.height }
        : m.kind === 'video' ? { t: 'video', mime: m.mime, duration: m.duration }
        : { t: 'voice', duration: m.duration ?? 0, waveform: m.waveform };
      await postMessage({
        id, coupleId: ctx.coupleId, senderId: ctx.userId, key: ctx.key, type, body,
        media: up, replyTo: opts.replyTo ?? null, disappear: opts.disappear,
      });
      uploadsStore.set((u) => u.filter((x) => x.id !== id));
      return id;
    } catch {
      uploadsStore.set((u) => u.map((x) => (x.id === id ? { ...x, failed: true } : x)));
      return null;
    }
  };
  return attempt();
}

export function dismissUpload(id: string) {
  uploadsStore.set((u) => u.filter((x) => x.id !== id));
}

export async function react(ctx: ChatCtx, messageId: string, emoji: string, current?: string | null) {
  haptic.tap();
  if (current === emoji) {
    await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', ctx.userId);
    return;
  }
  await supabase
    .from('message_reactions')
    .upsert({ message_id: messageId, user_id: ctx.userId, couple_id: ctx.coupleId, emoji }, { onConflict: 'message_id,user_id' });
}

export function confirmDelete(messageId: string, onDone?: () => void) {
  const s = currentStrings();
  Alert.alert(s.chat.deleteForBoth, s.chat.deleteConfirm, [
    { text: s.common.cancel, style: 'cancel' },
    {
      text: s.common.delete,
      style: 'destructive',
      onPress: async () => {
        const { data, error } = await supabase.rpc('delete_message', { message_id: messageId });
        if (!error) {
          haptic.success();
          if (data) removeObjects('chat-media', [data]).catch(() => undefined);
          onDone?.();
        } else haptic.error();
      },
    },
  ]);
}

export async function completeDare(messageId: string, proofMessageId?: string | null) {
  const { error } = await supabase.rpc('complete_dare', proofMessageId ? { message_id: messageId, proof_message_id: proofMessageId } : { message_id: messageId });
  if (error) haptic.error();
  else haptic.success();
}

export async function answerTonight(messageId: string, answer: 'yes' | 'no') {
  const { error } = await supabase.rpc('answer_signal', { message_id: messageId, answer });
  if (error) haptic.error();
  else haptic.success();
}
