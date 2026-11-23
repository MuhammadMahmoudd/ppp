/** Vault mutations: add (encrypt → upload → row), delete (with agreement), albums. */
import * as ImagePicker from 'expo-image-picker';
import { sealJSON, sealString } from '@/lib/crypto';
import { encryptAndUpload, removeObjects } from '@/lib/media';
import { notifyPartner } from '@/lib/push';
import { api } from '@/lib/api';
import type { VaultMeta } from './useVault';

type Ctx = { coupleId: string; key: Uint8Array };

export async function addVaultFile(ctx: Ctx, uri: string, kind: 'image' | 'video' | 'voice', meta: VaultMeta, albumId: string | null): Promise<void> {
  const up = await encryptAndUpload('vault', ctx.coupleId, uri, ctx.key);
  const m = sealJSON(meta, ctx.key);
  const { error } = await api.from('vault_items').insert({
    couple_id: ctx.coupleId,
    kind,
    storage_path: up.path,
    nonce: up.nonce,
    meta_ciphertext: m.c,
    meta_nonce: m.n,
    album_id: albumId,
  });
  if (error) {
    await removeObjects('vault', [up.path]).catch(() => undefined);
    throw error;
  }
}

/** Picks photos/videos (never touches the camera roll) and stores them encrypted. */
export async function addFromLibrary(ctx: Ctx, albumId: string | null, onProgress?: (done: number, total: number) => void): Promise<number> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.85, allowsMultipleSelection: true, selectionLimit: 10 });
  if (r.canceled) return 0;
  let done = 0;
  for (const a of r.assets) {
    const kind = a.type === 'video' ? 'video' : 'image';
    const ext = (a.uri.split('.').pop() ?? (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase();
    await addVaultFile(ctx, a.uri, kind, { mime: a.mimeType ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg'), ext, w: a.width, h: a.height, duration: a.duration ?? undefined }, albumId);
    onProgress?.(++done, r.assets.length);
  }
  if (done) notifyPartner('vault');
  return done;
}

export type DeleteOutcome = 'deleted' | 'requested';

/** Deletes now, or records a request when "both must agree" is on. */
export async function deleteVaultItem(itemId: string): Promise<DeleteOutcome> {
  const { data, error } = await api.rpc('vault_delete', { p_item: itemId });
  if (error) throw error;
  if (!data) {
    notifyPartner('vault');
    return 'requested';
  }
  await removeObjects('vault', data).catch(() => undefined);
  return 'deleted';
}

export async function cancelDeleteRequest(itemId: string): Promise<void> {
  await api.from('vault_delete_requests').delete().eq('item_id', itemId);
}

export async function createAlbum(ctx: Ctx, name: string): Promise<void> {
  const n = sealString(name.trim().slice(0, 60), ctx.key);
  const { error } = await api.from('vault_albums').insert({ couple_id: ctx.coupleId, name_ciphertext: n.c, name_nonce: n.n });
  if (error) throw error;
}

export async function moveToAlbum(itemId: string, albumId: string | null): Promise<void> {
  const { error } = await api.from('vault_items').update({ album_id: albumId }).eq('id', itemId);
  if (error) throw error;
}
