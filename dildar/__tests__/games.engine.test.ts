import { shouldAccept, merge, conflictDelay, MAX_APPLY_ATTEMPTS } from '../features/games/engineCore';

describe('game sync merge rules', () => {
  const local = { version: 5, state: { v: 'local' }, status: 'active' as const };
  it('broadcasts only apply when strictly newer', () => {
    expect(shouldAccept(5, 5, 'broadcast')).toBe(false);
    expect(shouldAccept(5, 6, 'broadcast')).toBe(true);
    expect(merge(local, { version: 4, state: { v: 'old' }, status: 'active' }, 'broadcast')).toBe(local);
  });
  it('database rows win on equal version (replace rejected optimistic state)', () => {
    const db = { version: 5, state: { v: 'server' }, status: 'active' as const };
    expect(merge(local, db, 'db')).toBe(db);
    expect(merge(local, { ...db, version: 4 }, 'db')).toBe(local);
  });
  it('backs off on conflicts with a cap', () => {
    expect(conflictDelay(0)).toBe(60);
    expect(conflictDelay(10)).toBe(600);
    expect(MAX_APPLY_ATTEMPTS).toBeGreaterThanOrEqual(3);
  });
});
