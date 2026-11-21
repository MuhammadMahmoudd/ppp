import { parseBulk } from '../features/decks/bulkImport';
import { STARTER_CARDS, STARTER_WYR, STARTER_DICE, KNOW_ME_TEMPLATES } from '../features/decks/starter';
import { splitPair } from '../features/decks/text';

describe('bulk import parser', () => {
  it('one card per line with optional level prefix (Latin or Kurdish digits)', () => {
    const r = parseBulk('3| ماچێکی درێژ\n\n  1|hello  world \n# comment\n٢| شۆخ\nplain line', { defaultHeat: 2 });
    expect(r.cards).toEqual([
      { text: 'ماچێکی درێژ', heat: 3 },
      { text: 'hello world', heat: 1 },
      { text: 'شۆخ', heat: 2 },
      { text: 'plain line', heat: 2 },
    ]);
    expect(r.skipped).toEqual([]);
  });
  it('skips duplicates, too-long lines and levels above max', () => {
    const r = parseBulk(`a\nA\n4| fiery\n${'x'.repeat(501)}`, { maxHeat: 2 });
    expect(r.cards).toEqual([{ text: 'a', heat: 1 }]);
    expect(r.skipped.map((x) => x.reason).sort()).toEqual(['duplicate', 'spicy', 'too_long']);
  });
  it('does not treat "||" as a level prefix and can require pairs', () => {
    const r = parseBulk('tea || coffee\n2| sea || mountains\nlonely', { requirePair: true });
    expect(r.cards).toEqual([{ text: 'tea || coffee', heat: 1 }, { text: 'sea || mountains', heat: 2 }]);
    expect(r.skipped).toEqual([{ line: 3, reason: 'needs_split' }]);
    expect(splitPair('a || b')).toEqual(['a', 'b']);
    expect(splitPair('a ||')).toBeNull();
  });
});

describe('starter content', () => {
  const bi = (t: { ckb: string; en: string }) => t.ckb.trim().length > 0 && t.en.trim().length > 0;
  it('ships levels 1–3 only — level 4 is empty', () => {
    expect(STARTER_CARDS.every((c) => c.heat >= 1 && c.heat <= 3)).toBe(true);
    expect(STARTER_WYR.every((c) => c.heat >= 1 && c.heat <= 3)).toBe(true);
    expect(STARTER_CARDS.some((c) => (c.heat as number) === 4)).toBe(false);
  });
  it('has enough truths and dares at every level', () => {
    for (const kind of ['truth', 'dare'] as const) {
      for (const h of [1, 2, 3]) expect(STARTER_CARDS.filter((c) => c.kind === kind && c.heat === h).length).toBeGreaterThanOrEqual(15);
    }
    expect(STARTER_WYR.length).toBeGreaterThanOrEqual(20);
    expect(STARTER_CARDS.filter((c) => c.kind === 'forfeit').length).toBeGreaterThanOrEqual(10);
    for (const k of ['roleplay_setting', 'roleplay_character', 'roleplay_goal', 'tease'] as const) {
      expect(STARTER_CARDS.filter((c) => c.kind === k).length).toBeGreaterThan(3);
    }
  });
  it('every card exists in Sorani and English, ids are unique', () => {
    expect(STARTER_CARDS.every((c) => bi(c.text))).toBe(true);
    expect(STARTER_WYR.every((w) => bi(w.a) && bi(w.b))).toBe(true);
    expect(STARTER_DICE.every((d) => bi(d.name) && d.faces.length === 6 && d.faces.every(bi))).toBe(true);
    expect(KNOW_ME_TEMPLATES.every(bi)).toBe(true);
    const ids = [...STARTER_CARDS.map((c) => c.id), ...STARTER_WYR.map((w) => w.id), ...STARTER_DICE.map((d) => d.id)];
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('Sorani text actually uses Kurdish script', () => {
    expect(STARTER_CARDS.every((c) => /[؀-ۿ]/.test(c.text.ckb))).toBe(true);
  });
});
