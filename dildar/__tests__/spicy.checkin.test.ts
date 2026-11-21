import { isCheckinDue, shouldShowCheckinBanner, daysUntilCheckin } from '../features/spicy/checkin';

const now = new Date('2026-06-30T12:00:00Z');

describe('monthly boundaries check-in', () => {
  it('is due when never done or older than 30 days', () => {
    expect(isCheckinDue(null, now)).toBe(true);
    expect(isCheckinDue('garbage', now)).toBe(true);
    expect(isCheckinDue('2026-06-15T12:00:00Z', now)).toBe(false);
    expect(isCheckinDue('2026-05-31T12:00:00Z', now)).toBe(false); // exactly 30 days
    expect(isCheckinDue('2026-05-31T11:59:00Z', now)).toBe(true);
  });

  it('banner only for people who use the list', () => {
    expect(shouldShowCheckinBanner(0, null, now)).toBe(false);
    expect(shouldShowCheckinBanner(3, null, now)).toBe(true);
    expect(shouldShowCheckinBanner(3, '2026-06-20T00:00:00Z', now)).toBe(false);
  });

  it('counts days until the next one', () => {
    expect(daysUntilCheckin(null, now)).toBe(0);
    expect(daysUntilCheckin('2026-06-20T12:00:00Z', now)).toBe(20);
    expect(daysUntilCheckin('2026-01-01T00:00:00Z', now)).toBe(0);
  });
});
