import { evaluatePassword, MIN_PASSWORD_LENGTH } from '@/features/auth/password-policy';

describe('evaluatePassword', () => {
  it('rejects an empty password', () => {
    const r = evaluatePassword('');
    expect(r.ok).toBe(false);
    expect(r.strength).toBe('weak');
    expect(r.error).toBe('Enter a password.');
  });

  it('rejects passwords shorter than the minimum length', () => {
    const r = evaluatePassword('ab1');
    expect(r.ok).toBe(false);
    expect(r.checks.minLength).toBe(false);
    expect(r.error).toContain(String(MIN_PASSWORD_LENGTH));
  });

  it('requires both a letter and a number', () => {
    expect(evaluatePassword('12345678').ok).toBe(false); // no letter
    expect(evaluatePassword('abcdefgh').ok).toBe(false); // no number
  });

  it('rejects common passwords even when they meet the character rules', () => {
    const r = evaluatePassword('password123');
    expect(r.ok).toBe(false);
    expect(r.checks.notCommon).toBe(false);
    expect(r.strength).toBe('weak');
    expect(r.error).toContain('common');
  });

  it('accepts a reasonable password', () => {
    const r = evaluatePassword('aegean2026');
    expect(r.ok).toBe(true);
    expect(r.error).toBeNull();
    expect(r.checks).toEqual({
      minLength: true,
      hasLetter: true,
      hasNumber: true,
      notCommon: true,
    });
  });

  it('scores longer, mixed passwords as stronger', () => {
    expect(evaluatePassword('abcd1234').strength).toBe('weak');
    expect(evaluatePassword('abcdefgh1234').strength).toBe('fair');
    expect(evaluatePassword('Santorini2026!').strength).toBe('strong');
  });
});
