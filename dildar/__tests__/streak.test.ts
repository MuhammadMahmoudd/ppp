import { computeStreak, streakStatus, crossedMilestone, freezesAvailable, coupleLevel } from '../lib/streak';
import { dayKey, zonedWallTimeToUtc, msLeftInDay, tzOffsetMinutes, addDays, daysBetween, nextMidnightUtc } from '../lib/time';

const at = (iso: string) => new Date(iso);

describe('time zones', () => {
  it('Baghdad day starts at 21:00 UTC', () => {
    expect(dayKey(at('2026-03-01T20:59:59Z'), 'Asia/Baghdad')).toBe('2026-03-01');
    expect(dayKey(at('2026-03-01T21:00:00Z'), 'Asia/Baghdad')).toBe('2026-03-02');
    expect(tzOffsetMinutes(at('2026-06-01T00:00:00Z'), 'Asia/Baghdad')).toBe(180);
  });

  it('converts wall time in the receiver zone to UTC (tease scheduler)', () => {
    // 21:00 in Stockholm (CET, UTC+1) on Jan 10
    expect(zonedWallTimeToUtc({ year: 2026, month: 1, day: 10, hour: 21, minute: 0 }, 'Europe/Stockholm').toISOString()).toBe('2026-01-10T20:00:00.000Z');
    // 21:00 in Stockholm (CEST, UTC+2) on Jul 10
    expect(zonedWallTimeToUtc({ year: 2026, month: 7, day: 10, hour: 21, minute: 0 }, 'Europe/Stockholm').toISOString()).toBe('2026-07-10T19:00:00.000Z');
    expect(zonedWallTimeToUtc({ year: 2026, month: 7, day: 10, hour: 9, minute: 30 }, 'Asia/Baghdad').toISOString()).toBe('2026-07-10T06:30:00.000Z');
  });

  it('DST spring-forward gap resolves to a real instant', () => {
    // US: 2026-03-08 02:30 does not exist in New York
    const d = zonedWallTimeToUtc({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, 'America/New_York');
    expect(['2026-03-08T07:30:00.000Z', '2026-03-08T06:30:00.000Z']).toContain(d.toISOString());
  });

  it('DST fall-back ambiguity picks the earlier instant', () => {
    // US: 2026-11-01 01:30 happens twice in New York (EDT then EST)
    const d = zonedWallTimeToUtc({ year: 2026, month: 11, day: 1, hour: 1, minute: 30 }, 'America/New_York');
    expect(d.toISOString()).toBe('2026-11-01T05:30:00.000Z');
  });

  it('days on DST change are 23h/25h long', () => {
    expect(msLeftInDay(at('2026-03-29T00:00:00Z'), 'Europe/London')).toBe(23 * 3600_000); // starts 00:00 GMT, 23h day
    expect(nextMidnightUtc(at('2026-10-25T12:00:00Z'), 'Europe/London').toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(msLeftInDay(at('2026-10-24T23:00:00Z'), 'Europe/London')).toBe(25 * 3600_000);
  });

  it('day math', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(daysBetween('2026-12-31', '2027-01-02')).toBe(2);
  });
});

describe('computeStreak (mirror of SQL trigger)', () => {
  const tz = 'Asia/Baghdad';
  it('needs both partners on the same home-tz day', () => {
    expect(computeStreak([{ role: 'a', at: at('2026-03-01T10:00:00Z') }], tz).count).toBe(0);
    const r = computeStreak([
      { role: 'a', at: at('2026-03-01T21:30:00Z') }, // 00:30 on 3/2 Baghdad
      { role: 'b', at: at('2026-03-01T23:00:00Z') },
    ], tz);
    expect(r).toEqual({ count: 1, lastDay: '2026-03-02', best: 1 });
  });

  it('partners in different zones still share the home-day', () => {
    // she is in Los Angeles (UTC-8), he is in Baghdad; she sends at 11pm LA = 10:00 next day Baghdad
    const r = computeStreak([
      { role: 'a', at: at('2026-01-11T07:00:00Z') }, // 10:00 Baghdad 1/11
      { role: 'b', at: at('2026-01-11T07:30:00Z') }, // 23:30 LA 1/10, but Baghdad says 1/11
      { role: 'a', at: at('2026-01-12T07:00:00Z') },
      { role: 'b', at: at('2026-01-12T20:00:00Z') },
    ], tz);
    expect(r.count).toBe(2);
  });

  it('a missed day restarts the count; best is kept', () => {
    const ev = [] as { role: 'a' | 'b'; at: Date }[];
    for (const d of ['01', '02', '03']) ev.push({ role: 'a', at: at(`2026-05-${d}T09:00:00Z`) }, { role: 'b', at: at(`2026-05-${d}T10:00:00Z`) });
    ev.push({ role: 'a', at: at('2026-05-05T09:00:00Z') }, { role: 'b', at: at('2026-05-05T09:01:00Z') });
    expect(computeStreak(ev, tz)).toEqual({ count: 1, lastDay: '2026-05-05', best: 3 });
  });

  it('a frozen day bridges the gap', () => {
    const ev = [
      { role: 'a' as const, at: at('2026-05-01T09:00:00Z') }, { role: 'b' as const, at: at('2026-05-01T10:00:00Z') },
      { role: 'a' as const, at: at('2026-05-03T09:00:00Z') }, { role: 'b' as const, at: at('2026-05-03T10:00:00Z') },
    ];
    expect(computeStreak(ev, tz, ['2026-05-02']).count).toBe(2);
  });

  it('works across DST in a DST home zone', () => {
    const ev = [] as { role: 'a' | 'b'; at: Date }[];
    // Europe/London: clocks go forward 2026-03-29
    for (const d of ['27', '28', '29', '30']) ev.push({ role: 'a', at: at(`2026-03-${d}T23:30:00Z`) }, { role: 'b', at: at(`2026-03-${d}T12:00:00Z`) });
    // A's 23:30Z snaps on 3/29 and 3/30 are 00:30 BST the NEXT day, so 3/29
    // only has B → chain 27,28 breaks; 3/30 completes again; 3/31 only A.
    const r = computeStreak(ev, 'Europe/London');
    expect(r).toEqual({ count: 1, lastDay: '2026-03-30', best: 2 });
  });
});

describe('streakStatus', () => {
  const tz = 'Asia/Baghdad';
  it('done / pending / at risk / freezable / broken', () => {
    const now = at('2026-06-10T09:00:00Z'); // 12:00 Baghdad 6/10
    expect(streakStatus(5, '2026-06-10', tz, now).state).toBe('done_today');
    const p = streakStatus(5, '2026-06-09', tz, now);
    expect(p.state).toBe('pending_today');
    if (p.state === 'pending_today') expect(p.atRisk).toBe(false);
    const late = streakStatus(5, '2026-06-09', tz, at('2026-06-10T18:30:00Z')); // 21:30 Baghdad
    expect(late.state === 'pending_today' && late.atRisk).toBe(true);
    expect(streakStatus(5, '2026-06-08', tz, now, 1).state).toBe('freezable');
    expect(streakStatus(5, '2026-06-08', tz, now, 0)).toEqual({ state: 'broken', count: 0, lost: 5 });
    expect(streakStatus(0, null, tz, now).state).toBe('none');
  });

  it('milestones, freezes, levels', () => {
    expect(crossedMilestone(6, 7)).toBe(7);
    expect(crossedMilestone(7, 8)).toBeNull();
    expect(crossedMilestone(99, 100)).toBe(100);
    expect(freezesAvailable(0, '2026-06', tz, at('2026-06-15T00:00:00Z'))).toBe(0);
    expect(freezesAvailable(0, '2026-05', tz, at('2026-06-15T00:00:00Z'))).toBe(1);
    expect(coupleLevel(0).level).toBe(1);
    expect(coupleLevel(25).level).toBe(2);
    expect(coupleLevel(99).level).toBe(2);
    expect(coupleLevel(100).level).toBe(3);
  });
});
