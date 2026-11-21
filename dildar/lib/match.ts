/**
 * Client mirror of the SECURITY DEFINER match functions
 * (ynm_matches / body_map_matches). Partners never get each other's raw
 * answers; this logic exists for tests and for previewing UI copy.
 */
export type YNM = 'yes' | 'no' | 'maybe';

export function isYnmMatch(a: YNM, b: YNM): boolean {
  if (a === 'no' || b === 'no') return false;
  return a === 'yes' || b === 'yes';
}

export function ynmMatches(mine: Record<string, YNM>, theirs: Record<string, YNM>): { key: string; mine: YNM; theirs: YNM; strength: 'both_yes' | 'yes_maybe' }[] {
  const out: { key: string; mine: YNM; theirs: YNM; strength: 'both_yes' | 'yes_maybe' }[] = [];
  for (const key of Object.keys(mine)) {
    const t = theirs[key];
    if (t && isYnmMatch(mine[key], t)) {
      out.push({ key, mine: mine[key], theirs: t, strength: mine[key] === 'yes' && t === 'yes' ? 'both_yes' : 'yes_maybe' });
    }
  }
  return out.sort((x, y) => (x.strength === y.strength ? x.key.localeCompare(y.key) : x.strength === 'both_yes' ? -1 : 1));
}

export type BodySide = 'mine' | 'yours';
export type BodyAnswer = { side: BodySide; area: string; intensity: 1 | 2 | 3 };

/** "I like X on me" overlaps with "they like X on me" (their side = 'yours'). */
export function bodyMapMatches(me: BodyAnswer[], them: BodyAnswer[]): { area: string; kind: 'on_me' | 'on_you'; intensity: number }[] {
  const out: { area: string; kind: 'on_me' | 'on_you'; intensity: number }[] = [];
  for (const m of me) {
    const t = them.find((x) => x.area === m.area && x.side !== m.side);
    if (t) out.push({ area: m.area, kind: m.side === 'mine' ? 'on_me' : 'on_you', intensity: Math.min(m.intensity, t.intensity) });
  }
  return out;
}
