import { evaluatePassword, MIN_PASSWORD_LENGTH } from '@/features/auth/password-policy';

describe('evaluatePassword', () => {
  it('rejects an empty password', () => {
    const r = evaluatePassword('');
    expect(r.ok).toBe(false);
    expect(r.strength).toBe('weak');
    expect(r.error).toBe('Enter a password.');
  });

  it('rejects passwords shorter than the minimum length', () => {
    const r = evaluatePassword('Ab1!');
    expect(r.ok).toBe(false);
    expect(r.checks.minLength).toBe(false);
    expect(r.error).toContain(String(MIN_PASSWORD_LENGTH));
  });

  // These mirror the Supabase dashboard setting "lowercase, uppercase, digits
  // and symbols". Each case is long enough to pass the length rule so that the
  // character rule is what fails.
  it('requires a lowercase letter', () => {
    const r = evaluatePassword('SANTORINI2026!');
    expect(r.ok).toBe(false);
    expect(r.checks.hasLower).toBe(false);
    expect(r.error).toContain('lowercase');
  });

  it('requires an uppercase letter', () => {
    const r = evaluatePassword('santorini2026!');
    expect(r.ok).toBe(false);
    expect(r.checks.hasUpper).toBe(false);
    expect(r.error).toContain('uppercase');
  });

  it('requires a number', () => {
    const r = evaluatePassword('SantoriniTrip!');
    expect(r.ok).toBe(false);
    expect(r.checks.hasNumber).toBe(false);
    expect(r.error).toContain('number');
  });

  it('requires a symbol', () => {
    const r = evaluatePassword('Santorini2026');
    expect(r.ok).toBe(false);
    expect(r.checks.hasSymbol).toBe(false);
    expect(r.error).toContain('symbol');
  });

  it('rejects common passwords even when they meet the character rules', () => {
    const r = evaluatePassword('password1234');
    expect(r.ok).toBe(false);
    expect(r.checks.notCommon).toBe(false);
    expect(r.strength).toBe('weak');
    expect(r.error).toContain('common');
  });

  it('accepts a password that satisfies every rule', () => {
    const r = evaluatePassword('Santorini2026!');
    expect(r.ok).toBe(true);
    expect(r.error).toBeNull();
    expect(r.checks).toEqual({
      minLength: true,
      hasLower: true,
      hasUpper: true,
      hasNumber: true,
      hasSymbol: true,
      notCommon: true,
    });
  });

  // Regression guard for the bug this policy was rewritten to fix: the old
  // client rules (8 chars, a letter and a number) accepted passwords that the
  // Supabase server then rejected, so the meter went green and the request
  // failed with an unactionable API error.
  it('rejects passwords the old 8-char letter+number policy would have accepted', () => {
    for (const password of ['aegean2026', 'traveler1', 'istanbul24']) {
      expect(evaluatePassword(password).ok).toBe(false);
    }
  });

  it('never reports a failing password as anything but weak', () => {
    for (const password of ['short1!A', 'nouppercase2026!', 'NOLOWERCASE2026!']) {
      const r = evaluatePassword(password);
      expect(r.ok).toBe(false);
      expect(r.strength).toBe('weak');
    }
  });

  it('scores margin over the minimum bar, not mere compliance', () => {
    // Passes every rule, but only just — 10 chars, one digit, one symbol.
    expect(evaluatePassword('Aegean202!').strength).toBe('fair');
    // Longer with more digits and symbols.
    expect(evaluatePassword('Santorini-2026-Ferry!').strength).toBe('strong');
  });
});
