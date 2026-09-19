// Client-side password policy. This is a usability guardrail that gives users
// immediate feedback before a password ever reaches the server.
//
// These rules deliberately MIRROR the server-side settings configured in
// Supabase → Authentication → Sign In / Providers → Password:
//
//   Minimum password length:  10
//   Password requirements:    lowercase, uppercase, digits and symbols
//
// Keeping the two in sync matters. If the client is more permissive than the
// server, the strength meter turns green, the user submits, and Supabase
// rejects it with a raw API error they cannot act on. If either side is
// changed, change the other.
//
// Server-side leaked-password protection (HaveIBeenPwned) is enabled in the
// same dashboard screen and is the real defense against breached credentials;
// the small blocklist below only catches the obvious ones instantly, offline.

export const MIN_PASSWORD_LENGTH = 10;

// A tiny blocklist of the most-guessed passwords. Matching is case-insensitive.
const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  'password1234',
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
  hasLower: boolean;
  hasUpper: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  notCommon: boolean;
};

export type PasswordResult = {
  ok: boolean;
  checks: PasswordCheck;
  strength: PasswordStrength;
  // First human-readable reason the password is rejected, or null when ok.
  error: string | null;
};

// Anything that is not a letter or a digit counts as a symbol, which matches
// how Supabase evaluates the "symbols" requirement.
const SYMBOL_RE = /[^a-zA-Z0-9]/;

export function evaluatePassword(password: string): PasswordResult {
  const lower = password.toLowerCase();
  const checks: PasswordCheck = {
    minLength: password.length >= MIN_PASSWORD_LENGTH,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: SYMBOL_RE.test(password),
    notCommon: password.length > 0 && !COMMON_PASSWORDS.has(lower),
  };

  const ok =
    checks.minLength &&
    checks.hasLower &&
    checks.hasUpper &&
    checks.hasNumber &&
    checks.hasSymbol &&
    checks.notCommon;

  let error: string | null = null;
  if (password.length === 0) error = 'Enter a password.';
  else if (!checks.notCommon) error = 'That password is too common — choose something less guessable.';
  else if (!checks.minLength) error = `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  else if (!checks.hasLower) error = 'Include at least one lowercase letter.';
  else if (!checks.hasUpper) error = 'Include at least one uppercase letter.';
  else if (!checks.hasNumber) error = 'Include at least one number.';
  else if (!checks.hasSymbol) error = 'Include at least one symbol, like ! ? # or -';

  return { ok, checks, strength: scoreStrength(password, checks), error };
}

// The meter reflects how much margin a password has over the minimum bar, not
// whether it passes — a password that only just satisfies every rule is still
// a short password, and showing it as "strong" would be misleading.
function scoreStrength(password: string, checks: PasswordCheck): PasswordStrength {
  if (!checks.notCommon || password.length === 0) return 'weak';
  if (!ok(checks)) return 'weak';

  let score = 0;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  // More than a token single symbol / digit.
  if ((password.match(/[^a-zA-Z0-9]/g) ?? []).length >= 2) score++;
  if ((password.match(/[0-9]/g) ?? []).length >= 2) score++;

  if (score <= 1) return 'fair';
  return 'strong';
}

function ok(checks: PasswordCheck): boolean {
  return (
    checks.minLength &&
    checks.hasLower &&
    checks.hasUpper &&
    checks.hasNumber &&
    checks.hasSymbol
  );
}
