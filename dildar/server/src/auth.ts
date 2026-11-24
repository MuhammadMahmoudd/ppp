/**
 * Email + password accounts (PBKDF2-SHA256, 100k iterations, per-user salt),
 * opaque bearer tokens stored hashed. The deployment allows at most
 * MAX_USERS accounts (default 2) — sign-up closes once you both exist.
 */
import type { Env } from './env';
import { HttpError, addMs, b64, json, nowIso, randomToken, safeEqual, sha256Hex, uuid } from './util';

const ITERATIONS = 100_000; // Workers' PBKDF2 ceiling
const SESSION_MS = 180 * 24 * 3600_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations },
    key,
    256,
  );
  return b64(bits);
}

async function createSession(env: Env, userId: string, email: string) {
  const token = randomToken(32);
  await env.DB.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256Hex(token), userId, addMs(SESSION_MS))
    .run();
  return { access_token: token, token_type: 'bearer', user: { id: userId, email } };
}

type Creds = { email?: unknown; password?: unknown };
function readCreds(body: Creds): { email: string; password: string } {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!EMAIL_RE.test(email)) throw new HttpError(400, 'invalid_email');
  if (password.length < 8) throw new HttpError(400, 'weak_password');
  return { email, password };
}

export async function signUp(env: Env, body: Creds): Promise<Response> {
  const { email, password } = readCreds(body);
  const max = Number(env.MAX_USERS ?? '2') || 2;
  const count = await env.DB.prepare('SELECT count(*) AS n FROM users').first<{ n: number }>();
  if ((count?.n ?? 0) >= max) throw new HttpError(403, 'signups_closed');
  const exists = await env.DB.prepare('SELECT 1 FROM users WHERE email = ?').bind(email).first();
  if (exists) throw new HttpError(409, 'email_taken');
  const id = uuid();
  const salt = randomToken(16);
  const hash = await pbkdf2(password, salt, ITERATIONS);
  await env.DB.batch([
    env.DB.prepare('INSERT INTO users (id, email, password_hash, salt, iterations) VALUES (?, ?, ?, ?, ?)').bind(id, email, hash, salt, ITERATIONS),
    env.DB.prepare('INSERT INTO profiles (user_id) VALUES (?)').bind(id),
    env.DB.prepare('INSERT INTO devices (user_id) VALUES (?)').bind(id),
  ]);
  return json({ session: await createSession(env, id, email) });
}

export async function signIn(env: Env, body: Creds): Promise<Response> {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const tries = await env.DB.prepare('SELECT count(*) AS n FROM login_attempts WHERE email = ? AND at > ?').bind(email, since).first<{ n: number }>();
  if ((tries?.n ?? 0) >= 10) throw new HttpError(429, 'too_many_attempts');
  const u = await env.DB.prepare('SELECT id, email, password_hash, salt, iterations FROM users WHERE email = ?')
    .bind(email)
    .first<{ id: string; email: string; password_hash: string; salt: string; iterations: number }>();
  const ok = u ? safeEqual(await pbkdf2(password, u.salt, u.iterations), u.password_hash) : false;
  if (!u || !ok) {
    await env.DB.prepare('INSERT INTO login_attempts (email) VALUES (?)').bind(email).run();
    throw new HttpError(401, 'invalid_login');
  }
  return json({ session: await createSession(env, u.id, u.email) });
}

function bearer(req: Request): string | null {
  const h = req.headers.get('Authorization');
  if (h?.startsWith('Bearer ')) return h.slice(7).trim();
  return new URL(req.url).searchParams.get('access_token');
}

/** Returns the user id for a valid token, else null. */
export async function userFromRequest(env: Env, req: Request): Promise<{ id: string; email: string } | null> {
  const token = bearer(req);
  if (!token) return null;
  const row = await env.DB.prepare(
    'SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?',
  )
    .bind(await sha256Hex(token), nowIso())
    .first<{ id: string; email: string }>();
  return row ?? null;
}

export async function signOut(env: Env, req: Request): Promise<Response> {
  const token = bearer(req);
  if (token) await env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256Hex(token)).run();
  return json({ ok: true });
}
