import {
  countToday, countdownParts, dailyQuestionIndex, dayStartUtc, msUntilNextBeat, parseDate, parseTime,
  pickCountdown, quickSlots, todayIn, wallToUtc,
} from '../features/closeness/logic';
import { SWEET_QUESTIONS, SPICY_QUESTIONS } from '../features/closeness/questions';

const COUPLE = '7b1f5c2e-0000-4000-8000-000000000001';

describe('daily question', () => {
  it('both phones agree for the same couple/day even in different zones', () => {
    // He is in Baghdad, she is in Los Angeles; the day comes from the couple home tz.
    const instant = new Date('2026-01-11T02:30:00Z');
    const dayOnHisPhone = todayIn('Asia/Baghdad', instant);
    const dayOnHerPhone = todayIn('Asia/Baghdad', new Date(instant.getTime() + 2000));
    expect(dayOnHisPhone).toBe(dayOnHerPhone);
    const a = dailyQuestionIndex(COUPLE, dayOnHisPhone, 'sweet', SWEET_QUESTIONS.length);
    const b = dailyQuestionIndex(COUPLE, dayOnHerPhone, 'sweet', SWEET_QUESTIONS.length);
    expect(a).toBe(b);
  });

  it('is stable, in range, and varies across days and couples', () => {
    const seen = new Set<number>();
    for (let d = 1; d <= 28; d++) {
      const day = `2026-02-${String(d).padStart(2, '0')}`;
      const i = dailyQuestionIndex(COUPLE, day, 'sweet', SWEET_QUESTIONS.length);
      expect(i).toBe(dailyQuestionIndex(COUPLE, day, 'sweet', SWEET_QUESTIONS.length));
      expect(i).toBeGreaterThanOrEqual(0);
      expect(i).toBeLessThan(SWEET_QUESTIONS.length);
      seen.add(i);
    }
    expect(seen.size).toBeGreaterThan(10);
    const other = Array.from({ length: 10 }, (_, d) => dailyQuestionIndex('other-couple', `2026-03-0${d}`, 'spicy', SPICY_QUESTIONS.length));
    const mine = Array.from({ length: 10 }, (_, d) => dailyQuestionIndex(COUPLE, `2026-03-0${d}`, 'spicy', SPICY_QUESTIONS.length));
    expect(other).not.toEqual(mine);
  });

  it('pools are big enough and fully translated', () => {
    expect(SWEET_QUESTIONS.length).toBeGreaterThanOrEqual(60);
    expect(SPICY_QUESTIONS.length).toBeGreaterThanOrEqual(40);
    for (const q of [...SWEET_QUESTIONS, ...SPICY_QUESTIONS]) {
      expect(q.ckb.trim().length).toBeGreaterThan(5);
      expect(q.en.trim().length).toBeGreaterThan(5);
    }
  });
});

describe('receiver-time-zone scheduling', () => {
  it('converts the wall time typed for her zone to the right instant', () => {
    expect(wallToUtc('2026-01-10', '21:00', 'Europe/Stockholm')?.toISOString()).toBe('2026-01-10T20:00:00.000Z');
    expect(wallToUtc('2026-07-10', '21:00', 'Europe/Stockholm')?.toISOString()).toBe('2026-07-10T19:00:00.000Z');
    expect(wallToUtc('2026-07-10', '08:15', 'America/Los_Angeles')?.toISOString()).toBe('2026-07-10T15:15:00.000Z');
    // Kurdish digits typed into the fields
    expect(wallToUtc('٢٠٢٦-٠٧-١٠', '٢١:٠٠', 'Asia/Baghdad')?.toISOString()).toBe('2026-07-10T18:00:00.000Z');
  });

  it('rejects bad input', () => {
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('2026/02/03')).toBeNull();
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('9:5')).toBeNull();
    expect(wallToUtc('nope', '10:00', 'Asia/Baghdad')).toBeNull();
  });

  it('quick slots are in the receiver zone and never in the past', () => {
    const now = new Date('2026-07-10T19:30:00Z'); // 21:30 in Stockholm — "tonight 21:00" already passed
    const slots = quickSlots('Europe/Stockholm', now);
    expect(slots.map((s) => s.key)).toEqual(['morning', 'tomorrowNight']);
    expect(slots[0].at.toISOString()).toBe('2026-07-11T06:00:00.000Z');
    const early = quickSlots('Europe/Stockholm', new Date('2026-07-10T08:00:00Z'));
    expect(early[0]).toMatchObject({ key: 'tonight', date: '2026-07-10', time: '21:00' });
  });
});

describe('day-bounded counters', () => {
  const tz = 'Asia/Baghdad';
  it('counts only today in the home zone, by direction', () => {
    const now = new Date('2026-05-05T10:00:00Z'); // 13:00 Baghdad
    const ev = [
      { sender_id: 'me', created_at: '2026-05-04T20:59:00Z' }, // 23:59 yesterday
      { sender_id: 'me', created_at: '2026-05-04T21:00:00Z' }, // 00:00 today
      { sender_id: 'her', created_at: '2026-05-05T09:00:00Z' },
      { sender_id: 'her', created_at: '2026-05-05T09:30:00Z' },
      { sender_id: 'her', created_at: '2026-05-05T21:30:00Z' }, // tomorrow
    ];
    expect(countToday(ev, 'me', tz, now)).toEqual({ mine: 1, theirs: 2 });
    expect(dayStartUtc(now, tz).toISOString()).toBe('2026-05-04T21:00:00.000Z');
  });

  it('day start follows DST in a DST zone', () => {
    expect(dayStartUtc(new Date('2026-07-01T12:00:00Z'), 'Europe/London').toISOString()).toBe('2026-06-30T23:00:00.000Z');
    expect(dayStartUtc(new Date('2026-01-01T12:00:00Z'), 'Europe/London').toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});

describe('countdown', () => {
  it('splits the remaining time and flags arrival', () => {
    const now = Date.parse('2026-06-01T00:00:00Z');
    expect(countdownParts('2026-06-03T05:06:07Z', now)).toMatchObject({ d: 2, h: 5, m: 6, s: 7, arrived: false });
    expect(countdownParts('2026-05-31T00:00:00Z', now).arrived).toBe(true);
  });

  it('picks the nearest future countdown, else a recently ended one', () => {
    const now = Date.parse('2026-06-01T00:00:00Z');
    const rows = [{ target_at: '2026-08-01T00:00:00Z' }, { target_at: '2026-07-01T00:00:00Z' }, { target_at: '2026-05-31T12:00:00Z' }];
    expect(pickCountdown(rows, now)?.target_at).toBe('2026-07-01T00:00:00Z');
    expect(pickCountdown([rows[2]], now)?.target_at).toBe('2026-05-31T12:00:00Z');
    expect(pickCountdown([{ target_at: '2026-05-01T00:00:00Z' }], now)).toBeNull();
  });

  it('sleep heartbeats share a wall-clock grid', () => {
    expect(msUntilNextBeat(3000)).toBe(0);
    expect(msUntilNextBeat(3001)).toBe(1499);
    expect((1234567 + msUntilNextBeat(1234567)) % 1500).toBe(0);
  });
});
