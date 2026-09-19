// Supabase returns PostgrestError objects, which are plain objects rather than
// Error instances. `err instanceof Error` is therefore false for every database
// failure, and the usual ternary silently swallows the real message — turning
// an actionable "permission denied for table user_blocks" into "Please try
// again."
export function errorMessage(err: unknown, fallback = 'Please try again.'): string {
  if (err instanceof Error && err.message) return err.message;

  if (typeof err === 'object' && err !== null) {
    const e = err as { message?: unknown; details?: unknown; hint?: unknown };
    if (typeof e.message === 'string' && e.message) return e.message;
    if (typeof e.details === 'string' && e.details) return e.details;
    if (typeof e.hint === 'string' && e.hint) return e.hint;
  }

  if (typeof err === 'string' && err) return err;
  return fallback;
}
