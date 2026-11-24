// Discreet Expo push (iPhone app). The server never knows content (E2E), so
// even "previews" only reveal the *kind* of thing that arrived. Web has no push.
import type { Env } from './env';

export type PushKind =
  | 'message' | 'snap' | 'game_invite' | 'touch' | 'miss_you' | 'tonight'
  | 'screenshot' | 'dare' | 'envelope' | 'daily_question' | 'vault' | 'reaction' | 'streak_warning';
type Locale = 'ckb' | 'en';

const DISCREET: Record<Locale, { title: string; body: string }> = {
  ckb: { title: 'دڵدار', body: 'شتێکی نوێ' },
  en: { title: 'Dildar', body: 'Something new' },
};
const PREVIEW: Record<Locale, Record<PushKind, string>> = {
  ckb: {
    message: '💬 نامەیەکی نوێ', snap: '📸 سناپێکی نوێ', game_invite: '🎲 بانگهێشتی یاری', touch: '🤍 دەستلێدانێک',
    miss_you: '💞 بیرت دەکات', tonight: '✨ پرسیارێکی تایبەت', screenshot: '📸 وێنەی شاشەی گرت', dare: '🎯 بوێرییەکی نوێ',
    envelope: '💌 نامەیەکی داخراو', daily_question: '❓ پرسیاری ئەمڕۆ', vault: '🔒 شتێکی نوێ لە گەنجینە', reaction: '❤️ کاردانەوەیەک',
    streak_warning: '⏳ زنجیرەکەتان لە مەترسیدایە',
  },
  en: {
    message: '💬 New message', snap: '📸 New snap', game_invite: '🎲 Game invite', touch: '🤍 A touch',
    miss_you: '💞 Misses you', tonight: '✨ A private question', screenshot: '📸 Took a screenshot', dare: '🎯 New dare',
    envelope: '💌 A sealed letter', daily_question: "❓ Today's question", vault: '🔒 Something new in the vault', reaction: '❤️ A reaction',
    streak_warning: '⏳ Your streak is at risk',
  },
};

export async function pushToUser(env: Env, userId: string, kind: PushKind, data: Record<string, unknown> = {}): Promise<boolean> {
  const d = await env.DB.prepare(
    'SELECT d.push_token AS token, d.push_previews AS previews, p.locale AS locale FROM devices d LEFT JOIN profiles p ON p.user_id = d.user_id WHERE d.user_id = ?',
  ).bind(userId).first<{ token: string | null; previews: number; locale: string | null }>();
  if (!d?.token) return false;
  const locale: Locale = d.locale === 'en' ? 'en' : 'ckb';
  const body = d.previews ? PREVIEW[locale][kind] : kind === 'streak_warning' ? '⏳' : DISCREET[locale].body;
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ to: d.token, title: DISCREET[locale].title, body, sound: 'default', priority: 'high', data: { kind, ...data } }),
    });
    const out = (await res.json().catch(() => null)) as { data?: { status?: string; details?: { error?: string } } } | null;
    if (out?.data?.status === 'error' && out.data.details?.error === 'DeviceNotRegistered') {
      await env.DB.prepare('UPDATE devices SET push_token = NULL WHERE user_id = ?').bind(userId).run();
    }
    return res.ok;
  } catch {
    return false;
  }
}
