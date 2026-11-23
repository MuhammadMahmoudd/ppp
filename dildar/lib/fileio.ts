/** Native (iOS) file I/O used by lib/media.ts. Web version: fileio.web.ts. */
import { Directory, File, Paths } from 'expo-file-system';
import { uuid } from './ids';
import { api, type Bucket } from './api';

const tmpDir = () => new Directory(Paths.cache, 'dildar-tmp');

export async function readFileBytes(uri: string): Promise<Uint8Array> {
  return new File(uri).bytes();
}

/** Downloads the ciphertext via a short-lived signed URL; the cipher file is deleted right after reading. */
export async function downloadCipher(bucket: Bucket, path: string): Promise<Uint8Array> {
  const { data, error } = await api.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data) throw error ?? new Error('no_url');
  const dir = tmpDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const file = await File.downloadFileAsync(data.signedUrl, new File(dir, `${uuid()}.bin`));
  try {
    return await file.bytes();
  } finally {
    try {
      file.delete();
    } catch {
      // already gone
    }
  }
}

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
