/**
 * Snap send pipeline: encrypt media on-device → private `snaps` bucket →
 * snaps row (ciphertext only) → chat notice message (+ discreet push).
 * Optimistic: the UI shows a "sending" pill from `sendStore` immediately.
 */
import { encryptAndUpload } from '@/lib/media';
import { sealJSON } from '@/lib/crypto';
import { uuid } from '@/lib/ids';
import { supabase } from '@/lib/supabase';
import { postMessage } from '@/lib/messages';
import { createStore, useStore } from '@/lib/store';
import { haptic } from '@/lib/haptics';
import { encodeOverlay, mimeFor, type SnapOverlay, type SnapMeta, type SnapTimer } from './overlay';

export type Capture = { uri: string; kind: 'image' | 'video'; width?: number; height?: number };

export type SnapOptions = {
  overlay: SnapOverlay;
  duration: SnapTimer;
  viewOnce: boolean;
  allowSave: boolean;
  spicyBlur: boolean;
  proofFor?: string | null;
};

export type SendCtx = { coupleId: string; userId: string; key: Uint8Array };

type SendJob = { id: string; status: 'sending' | 'sent' | 'failed'; retry: () => void };
export const sendStore = createStore<SendJob[]>([]);
export const useSendJobs = () => useStore(sendStore);

function setJob(id: string, patch: Partial<SendJob>) {
  sendStore.set((jobs) => jobs.map((j) => (j.id === id ? { ...j, ...patch } : j)));
}

/** Returns the chat message id of the snap notice (used as dare proof). */
export async function uploadSnap(ctx: SendCtx, cap: Capture, opts: SnapOptions, snapId: string): Promise<string> {
  const { mime, ext } = mimeFor(cap.uri, cap.kind);
  const up = await encryptAndUpload('snaps', ctx.coupleId, cap.uri, ctx.key);
  const meta: SnapMeta = { v: 1, mime, ext, w: cap.width, h: cap.height, overlay: encodeOverlay(opts.overlay) };
  const sealedMeta = sealJSON(meta, ctx.key);
  const { error } = await supabase.from('snaps').upsert(
    {
      id: snapId,
      couple_id: ctx.coupleId,
      sender_id: ctx.userId,
      storage_path: up.path,
      nonce: up.nonce,
      meta_ciphertext: sealedMeta.c,
      meta_nonce: sealedMeta.n,
      media_kind: cap.kind,
      duration: opts.duration,
      allow_save: opts.allowSave,
      spicy_blur: opts.spicyBlur,
      view_once: opts.viewOnce,
      proof_for: opts.proofFor ?? null,
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) {
    supabase.storage.from('snaps').remove([up.path]).catch(() => undefined);
    throw error;
  }
  const msgId = await postMessage({
    coupleId: ctx.coupleId,
    senderId: ctx.userId,
    key: ctx.key,
    type: 'snap',
    body: { t: 'snap', snapId, kind: cap.kind },
    meta: { snap_id: snapId },
  });
  if (opts.proofFor) {
    await supabase.rpc('complete_dare', { message_id: opts.proofFor, proof_message_id: msgId });
  }
  return msgId;
}

/** Fire-and-forget with a visible sending/failed state and retry. */
export function sendSnap(ctx: SendCtx, cap: Capture, opts: SnapOptions): Promise<string | null> {
  const snapId = uuid();
  const run = async (): Promise<string | null> => {
    setJob(snapId, { status: 'sending' });
    try {
      const id = await uploadSnap(ctx, cap, opts, snapId);
      setJob(snapId, { status: 'sent' });
      haptic.success();
      setTimeout(() => sendStore.set((j) => j.filter((x) => x.id !== snapId)), 1800);
      return id;
    } catch {
      setJob(snapId, { status: 'failed' });
      haptic.error();
      return null;
    }
  };
  sendStore.set((j) => [...j, { id: snapId, status: 'sending', retry: () => void run() }]);
  return run();
}

export function dismissJob(id: string) {
  sendStore.set((j) => j.filter((x) => x.id !== id));
}
