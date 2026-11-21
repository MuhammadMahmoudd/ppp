/**
 * Snap overlays (doodles, text, filter) are never burned into the media.
 * They travel as encrypted JSON in snaps.meta_ciphertext and the receiver
 * renders them on top — so they work on video too. Coordinates are
 * normalized to 0..1 of the media frame so any screen size renders the same.
 *
 * Pure module (no React Native imports) → unit-tested.
 */

export const FILTERS = ['none', 'warm', 'rose', 'night', 'noir', 'vintage'] as const;
export type FilterId = (typeof FILTERS)[number];

export type Stroke = { color: string; width: number; points: number[] }; // flat [x0,y0,x1,y1…] in 0..1
export type TextItem = { id: string; text: string; x: number; y: number; color: string; size: number; bg: boolean };
export type SnapOverlay = { strokes: Stroke[]; texts: TextItem[]; filter: FilterId };

/** Everything the receiver needs besides the media bytes (encrypted). */
export type SnapMeta = { v: 1; mime: string; ext: string; w?: number; h?: number; overlay: SnapOverlay };

export const EMPTY_OVERLAY: SnapOverlay = { strokes: [], texts: [], filter: 'none' };

export const PALETTE = ['#FFFFFF', '#FF4D6D', '#FF8A65', '#FFC861', '#5BD6A0', '#8FD3FF', '#B98CFF', '#111111'] as const;

const MAX_STROKES = 200;
const MAX_POINTS = 2000; // per stroke (x,y pairs count as 2)
const MAX_TEXTS = 20;
const MAX_TEXT_LEN = 240;

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);
const q = (n: number) => Math.round(clamp01(n) * 1000) / 1000;
const isColor = (c: unknown): c is string => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);

/** Drops near-duplicate consecutive points (keeps payloads small). */
export function simplifyPoints(points: number[], minDist = 0.004): number[] {
  if (points.length <= 4) return points.map(q);
  const out: number[] = [q(points[0]), q(points[1])];
  for (let i = 2; i < points.length - 1; i += 2) {
    const dx = points[i] - out[out.length - 2];
    const dy = points[i + 1] - out[out.length - 1];
    if (dx * dx + dy * dy >= minDist * minDist || i >= points.length - 2) out.push(q(points[i]), q(points[i + 1]));
  }
  return out;
}

export function encodeOverlay(o: SnapOverlay): SnapOverlay {
  return {
    filter: o.filter,
    strokes: o.strokes.slice(0, MAX_STROKES).map((s) => ({
      color: s.color,
      width: Math.round(Math.min(40, Math.max(1, s.width)) * 10) / 10,
      points: simplifyPoints(s.points).slice(0, MAX_POINTS),
    })),
    texts: o.texts.slice(0, MAX_TEXTS).map((t) => ({
      ...t,
      text: t.text.slice(0, MAX_TEXT_LEN),
      x: q(t.x),
      y: q(t.y),
      size: Math.round(Math.min(72, Math.max(12, t.size))),
    })),
  };
}

/** Validates untrusted (decrypted) JSON into a safe overlay. */
export function decodeOverlay(raw: unknown): SnapOverlay {
  if (!raw || typeof raw !== 'object') return EMPTY_OVERLAY;
  const r = raw as Record<string, unknown>;
  const filter = (FILTERS as readonly string[]).includes(String(r.filter)) ? (r.filter as FilterId) : 'none';
  const strokes: Stroke[] = Array.isArray(r.strokes)
    ? r.strokes.slice(0, MAX_STROKES).flatMap((s): Stroke[] => {
        if (!s || typeof s !== 'object') return [];
        const st = s as Record<string, unknown>;
        if (!isColor(st.color) || !Array.isArray(st.points)) return [];
        const pts = st.points.slice(0, MAX_POINTS).map((n) => clamp01(Number(n)));
        if (pts.length < 2 || pts.length % 2) return [];
        const width = Number(st.width);
        return [{ color: st.color, width: Number.isFinite(width) ? Math.min(40, Math.max(1, width)) : 6, points: pts }];
      })
    : [];
  const texts: TextItem[] = Array.isArray(r.texts)
    ? r.texts.slice(0, MAX_TEXTS).flatMap((t, i): TextItem[] => {
        if (!t || typeof t !== 'object') return [];
        const tt = t as Record<string, unknown>;
        if (typeof tt.text !== 'string' || !tt.text.trim()) return [];
        const size = Number(tt.size);
        return [{
          id: typeof tt.id === 'string' ? tt.id : `t${i}`,
          text: tt.text.slice(0, MAX_TEXT_LEN),
          x: clamp01(Number(tt.x)),
          y: clamp01(Number(tt.y)),
          color: isColor(tt.color) ? tt.color : '#FFFFFF',
          size: Number.isFinite(size) ? Math.min(72, Math.max(12, size)) : 28,
          bg: tt.bg === true,
        }];
      })
    : [];
  return { strokes, texts, filter };
}

export function decodeMeta(raw: unknown): SnapMeta | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.mime !== 'string' || typeof r.ext !== 'string') return null;
  const ext = r.ext.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin';
  return {
    v: 1,
    mime: r.mime.slice(0, 40),
    ext,
    w: typeof r.w === 'number' ? r.w : undefined,
    h: typeof r.h === 'number' ? r.h : undefined,
    overlay: decodeOverlay(r.overlay),
  };
}

/** Smooth SVG path (quadratic midpoints) for a normalized stroke at a pixel size. */
export function strokePath(points: number[], width: number, height: number): string {
  if (points.length < 2) return '';
  const px = (i: number) => (points[i] * width).toFixed(1);
  const py = (i: number) => (points[i + 1] * height).toFixed(1);
  if (points.length === 2) {
    // a dot: tiny segment so round caps draw it
    return `M${px(0)} ${py(0)} L${(points[0] * width + 0.1).toFixed(1)} ${py(0)}`;
  }
  let d = `M${px(0)} ${py(0)}`;
  for (let i = 2; i < points.length - 2; i += 2) {
    const mx = (((points[i] + points[i + 2]) / 2) * width).toFixed(1);
    const my = (((points[i + 1] + points[i + 3]) / 2) * height).toFixed(1);
    d += ` Q${px(i)} ${py(i)} ${mx} ${my}`;
  }
  const last = points.length - 2;
  d += ` L${px(last)} ${py(last)}`;
  return d;
}

/** File extension → mime for snaps. */
export function mimeFor(uri: string, kind: 'image' | 'video'): { mime: string; ext: string } {
  const ext = (uri.split('?')[0].split('.').pop() ?? '').toLowerCase();
  if (kind === 'video') {
    if (ext === 'mov') return { mime: 'video/quicktime', ext: 'mov' };
    return { mime: 'video/mp4', ext: 'mp4' };
  }
  if (ext === 'png') return { mime: 'image/png', ext: 'png' };
  if (ext === 'heic') return { mime: 'image/heic', ext: 'heic' };
  return { mime: 'image/jpeg', ext: 'jpg' };
}

export const TIMERS = [3, 5, 10, 0] as const; // 0 = ∞ loop
export type SnapTimer = (typeof TIMERS)[number];
