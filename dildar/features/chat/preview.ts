import type { Strings } from '@/i18n/ckb';
import type { MessageBody } from '@/lib/messages';

/** One-line preview of any message body (reply quotes, notifications). */
export function previewText(body: MessageBody | null, s: Strings): string {
  if (!body) return s.chat.cantDecrypt;
  switch (body.t) {
    case 'text': return body.text;
    case 'image': return `📷 ${s.chat.photo}`;
    case 'video': return `🎥 ${s.chat.video}`;
    case 'voice': return `🎙️ ${s.chat.voice}`;
    case 'game_result': return `🎮 ${body.summary}`;
    case 'dare': return `🔥 ${body.text}`;
    case 'tonight': return s.chat.cards.tonightAsk;
    case 'miss_you': return s.chat.cards.missYou;
    case 'touch': return `🫶 ${s.chat.cards.touchPatterns[body.pattern]}`;
    case 'screenshot': return s.chat.cards.screenshot;
    case 'snap': return `📸 ${s.chat.cards.snap}`;
    case 'envelope': return `💌 ${body.title}`;
    case 'streak': return `🔥 ${body.days}`;
    case 'system': return body.text;
    default: return '';
  }
}
