import { isYnmMatch, ynmMatches, bodyMapMatches } from '../lib/match';

describe('Yes/No/Maybe matching', () => {
  it('only yes+yes and yes+maybe match', () => {
    expect(isYnmMatch('yes', 'yes')).toBe(true);
    expect(isYnmMatch('yes', 'maybe')).toBe(true);
    expect(isYnmMatch('maybe', 'yes')).toBe(true);
    expect(isYnmMatch('maybe', 'maybe')).toBe(false);
    expect(isYnmMatch('yes', 'no')).toBe(false);
    expect(isYnmMatch('no', 'no')).toBe(false);
  });
  it('returns only overlaps, strongest first, never leaking non-matches', () => {
    const r = ynmMatches(
      { a: 'yes', b: 'maybe', c: 'yes', d: 'no', e: 'yes' },
      { a: 'maybe', b: 'maybe', c: 'yes', d: 'yes' },
    );
    expect(r.map((x) => x.key)).toEqual(['c', 'a']);
    expect(r[0].strength).toBe('both_yes');
  });
});

describe('body map matching', () => {
  it('pairs "on me" with partner "on you"', () => {
    const r = bodyMapMatches(
      [{ side: 'mine', area: 'neck', intensity: 3 }, { side: 'mine', area: 'back', intensity: 2 }],
      [{ side: 'yours', area: 'neck', intensity: 2 }, { side: 'mine', area: 'back', intensity: 3 }],
    );
    expect(r).toEqual([{ area: 'neck', kind: 'on_me', intensity: 2 }]);
  });
});
