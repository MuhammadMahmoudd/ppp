import { buildChatItems, upsertRow, groupReactions, isVisible, mmss, waveform, type ChatRow, type MsgItem } from '../features/chat/model';
import type { OutgoingMessage } from '../lib/messages';

const ME = 'me';
const YOU = 'you';
const row = (id: string, sender: string, at: string, extra: Partial<ChatRow> = {}): ChatRow => ({
  id, sender_id: sender, type: 'text', ciphertext: 'c', nonce: 'n', media_path: null, media_nonce: null, reply_to: null,
  disappear_mode: 'off', created_at: at, seen_at: null, expires_at: null, deleted_at: null, meta: {}, ...extra,
});
const out = (id: string, at: string): OutgoingMessage => ({
  id, couple_id: 'c', sender_id: ME, type: 'text', ciphertext: 'c', nonce: 'n', media_path: null, media_nonce: null,
  reply_to: null, disappear_mode: 'off', meta: {}, created_at: at, push: 'message',
});
const msgs = (items: ReturnType<typeof buildChatItems>) => items.filter((i): i is MsgItem => i.kind === 'msg');

describe('buildChatItems', () => {
  it('orders newest first and dedupes outbox against server rows', () => {
    const items = msgs(buildChatItems({
      rows: [row('1', YOU, '2026-05-01T10:00:00Z'), row('2', ME, '2026-05-01T10:01:00Z')],
      outbox: [out('2', '2026-05-01T10:01:00Z'), out('3', '2026-05-01T10:02:00Z')],
      reactions: new Map(), me: ME, now: Date.parse('2026-05-02T00:00:00Z'),
    }));
    expect(items.map((i) => i.id)).toEqual(['3', '2', '1']);
    expect(items[0].status).toBe('sending');
    expect(items[1].status).toBe('sent');
  });

  it('marks failed outbox items and keeps ghosts as sent', () => {
    const items = msgs(buildChatItems({
      rows: [], outbox: [out('a', '2026-05-01T10:00:00Z')], ghosts: [out('g', '2026-05-01T09:00:00Z')],
      failedIds: new Set(['a']), reactions: new Map(), me: ME,
    }));
    expect(items.find((i) => i.id === 'a')?.status).toBe('failed');
    expect(items.find((i) => i.id === 'g')?.status).toBe('sent');
  });

  it('hides expired messages but keeps deleted tombstones', () => {
    const now = Date.parse('2026-05-01T12:00:00Z');
    const items = msgs(buildChatItems({
      rows: [
        row('gone', YOU, '2026-05-01T10:00:00Z', { expires_at: '2026-05-01T11:00:00Z' }),
        row('dead', YOU, '2026-05-01T10:01:00Z', { deleted_at: '2026-05-01T10:30:00Z', ciphertext: null }),
        row('live', YOU, '2026-05-01T10:02:00Z', { expires_at: '2026-05-02T10:00:00Z' }),
      ],
      outbox: [], reactions: new Map(), me: ME, now,
    }));
    expect(items.map((i) => i.id)).toEqual(['live', 'dead']);
    expect(isVisible(row('x', ME, '2026', { expires_at: '2026-05-01T11:00:00Z' }), now)).toBe(false);
  });

  it('shows "seen" only under my newest seen message', () => {
    const items = msgs(buildChatItems({
      rows: [
        row('1', ME, '2026-05-01T10:00:00Z', { seen_at: '2026-05-01T10:05:00Z' }),
        row('2', ME, '2026-05-01T10:01:00Z', { seen_at: '2026-05-01T10:05:00Z' }),
        row('3', ME, '2026-05-01T10:02:00Z'),
      ],
      outbox: [], reactions: new Map(), me: ME,
    }));
    expect(items.filter((i) => i.showSeen).map((i) => i.id)).toEqual(['2']);
  });

  it('groups consecutive messages and inserts day separators above each day', () => {
    const items = buildChatItems({
      rows: [
        row('1', YOU, '2026-05-01T10:00:00'),
        row('2', YOU, '2026-05-01T10:01:00'),
        row('3', ME, '2026-05-02T09:00:00'),
      ],
      outbox: [], reactions: new Map(), me: ME,
    });
    expect(items.map((i) => i.id)).toEqual(['3', 'day-2026-05-02', '2', '1', 'day-2026-05-01']);
    const m = msgs(items);
    expect(m.find((i) => i.id === '2')?.groupEnd).toBe(true);
    expect(m.find((i) => i.id === '2')?.groupStart).toBe(false);
    expect(m.find((i) => i.id === '1')?.groupStart).toBe(true);
  });
});

describe('helpers', () => {
  it('upsertRow replaces or prepends', () => {
    const a = [row('1', ME, 'x')];
    expect(upsertRow(a, row('2', ME, 'y')).map((r) => r.id)).toEqual(['2', '1']);
    expect(upsertRow(a, row('1', ME, 'x', { seen_at: 'now' }))[0].seen_at).toBe('now');
  });
  it('groupReactions', () => {
    const g = groupReactions([
      { message_id: 'm', user_id: ME, couple_id: 'c', emoji: '❤️', created_at: '' },
      { message_id: 'm', user_id: YOU, couple_id: 'c', emoji: '😂', created_at: '' },
    ]);
    expect(g.get('m')?.length).toBe(2);
  });
  it('mmss and waveform', () => {
    expect(mmss(65)).toBe('1:05');
    expect(waveform([], 5)).toHaveLength(5);
    const w = waveform([-60, -30, -10, 0, -160, -20], 3);
    expect(w).toHaveLength(3);
    w.forEach((x) => expect(x).toBeGreaterThan(0));
  });
});
