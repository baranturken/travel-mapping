import { supabase } from '@/lib/supabase';

// Calls the delete-account edge function, which removes the user's storage
// files and deletes the auth user (DB rows cascade). After it succeeds the
// server-side session is already gone; signOut() just clears local state.
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) {
    throw new Error(error.message || 'Could not delete account.');
  }
  if (data && typeof data === 'object' && 'error' in data && data.error) {
    throw new Error(String(data.error));
  }
  await supabase.auth.signOut().catch(() => {
    // The user no longer exists server-side; ignore sign-out errors.
  });
}
