/**
 * Time-zone helpers built only on Intl (works on Hermes and Node).
 * Used for: couple-day boundaries (streaks), "deliver at 9pm her time"
 * scheduling, and showing each partner's local clock.
 */

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function dtf(timeZone: string): Intl.DateTimeFormat {
  let f = dtfCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    dtfCache.set(timeZone, f);
  }
  return f;
}

export function zonedParts(date: Date, timeZone: string): Parts {
  const out: Record<string, number> = {};
  for (const p of dtf(timeZone).formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

/** Offset of `timeZone` from UTC at `date`, in minutes (e.g. Baghdad = +180). */
export function tzOffsetMinutes(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const ms = date.getTime() - (date.getTime() % 1000);
  return Math.round((asUtc - ms) / 60000);
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Calendar day (YYYY-MM-DD) of `date` as seen in `timeZone`. */
export function dayKey(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

/**
 * Convert a wall-clock time in `timeZone` to a UTC Date.
 * DST gaps (e.g. 02:30 on spring-forward day) resolve forward to the first
 * valid instant; ambiguous fall-back times resolve to the earlier instant.
 */
export function zonedWallTimeToUtc(
  wall: { year: number; month: number; day: number; hour: number; minute: number },
  timeZone: string,
): Date {
  const naive = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute);
  // two-pass offset correction
  const o1 = tzOffsetMinutes(new Date(naive), timeZone);
  let guess = naive - o1 * 60000;
  const o2 = tzOffsetMinutes(new Date(guess), timeZone);
  if (o2 !== o1) {
    const alt = naive - o2 * 60000;
    const p = zonedParts(new Date(alt), timeZone);
    // alt is valid if it maps back to the requested wall time
    if (p.hour === wall.hour && p.minute === wall.minute) {
      guess = Math.min(guess, alt);
    } else {
      guess = Math.max(guess, alt);
    }
  }
  return new Date(guess);
}

/** Start (UTC instant) of the next local midnight after `date` in `timeZone`. */
export function nextMidnightUtc(date: Date, timeZone: string): Date {
  const [y, m, d] = addDays(dayKey(date, timeZone), 1).split('-').map(Number);
  return zonedWallTimeToUtc({ year: y, month: m, day: d, hour: 0, minute: 0 }, timeZone);
}

export function msLeftInDay(date: Date, timeZone: string): number {
  return nextMidnightUtc(date, timeZone).getTime() - date.getTime();
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Baghdad';
  } catch {
    return 'Asia/Baghdad';
  }
}

export function formatClock(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

/** Compact countdown pieces. */
export function splitDuration(ms: number): { d: number; h: number; m: number; s: number } {
  const t = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 };
}

/** Common zones for the picker (users can still type any IANA name). */
export const COMMON_TIMEZONES = [
  'Asia/Baghdad',
  'Asia/Tehran',
  'Europe/Istanbul',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Stockholm',
  'Europe/Paris',
  'Europe/Amsterdam',
  'Asia/Dubai',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'America/Toronto',
  'Australia/Sydney',
];
