import { ALL_REGIONS, EXTRA_REGIONS, FIGURE_REGIONS, REGION_SHAPES, isRegionId, nextIntensity } from '../features/spicy/bodyRegions';
import spicy from '../i18n/sections/spicy';

describe('body map regions', () => {
  it('ids are unique, short and DB-safe', () => {
    expect(new Set(ALL_REGIONS).size).toBe(ALL_REGIONS.length);
    for (const r of ALL_REGIONS) {
      expect(r).toMatch(/^[a-z_]+$/);
      expect(r.length).toBeLessThanOrEqual(32);
    }
  });

  it('every figure region has shapes inside the 200×420 viewBox', () => {
    for (const r of FIGURE_REGIONS) {
      const shapes = REGION_SHAPES[r];
      expect(shapes.length).toBeGreaterThan(0);
      for (const s of shapes) {
        const [x, y] = s.kind === 'rect' ? [s.x, s.y] : [s.cx, s.cy];
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(200);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(420);
      }
    }
  });

  it('every region is labelled in both languages', () => {
    for (const r of [...FIGURE_REGIONS, ...EXTRA_REGIONS]) {
      expect((spicy.ckb.body.regions as Record<string, string>)[r]).toBeTruthy();
      expect((spicy.en.body.regions as Record<string, string>)[r]).toBeTruthy();
    }
  });

  it('tap cycles intensity 0→1→2→3→0', () => {
    expect([nextIntensity(0), nextIntensity(1), nextIntensity(2), nextIntensity(3)]).toEqual([1, 2, 3, 0]);
    expect(isRegionId('neck')).toBe(true);
    expect(isRegionId('elsewhere')).toBe(false);
  });
});
