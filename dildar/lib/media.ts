/**
 * Encrypted media pipeline. Files are sealed on-device with the couple key,
 * uploaded as opaque bytes, and decrypted in memory on the other phone.
 * Images render from a data: URI (never written to disk in plaintext);
 * video/audio need a file, so they go to a temp dir that is wiped after use.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { openBytes, sealBytes, toB64 } from './crypto';
import { uuid } from './ids';
import { supabase, type Bucket } from './supabase';

export type UploadResult = { path: string; nonce: string };

export async function readFileBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

export async function encryptAndUpload(
  bucket: Bucket,
  coupleId: string,
  source: string | Uint8Array,
  key: Uint8Array,
): Promise<UploadResult> {
  const plain = typeof source === 'string' ? await readFileBytes(source) : source;
  const { cipher, nonce } = sealBytes(plain, key);
  const path = `${coupleId}/${uuid()}`;
  const { error } = await supabase.storage.from(bucket).upload(path, cipher.buffer as ArrayBuffer, {
    contentType: 'application/octet-stream',
    upsert: false,
  });
  if (error) throw error;
  return { path, nonce };
}

const tmpDir = () => new Directory(Paths.cache, 'dildar-tmp');

/** Downloads ciphertext (to cache), decrypts in memory, deletes the cipher file. */
export async function downloadAndDecrypt(bucket: Bucket, path: string, nonce: string, key: Uint8Array): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data) throw error ?? new Error('no_url');
  const dir = tmpDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `${uuid()}.bin`);
  const file = await File.downloadFileAsync(data.signedUrl, target);
  try {
    const cipher = await file.bytes();
    return openBytes(cipher, nonce, key);
  } finally {
    try {
      file.delete();
    } catch {
      // already gone
    }
  }
}

export function bytesToDataUri(bytes: Uint8Array, mime = 'image/jpeg'): string {
  return `data:${mime};base64,${toB64(bytes)}`;
}

/** Plaintext temp file for players that need a file URI. Call wipeTemp() after. */
export async function writeTempFile(bytes: Uint8Array, ext: string): Promise<string> {
  const dir = tmpDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const f = new File(dir, `${uuid()}.${ext}`);
  f.create({ overwrite: true });
  await f.write(bytes);
  return f.uri;
}

export function deleteTempFile(uri: string): void {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // ignore
  }
}

export function wipeTemp(): void {
  try {
    const d = tmpDir();
    if (d.exists) d.delete();
  } catch {
    // ignore
  }
}

export async function removeObjects(bucket: Bucket, paths: string[]): Promise<void> {
  if (paths.length) await supabase.storage.from(bucket).remove(paths);
}

// Small LRU of decrypted image data URIs so chat scrolling stays smooth.
const LRU_MAX = 40;
const lru = new Map<string, string>();
export function cacheGet(id: string): string | undefined {
  const v = lru.get(id);
  if (v) {
    lru.delete(id);
    lru.set(id, v);
  }
  return v;
}
export function cachePut(id: string, v: string): void {
  lru.set(id, v);
  if (lru.size > LRU_MAX) lru.delete(lru.keys().next().value as string);
}
export function cacheClear(): void {
  lru.clear();
}

/** Hook-free helper: decrypt an image (with cache) to a data URI. */
export async function loadEncryptedImage(bucket: Bucket, path: string, nonce: string, key: Uint8Array, mime = 'image/jpeg'): Promise<string> {
  const hit = cacheGet(path);
  if (hit) return hit;
  const uri = bytesToDataUri(await downloadAndDecrypt(bucket, path, nonce, key), mime);
  cachePut(path, uri);
  return uri;
}
