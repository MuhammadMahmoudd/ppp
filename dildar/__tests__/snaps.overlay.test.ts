import { decodeMeta, decodeOverlay, encodeOverlay, mimeFor, simplifyPoints, strokePath, EMPTY_OVERLAY, type SnapOverlay } from '../features/snaps/overlay';
import { generateKeyPair, deriveSharedKey, sealJSON, openJSON } from '../lib/crypto';

const sample: SnapOverlay = {
  filter: 'rose',
  strokes: [{ color: '#FF4D6D', width: 8, points: [0.1, 0.1, 0.1001, 0.1001, 0.5, 0.5, 0.9, 0.2] }],
  texts: [{ id: 'a', text: 'خۆشم دەوێیت ❤️', x: 0.5, y: 0.4, color: '#FFFFFF', size: 32, bg: true }],
};

describe('snap overlay', () => {
  it('round-trips through encryption and validation', () => {
    const a = generateKeyPair();
    const b = generateKeyPair();
    const k = deriveSharedKey(b.publicKey, a.secretKey);
    const meta = { v: 1, mime: 'image/jpeg', ext: 'jpg', overlay: encodeOverlay(sample) };
    const s = sealJSON(meta, k);
    const back = decodeMeta(openJSON(s.c, s.n, deriveSharedKey(a.publicKey, b.secretKey)));
    expect(back?.overlay.texts[0].text).toBe('خۆشم دەوێیت ❤️');
    expect(back?.overlay.filter).toBe('rose');
    expect(back?.overlay.strokes[0].points.length).toBeGreaterThanOrEqual(4);
  });

  it('simplifies near-duplicate points but keeps endpoints', () => {
    const pts = simplifyPoints([0, 0, 0.0001, 0.0001, 0.0002, 0.0002, 0.5, 0.5]);
    expect(pts.slice(0, 2)).toEqual([0, 0]);
    expect(pts.slice(-2)).toEqual([0.5, 0.5]);
    expect(pts.length).toBe(4);
  });

  it('rejects hostile input', () => {
    expect(decodeOverlay(null)).toEqual(EMPTY_OVERLAY);
    const o = decodeOverlay({
      filter: 'evil',
      strokes: [{ color: 'red', points: [1, 2] }, { color: '#FFFFFF', points: [5, -3, 0.5] }, { color: '#FFFFFF', points: [5, -3], width: 999 }],
      texts: [{ text: '' }, { text: 'x'.repeat(1000), x: 9, y: -1, size: 500, color: 'javascript:' }],
    });
    expect(o.filter).toBe('none');
    expect(o.strokes).toEqual([{ color: '#FFFFFF', width: 40, points: [1, 0] }]);
    expect(o.texts).toHaveLength(1);
    expect(o.texts[0]).toMatchObject({ x: 1, y: 0, size: 72, color: '#FFFFFF' });
    expect(o.texts[0].text.length).toBe(240);
    expect(decodeMeta({ mime: 'image/jpeg' })).toBeNull();
    expect(decodeMeta({ mime: 'image/jpeg', ext: '../x' })?.ext).toBe('x');
  });

  it('builds svg paths in pixel space', () => {
    expect(strokePath([0.5, 0.5], 100, 200)).toBe('M50.0 100.0 L50.1 100.0');
    const d = strokePath([0, 0, 0.5, 0.5, 1, 1], 100, 100);
    expect(d.startsWith('M0.0 0.0')).toBe(true);
    expect(d.endsWith('L100.0 100.0')).toBe(true);
    expect(strokePath([], 1, 1)).toBe('');
  });

  it('maps file types', () => {
    expect(mimeFor('file:///a/b.mov', 'video')).toEqual({ mime: 'video/quicktime', ext: 'mov' });
    expect(mimeFor('file:///a/b.jpg?x=1', 'image')).toEqual({ mime: 'image/jpeg', ext: 'jpg' });
    expect(mimeFor('file:///a/b.png', 'image').ext).toBe('png');
  });
});
