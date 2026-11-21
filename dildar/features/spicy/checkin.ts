/** Monthly boundaries check-in rules (pure, unit-tested). */
export const CHECKIN_INTERVAL_DAYS = 30;

/** Due when never done, or the last one is older than the interval. */
export function isCheckinDue(lastAt: string | Date | null | undefined, now: Date = new Date(), days = CHECKIN_INTERVAL_DAYS): boolean {
  if (!lastAt) return true;
  const t = typeof lastAt === 'string' ? Date.parse(lastAt) : lastAt.getTime();
  if (!Number.isFinite(t)) return true;
  return now.getTime() - t > days * 86_400_000;
}

/** Only nag people who actually use the list (≥1 answer). */
export function shouldShowCheckinBanner(answerCount: number, lastAt: string | null | undefined, now: Date = new Date()): boolean {
  return answerCount > 0 && isCheckinDue(lastAt, now);
}

/** Days until next check-in (0 when due). */
export function daysUntilCheckin(lastAt: string | null | undefined, now: Date = new Date()): number {
  if (!lastAt) return 0;
  const left = Date.parse(lastAt) + CHECKIN_INTERVAL_DAYS * 86_400_000 - now.getTime();
  return Math.max(0, Math.ceil(left / 86_400_000));
}
