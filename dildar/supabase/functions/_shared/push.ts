// Discreet Expo push. The server never knows message content (E2E),
// so even "previews" only reveal the *kind* of thing that arrived.
import { admin } from './admin.ts';

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
    message: '💬 نامەیەکی نوێ',
    snap: '📸 سناپێکی نوێ',
    game_invite: '🎲 بانگهێشتی یاری',
    touch: '🤍 دەستلێدانێک',
    miss_you: '💞 بیرت دەکات',
    tonight: '✨ پرسیارێکی تایبەت',
    screenshot: '📸 وێنەی شاشەی گرت',
    dare: '🎯 بوێرییەکی نوێ',
    envelope: '💌 نامەیەکی داخراو',
    daily_question: '❓ پرسیاری ئەمڕۆ',
    vault: '🔒 شتێکی نوێ لە گەنجینە',
    reaction: '❤️ کاردانەوەیەک',
    streak_warning: '⏳ زنجیرەکەتان لە مەترسیدایە',
  },
  en: {
    message: '💬 New message',
    snap: '📸 New snap',
    game_invite: '🎲 Game invite',
    touch: '🤍 A touch',
    miss_you: '💞 Misses you',
    tonight: '✨ A private question',
    screenshot: '📸 Took a screenshot',
    dare: '🎯 New dare',
    envelope: '💌 A sealed letter',
    daily_question: "❓ Today's question",
    vault: '🔒 Something new in the vault',
    reaction: '❤️ A reaction',
    streak_warning: '⏳ Your streak is at risk',
  },
};

// Kinds that are useful even in discreet mode get a minimal hint.
const ALWAYS_HINT: Partial<Record<PushKind, Record<Locale, string>>> = {
  streak_warning: { ckb: '⏳', en: '⏳' },
};

export async function pushToUser(userId: string, kind: PushKind, data: Record<string, unknown> = {}): Promise<boolean> {
  const [{ data: device }, { data: profile }] = await Promise.all([
    admin.from('devices').select('push_token, push_previews').eq('user_id', userId).maybeSingle(),
    admin.from('profiles').select('locale').eq('user_id', userId).maybeSingle(),
  ]);
  const token = device?.push_token as string | undefined;
  if (!token) return false;
  const locale: Locale = profile?.locale === 'en' ? 'en' : 'ckb';
  const d = DISCREET[locale];
  const body = device?.push_previews ? PREVIEW[locale][kind] : ALWAYS_HINT[kind]?.[locale] ?? d.body;
  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      to: token,
      title: d.title,
      body,
      sound: 'default',
      priority: 'high',
      // Only routing data — never content.
      data: { kind, ...data },
    }),
  });
  if (!res.ok) return false;
  const out = await res.json().catch(() => null);
  // Forget tokens Apple says are dead.
  if (out?.data?.status === 'error' && out?.data?.details?.error === 'DeviceNotRegistered') {
    await admin.from('devices').update({ push_token: null }).eq('user_id', userId);
  }
  return true;
}
