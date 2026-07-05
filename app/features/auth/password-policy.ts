// Client-side password policy. This is a usability guardrail that gives users
// immediate feedback and blocks the weakest passwords before they ever reach
// the server. It is NOT a replacement for server-side protection: enable
// Supabase Auth → Attack Protection (leaked-password / HaveIBeenPwned check and
// minimum-strength requirements) so the rules are enforced on the backend too.

export const MIN_PASSWORD_LENGTH = 8;

// A tiny blocklist of the most-guessed passwords. HaveIBeenPwned (enabled in the
// Supabase dashboard) is the real defense against leaked credentials; this just
// stops the obvious ones instantly, offline.
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  'letmein',
  'iloveyou',
  'admin123',
  'welcome1',
  'football',
  'baseball',
  'trustno1',
  'sunshine',
  'princess',
  'monkey123',
]);

export type PasswordStrength = 'weak' | 'fair' | 'strong';

export type PasswordCheck = {
  minLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  notCommon: boolean;
};

export type PasswordResult = {
  ok: boolean;
  checks: PasswordCheck;
  strength: PasswordStrength;
  // First human-readable reason the password is rejected, or null when ok.
  error: string | null;
};

export function evaluatePassword(password: string): PasswordResult {
  const lower = password.toLowerCase();
  const checks: PasswordCheck = {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    hasLetter: /[a-zA-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    notCommon: password.length > 0 && !COMMON_PASSWORDS.has(lower),
  };

  const ok = checks.minLength && checks.hasLetter && checks.hasNumber && checks.notCommon;

  let error: string | null = null;
  if (password.length === 0) error = 'Enter a password.';
  else if (!checks.notCommon) error = 'That password is too common — choose something less guessable.';
  else if (!checks.minLength) error = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  else if (!checks.hasLetter) error = 'Include at least one letter.';
  else if (!checks.hasNumber) error = 'Include at least one number.';

  return { ok, checks, strength: scoreStrength(password, checks), error };
}

function scoreStrength(password: string, checks: PasswordCheck): PasswordStrength {
  if (!checks.notCommon || password.length === 0) return 'weak';
  let score = 0;
  if (password.length >= MIN_PASSWORD_LENGTH) score++;
  if (password.length >= 12) score++;
  if (checks.hasLetter && checks.hasNumber) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;

  if (score <= 2) return 'weak';
  if (score <= 3) return 'fair';
  return 'strong';
}
