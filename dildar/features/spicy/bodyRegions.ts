/**
 * Abstract, non-explicit body silhouette for the body map. Each region is a
 * set of simple SVG primitives in a 200×420 viewBox. Region ids are stored
 * in body_map_answers.area — never rename an id.
 */
export type Shape =
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number };

export const FIGURE_REGIONS = [
  'head', 'ears', 'lips', 'neck', 'shoulders', 'chest', 'arms', 'hands',
  'waist', 'hips', 'thighs', 'legs', 'feet',
] as const;
/** Areas not visible on a front silhouette — offered as chips. */
export const EXTRA_REGIONS = ['back', 'lower_back'] as const;
export const ALL_REGIONS = [...FIGURE_REGIONS, ...EXTRA_REGIONS] as const;
export type RegionId = (typeof ALL_REGIONS)[number];

/** Drawing order matters: later shapes sit on top (lips over head). */
export const REGION_SHAPES: Record<(typeof FIGURE_REGIONS)[number], Shape[]> = {
  head: [{ kind: 'circle', cx: 100, cy: 40, r: 28 }],
  ears: [
    { kind: 'ellipse', cx: 71, cy: 42, rx: 6, ry: 10 },
    { kind: 'ellipse', cx: 129, cy: 42, rx: 6, ry: 10 },
  ],
  lips: [{ kind: 'ellipse', cx: 100, cy: 53, rx: 9, ry: 4.5 }],
  neck: [{ kind: 'rect', x: 89, y: 66, w: 22, h: 18, r: 7 }],
  shoulders: [
    { kind: 'ellipse', cx: 68, cy: 94, rx: 20, ry: 12 },
    { kind: 'ellipse', cx: 132, cy: 94, rx: 20, ry: 12 },
  ],
  chest: [{ kind: 'rect', x: 72, y: 86, w: 56, h: 50, r: 18 }],
  arms: [
    { kind: 'rect', x: 38, y: 100, w: 18, h: 100, r: 9 },
    { kind: 'rect', x: 144, y: 100, w: 18, h: 100, r: 9 },
  ],
  hands: [
    { kind: 'circle', cx: 47, cy: 212, r: 12 },
    { kind: 'circle', cx: 153, cy: 212, r: 12 },
  ],
  waist: [{ kind: 'rect', x: 76, y: 138, w: 48, h: 34, r: 12 }],
  hips: [{ kind: 'rect', x: 70, y: 174, w: 60, h: 40, r: 18 }],
  thighs: [
    { kind: 'rect', x: 72, y: 216, w: 26, h: 70, r: 12 },
    { kind: 'rect', x: 102, y: 216, w: 26, h: 70, r: 12 },
  ],
  legs: [
    { kind: 'rect', x: 74, y: 290, w: 22, h: 88, r: 10 },
    { kind: 'rect', x: 104, y: 290, w: 22, h: 88, r: 10 },
  ],
  feet: [
    { kind: 'ellipse', cx: 84, cy: 390, rx: 14, ry: 8 },
    { kind: 'ellipse', cx: 116, cy: 390, rx: 14, ry: 8 },
  ],
};

export type Intensity = 0 | 1 | 2 | 3;
/** Tap cycles 0 → 1 → 2 → 3 → 0. */
export function nextIntensity(i: Intensity): Intensity {
  return ((i + 1) % 4) as Intensity;
}

export function isRegionId(id: string): id is RegionId {
  return (ALL_REGIONS as readonly string[]).includes(id);
}
