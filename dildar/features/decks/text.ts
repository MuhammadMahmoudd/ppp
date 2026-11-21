import type { Locale } from '@/lib/settings';
import type { Bi } from './starter';

/** Card text in game state: custom cards are a plain string, starter cards bilingual. */
export type Txt = string | Bi;

export function textOf(t: Txt | null | undefined, locale: Locale): string {
  if (t == null) return '';
  return typeof t === 'string' ? t : t[locale] || t.ckb;
}

/** "a || b" → [a, b] (would-you-rather, know-me question || answer). */
export function splitPair(text: string): [string, string] | null {
  const i = text.indexOf('||');
  if (i < 0) return null;
  const a = text.slice(0, i).trim();
  const b = text.slice(i + 2).trim();
  return a && b ? [a, b] : null;
}
