/**
 * Dildar on Cloudflare: one Worker serves the web app (static assets) and the
 * API under /api/*. D1 = database, R2 = encrypted media, Durable Objects =
 * live sync, Cron Trigger = scheduled jobs.
 */
import type { Env } from './env';
import { signIn, signOut, signUp, userFromRequest } from './auth';
import { loadCtx } from './context';
import { runQuery, type Query } from './db';
import { runRpc } from './rpc';
import { runFunction } from './functions';
import * as storage from './storage';
import { runScheduled } from './cron';
import { HttpError, fail, json } from './util';

export { CoupleRoom } from './room';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function handleApi(req: Request, env: Env, path: string): Promise<Response> {
  const seg = path.split('/').filter(Boolean); // ['api', ...]
  const [, area, a, ...rest] = seg;

  if (area === 'health') return json({ ok: true });
  if (area === 'auth') {
    if (a === 'signup' && req.method === 'POST') return signUp(env, await body(req));
    if (a === 'signin' && req.method === 'POST') return signIn(env, await body(req));
    if (a === 'signout' && req.method === 'POST') return signOut(env, req);
  }

  const user = await userFromRequest(env, req);
  if (!user) throw new HttpError(401, 'unauthorized');
  if (area === 'auth' && a === 'user') return json({ user });

  if (area === 'realtime') {
    if (req.headers.get('Upgrade') !== 'websocket') throw new HttpError(426, 'expected_websocket');
    const ctx = await loadCtx(env, user);
    if (!ctx.coupleId) throw new HttpError(409, 'no_couple');
    const stub = env.ROOMS.get(env.ROOMS.idFromName(ctx.coupleId));
    const headers = new Headers(req.headers);
    headers.set('x-uid', user.id);
    return stub.fetch(new Request('https://room/ws', { headers }));
  }

  if (area === 'rest' && a && req.method === 'POST') {
    const ctx = await loadCtx(env, user);
    const data = await runQuery(env, ctx, a, (await body(req)) as unknown as Query);
    return json({ data });
  }
  if (area === 'rpc' && a && req.method === 'POST') {
    return json({ data: (await runRpc(env, user, a, await body(req))) ?? null });
  }
  if (area === 'functions' && a && req.method === 'POST') {
    const ctx = await loadCtx(env, user);
    return json({ data: await runFunction(env, ctx, a, await body(req)) });
  }
  if (area === 'storage' && a) {
    const ctx = await loadCtx(env, user);
    if (rest[0] === 'remove' && req.method === 'POST') return storage.remove(env, ctx, a, (await body(req)).paths);
    const objectPath = rest.map(decodeURIComponent).join('/');
    if (req.method === 'PUT') return storage.upload(env, ctx, a, objectPath, req);
    if (req.method === 'GET') return storage.download(env, ctx, a, objectPath);
  }
  throw new HttpError(404, 'not_found');
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) {
      if (env.ASSETS) return env.ASSETS.fetch(req);
      return new Response('Not found', { status: 404 });
    }
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    let res: Response;
    try {
      res = await handleApi(req, env, url.pathname);
    } catch (e) {
      res = fail(e);
    }
    if (res.status === 101) return res;
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(CORS)) out.headers.set(k, v);
    return out;
  },

  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduled(env, event.scheduledTime));
  },
} satisfies ExportedHandler<Env>;
