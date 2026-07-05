import { supabase } from '@/lib/supabase';

// Thin wrappers around supabase.auth.mfa for TOTP two-factor auth.
//
// Enrollment: enroll() -> user adds the secret to an authenticator app ->
// challenge + verify a first code to activate the factor.
// Sign-in: password auth yields an AAL1 session; when a verified factor
// exists the app must challenge + verify a code to reach AAL2.

export type MfaStatus = {
  // A verified TOTP factor exists on the account.
  enabled: boolean;
  // Session is AAL1 but the account requires AAL2 — show the challenge screen.
  verificationNeeded: boolean;
  // The verified factor to challenge against (or the one to unenroll).
  factorId: string | null;
};

export async function getMfaStatus(): Promise<MfaStatus> {
  const [{ data: factorData }, { data: aalData }] = await Promise.all([
    supabase.auth.mfa.listFactors(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  const verified = factorData?.totp?.find((f) => f.status === 'verified') ?? null;
  return {
    enabled: Boolean(verified),
    verificationNeeded:
      aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2',
    factorId: verified?.id ?? null,
  };
}

export type TotpEnrollment = {
  factorId: string;
  secret: string;
  // otpauth:// URI that authenticator apps can open directly.
  uri: string;
};

export async function enrollTotp(): Promise<TotpEnrollment> {
  // Clean up any dangling unverified factor from an abandoned attempt first —
  // Supabase rejects a second enroll with the same friendly name otherwise.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  for (const f of existing?.totp ?? []) {
    if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  }

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) throw error;
  return { factorId: data.id, secret: data.totp.secret, uri: data.totp.uri };
}

// Used both to activate a new factor (enrollment) and to elevate an AAL1
// session at sign-in — Supabase treats them as the same challenge+verify.
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeError) throw challengeError;
  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code: code.trim(),
  });
  if (verifyError) throw verifyError;
}

export async function unenrollTotp(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}
