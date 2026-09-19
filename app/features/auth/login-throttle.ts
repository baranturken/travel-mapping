import AsyncStorage from '@react-native-async-storage/async-storage';

// Basic client-side brute-force throttle: after MAX_ATTEMPTS consecutive failed
// sign-ins for an email, lock further attempts for LOCK_MINUTES. This is a
// usability guardrail, not a substitute for server-side protection (Supabase
// rate limits + Turnstile CAPTCHA) — a determined attacker can reset local
// state, so pair it with those.
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

type ThrottleState = { fails: number; lockedUntil: number | null };

function storageKey(email: string): string {
  return `login-throttle:${email.trim().toLowerCase()}`;
}

async function read(email: string): Promise<ThrottleState> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(email));
    if (!raw) return { fails: 0, lockedUntil: null };
    return JSON.parse(raw) as ThrottleState;
  } catch {
    return { fails: 0, lockedUntil: null };
  }
}

async function write(email: string, state: ThrottleState): Promise<void> {
  try {
    await AsyncStorage.setItem(storageKey(email), JSON.stringify(state));
  } catch {
    // best-effort
  }
}

// Returns milliseconds remaining on the lock, or null if not locked.
export async function getLockRemainingMs(email: string): Promise<number | null> {
  const { lockedUntil } = await read(email);
  if (lockedUntil && lockedUntil > Date.now()) return lockedUntil - Date.now();
  return null;
}

export async function recordFailedAttempt(email: string): Promise<void> {
  const state = await read(email);
  const fails = state.fails + 1;
  const lockedUntil =
    fails >= MAX_ATTEMPTS ? Date.now() + LOCK_MINUTES * 60_000 : state.lockedUntil ?? null;
  await write(email, { fails, lockedUntil });
}

export async function clearAttempts(email: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(storageKey(email));
  } catch {
    // best-effort
  }
}

export function formatLockMessage(remainingMs: number): string {
  const mins = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`;
}
