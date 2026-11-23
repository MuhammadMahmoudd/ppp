/**
 * Web file I/O for lib/media.ts. Decrypted media lives only in memory as
 * blob: URLs, which are revoked when the viewer closes.
 */
import { api, type Bucket } from './api';

const MIME: Record<string, string> = {
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  m4a: 'audio/mp4', aac: 'audio/aac', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic',
};
const live = new Set<string>();

export async function readFileBytes(uri: string): Promise<Uint8Array> {
  const res = await fetch(uri); // blob:/data: URIs from the picker, camera or recorder
  return new Uint8Array(await res.arrayBuffer());
}

export async function downloadCipher(bucket: Bucket, path: string): Promise<Uint8Array> {
  const { data, error } = await api.storage.from(bucket).download(path);
  if (error || !data) throw error ?? new Error('download_failed');
  return new Uint8Array(await data.arrayBuffer());
}

export async function writeTempFile(bytes: Uint8Array, ext: string): Promise<string> {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: MIME[ext.toLowerCase()] ?? 'application/octet-stream' }));
  live.add(url);
  return url;
}

export function deleteTempFile(uri: string): void {
  if (uri.startsWith('blob:')) {
    URL.revokeObjectURL(uri);
    live.delete(uri);
  }
}

export function wipeTemp(): void {
  live.forEach((u) => URL.revokeObjectURL(u));
  live.clear();
}
