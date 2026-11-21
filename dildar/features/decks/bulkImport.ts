/**
 * Bulk import parser: paste many lines, one card per line.
 * Optional level prefix "N| text" (N = 1–4, Latin or Kurdish digits).
 * Lines starting with # are comments. Pure + unit-tested.
 */
import type { Heat } from '@/lib/database.types';
import { splitPair } from './text';

export type ParsedCard = { text: string; heat: Heat };
export type SkipReason = 'too_long' | 'spicy' | 'duplicate' | 'needs_split';
export type BulkResult = { cards: ParsedCard[]; skipped: { line: number; reason: SkipReason }[] };

export const MAX_CARD_LENGTH = 500;
const PREFIX = /^\s*([1-4١-٤])\s*\|(?!\|)\s*(.*)$/;
const KURDISH = '٠١٢٣٤٥٦٧٨٩';

export function parseBulk(
  input: string,
  opts: { defaultHeat?: Heat; maxHeat?: Heat; requirePair?: boolean } = {},
): BulkResult {
  const defaultHeat = opts.defaultHeat ?? 1;
  const maxHeat = opts.maxHeat ?? 4;
  const cards: ParsedCard[] = [];
  const skipped: BulkResult['skipped'] = [];
  const seen = new Set<string>();
  input.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    let heat: Heat = defaultHeat;
    let text = line;
    const m = PREFIX.exec(line);
    if (m) {
      const d = KURDISH.indexOf(m[1]);
      heat = (d >= 0 ? d : Number(m[1])) as Heat;
      text = m[2].trim();
    }
    text = text.replace(/\s+/g, ' ');
    if (!text) return;
    const n = idx + 1;
    if (text.length > MAX_CARD_LENGTH) return void skipped.push({ line: n, reason: 'too_long' });
    if (heat > maxHeat) return void skipped.push({ line: n, reason: 'spicy' });
    if (opts.requirePair && !splitPair(text)) return void skipped.push({ line: n, reason: 'needs_split' });
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) return void skipped.push({ line: n, reason: 'duplicate' });
    seen.add(key);
    cards.push({ text, heat });
  });
  return { cards, skipped };
}
