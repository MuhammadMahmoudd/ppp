import type { Env } from './env';
import { HttpError } from './util';

/** Who is calling and which couple they belong to — the basis of every access rule. */
export type Ctx = {
  uid: string;
  email: string;
  coupleId: string | null;
  role: 'a' | 'b' | null;
  partnerId: string | null;
  paired: boolean;
  spicy: boolean;
  homeTz: string;
};

export async function loadCtx(env: Env, user: { id: string; email: string }): Promise<Ctx> {
  const me = await env.DB.prepare('SELECT couple_id, role FROM couple_members WHERE user_id = ?')
    .bind(user.id)
    .first<{ couple_id: string; role: 'a' | 'b' }>();
  if (!me) return { uid: user.id, email: user.email, coupleId: null, role: null, partnerId: null, paired: false, spicy: false, homeTz: 'Asia/Baghdad' };
  const [other, couple] = await Promise.all([
    env.DB.prepare('SELECT user_id FROM couple_members WHERE couple_id = ? AND user_id <> ?').bind(me.couple_id, user.id).first<{ user_id: string }>(),
    env.DB.prepare('SELECT * FROM couples WHERE id = ?').bind(me.couple_id).first<Record<string, number | string>>(),
  ]);
  const spicy = !!couple && !!(couple.spicy_enabled_a && couple.spicy_enabled_b && couple.adult_confirmed_a && couple.adult_confirmed_b);
  return {
    uid: user.id,
    email: user.email,
    coupleId: me.couple_id,
    role: me.role,
    partnerId: other?.user_id ?? null,
    paired: !!other,
    spicy,
    homeTz: String(couple?.home_timezone ?? 'Asia/Baghdad'),
  };
}

export function needCouple(ctx: Ctx): string {
  if (!ctx.coupleId) throw new HttpError(400, 'no_couple');
  return ctx.coupleId;
}
