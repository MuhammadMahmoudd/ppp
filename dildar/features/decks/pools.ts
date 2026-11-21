/**
 * Card pools for games: starter cards (levels 1–3, bilingual) + our own
 * custom cards (any level; level 4 exists ONLY as custom cards).
 */
import type { DeckKind, Heat } from '@/lib/database.types';
import { STARTER_CARDS, STARTER_DICE, STARTER_WYR } from './starter';
import { splitPair, type Txt } from './text';
import type { CardView } from './api';

export type PoolCard = { id: string; heat: Heat; text: Txt; custom: boolean; category?: string };
export type WyrCard = { id: string; heat: Heat; a: Txt; b: Txt };
export type DieDef = { id: string; name: Txt; faces: Txt[] };

export function poolFor(kind: DeckKind, custom: CardView[], filter: { heat?: Heat; maxHeat?: Heat } = {}): PoolCard[] {
  const ok = (h: Heat) => (filter.heat ? h === filter.heat : filter.maxHeat ? h <= filter.maxHeat : true);
  const starter = STARTER_CARDS.filter((c) => c.kind === kind && ok(c.heat)).map((c): PoolCard => ({ id: c.id, heat: c.heat, text: c.text, custom: false }));
  const mine = custom.filter((c) => c.kind === kind && ok(c.heat)).map((c): PoolCard => ({ id: c.id, heat: c.heat, text: c.text, custom: true, category: c.category }));
  return [...starter, ...mine];
}

export function wyrPool(custom: CardView[], maxHeat: Heat): WyrCard[] {
  const starter = STARTER_WYR.filter((w) => w.heat <= maxHeat).map((w): WyrCard => ({ id: w.id, heat: w.heat, a: w.a, b: w.b }));
  const mine: WyrCard[] = [];
  for (const c of custom) {
    if (c.kind !== 'would_you_rather' || c.heat > maxHeat) continue;
    const p = splitPair(c.text);
    if (p) mine.push({ id: c.id, heat: c.heat, a: p[0], b: p[1] });
  }
  return [...starter, ...mine];
}

/** Dice: our custom dice decks (category = die name, cards = faces) + starter dice. */
export function diceDefs(custom: CardView[], deckNames: Map<string, string>): DieDef[] {
  const byDie = new Map<string, DieDef>();
  for (const c of custom) {
    if (c.kind !== 'dice') continue;
    const name = c.category && c.category !== 'general' ? c.category : deckNames.get(c.deckId) ?? '🎲';
    const key = `${c.deckId}:${name}`;
    let d = byDie.get(key);
    if (!d) byDie.set(key, (d = { id: `c:${key}`, name, faces: [] }));
    d.faces.push(c.text);
  }
  const mine = [...byDie.values()].filter((d) => d.faces.length >= 2);
  return [...mine, ...STARTER_DICE.map((d): DieDef => ({ id: d.id, name: d.name, faces: d.faces }))];
}

/** know-me cards of ONE author: "question || answer". */
export function knowMePool(custom: CardView[], authorId: string): { id: string; question: string; answer: string }[] {
  const out: { id: string; question: string; answer: string }[] = [];
  for (const c of custom) {
    if (c.kind !== 'know_me' || c.ownerId !== authorId) continue;
    const p = splitPair(c.text);
    if (p) out.push({ id: c.id, question: p[0], answer: p[1] });
  }
  return out;
}
