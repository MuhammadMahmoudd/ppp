import { checkPin, isValidPin, lockoutSeconds, makePinRecord, parsePinRecord, safeEqual } from '../features/vault/pinHash';

describe('vault PIN', () => {
  it('validates 4–6 digits only', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('123456')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('1234567')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin('١٢٣٤')).toBe(false);
  });

  it('hashes with a random salt and verifies', () => {
    const r1 = makePinRecord('2580', 200);
    const r2 = makePinRecord('2580', 200);
    expect(r1.salt).not.toBe(r2.salt);
    expect(r1.hash).not.toBe(r2.hash);
    expect(r1.hash).not.toContain('2580');
    expect(checkPin('2580', r1)).toBe(true);
    expect(checkPin('2581', r1)).toBe(false);
    expect(checkPin('abc', r1)).toBe(false);
    expect(() => makePinRecord('12')).toThrow('invalid_pin');
  });

  it('serializes records safely', () => {
    const r = makePinRecord('123456', 100);
    expect(parsePinRecord(JSON.stringify(r))).toEqual(r);
    expect(parsePinRecord('nope')).toBeNull();
    expect(parsePinRecord(null)).toBeNull();
    expect(parsePinRecord('{"v":2}')).toBeNull();
  });

  it('backs off after 5 failures', () => {
    expect(lockoutSeconds(4)).toBe(0);
    expect(lockoutSeconds(5)).toBe(30);
    expect(lockoutSeconds(6)).toBe(60);
    expect(lockoutSeconds(30)).toBe(900);
  });

  it('safeEqual', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
