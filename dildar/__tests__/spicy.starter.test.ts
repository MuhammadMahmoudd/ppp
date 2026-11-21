import { YNM_CATEGORIES, YNM_STARTER, STARTER_BY_KEY, starterLabel } from '../features/spicy/ynmStarter';
import spicy from '../i18n/sections/spicy';

describe('YNM starter list', () => {
  it('has unique, stable s:<slug> keys that fit the DB column (≤64)', () => {
    const keys = YNM_STARTER.map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const k of keys) {
      expect(k).toMatch(/^s:[a-z0-9_]+$/);
      expect(k.length).toBeLessThanOrEqual(64);
    }
  });

  it('every item has Sorani and English text', () => {
    for (const i of YNM_STARTER) {
      expect(i.ckb.trim().length).toBeGreaterThan(1);
      expect(i.en.trim().length).toBeGreaterThan(1);
      expect(i.ckb).toMatch(/[؀-ۿ]/); // Arabic-script
    }
  });

  it('every category is used and labelled in both languages', () => {
    for (const c of YNM_CATEGORIES) {
      expect(YNM_STARTER.some((i) => i.category === c)).toBe(true);
      expect(spicy.ckb.ynm.categories[c]).toBeTruthy();
      expect(spicy.en.ynm.categories[c]).toBeTruthy();
    }
  });

  it('labels resolve by key', () => {
    expect(starterLabel('s:massage', 'en')).toBe('A slow massage');
    expect(starterLabel('nope', 'ckb')).toBeNull();
    expect(STARTER_BY_KEY['s:blindfold'].category).toBe('play');
  });
});
