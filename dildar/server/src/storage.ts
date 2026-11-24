/**
 * Encrypted media in R2. Object keys are "<bucket>/<couple_id>/<uuid>".
 * Everything stored is ciphertext; the rules below only decide who may
 * upload/download/delete the opaque bytes.
 */
import type { Env } from './env';
import type { Ctx } from './context';
import { HttpError, json } from './util';

const BUCKETS = new Set(['snaps', 'vault', 'chat-media', 'avatars']);
const MAX_BYTES = 80 * 1024 * 1024;

function check(ctx: Ctx, bucket: string, path: string): string {
  if (!BUCKETS.has(bucket)) throw new HttpError(404, 'unknown_bucket');
  if (!ctx.coupleId) throw new HttpError(403, 'no_couple');
  const parts = path.split('/');
  if (parts.length !== 2 || parts[0] !== ctx.coupleId || !/^[A-Za-z0-9-]{8,64}$/.test(parts[1])) throw new HttpError(403, 'bad_path');
  return `${bucket}/${path}`;
}

export async function upload(env: Env, ctx: Ctx, bucket: string, path: string, req: Request): Promise<Response> {
  const key = check(ctx, bucket, path);
  const len = Number(req.headers.get('Content-Length') ?? '0');
  if (len > MAX_BYTES) throw new HttpError(413, 'too_large');
  if (bucket !== 'avatars' && (await env.MEDIA.head(key))) throw new HttpError(409, 'exists');
  const body = await req.arrayBuffer();
  if (body.byteLength > MAX_BYTES) throw new HttpError(413, 'too_large');
  await env.MEDIA.put(key, body, { httpMetadata: { contentType: 'application/octet-stream' } });
  return json({ data: { path } });
}

export async function download(env: Env, ctx: Ctx, bucket: string, path: string): Promise<Response> {
  const key = check(ctx, bucket, path);
  const obj = await env.MEDIA.get(key);
  if (!obj) throw new HttpError(404, 'not_found');
  return new Response(obj.body, { headers: { 'Content-Type': 'application/octet-stream', 'Cache-Control': 'private, no-store' } });
}

/** Deletes only objects nothing points to any more (snaps: server-side only, see functions.ts). */
export async function remove(env: Env, ctx: Ctx, bucket: string, paths: unknown): Promise<Response> {
  const list = Array.isArray(paths) ? paths.filter((p): p is string => typeof p === 'string').slice(0, 100) : [];
  const removed: string[] = [];
  for (const path of list) {
    const key = check(ctx, bucket, path);
    let referenced: unknown = null;
    if (bucket === 'vault') {
      referenced = await env.DB.prepare('SELECT 1 FROM vault_items WHERE storage_path = ? OR thumb_path = ?').bind(path, path).first();
    } else if (bucket === 'chat-media') {
      referenced = await env.DB.prepare('SELECT 1 FROM messages WHERE media_path = ?').bind(path).first();
    } else if (bucket === 'snaps') {
      referenced = await env.DB.prepare('SELECT 1 FROM snaps WHERE storage_path = ?').bind(path).first();
    } else if (bucket === 'avatars') {
      referenced = await env.DB.prepare('SELECT 1 FROM profiles WHERE avatar_path = ? AND user_id <> ?').bind(path, ctx.uid).first();
    }
    if (referenced) continue;
    await env.MEDIA.delete(key);
    removed.push(path);
  }
  return json({ data: removed });
}
