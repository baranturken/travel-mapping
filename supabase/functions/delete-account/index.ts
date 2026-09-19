// Deletes the calling user's account. Apple requires an in-app account
// deletion path; this function is the server side of it.
//
// Auth: the platform verifies the JWT (verify_jwt=true) before we run. We then
// resolve the user from that same token, so a user can only ever delete
// themselves — there is no user id parameter to tamper with.
//
// Order matters: storage objects are cleaned up first (they do not cascade),
// then auth.users is deleted, which cascades through profiles →
// published_trips / follows / trip_likes / trip_comments.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BUCKET = 'trip-photos';

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    return json(500, { error: 'Server misconfigured' });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Resolve the caller from their own JWT.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData?.user) {
    return json(401, { error: 'Not authenticated' });
  }
  const userId = userData.user.id;

  // Collect every object under the user's folder (photos live at
  // {userId}/{tripId|avatar|banner}/file.jpg; recurse to be depth-proof).
  async function collectPaths(prefix: string, depth: number): Promise<string[]> {
    if (depth > 6) return [];
    const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (error || !data) return [];
    const paths: string[] = [];
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) {
        paths.push(full); // a file
      } else {
        paths.push(...(await collectPaths(full, depth + 1))); // a folder
      }
    }
    return paths;
  }

  try {
    const paths = await collectPaths(userId, 0);
    if (paths.length > 0) {
      // remove() accepts batches; stay under the request size limit.
      for (let i = 0; i < paths.length; i += 100) {
        await admin.storage.from(BUCKET).remove(paths.slice(i, i + 100));
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      return json(500, { error: `Could not delete account: ${deleteError.message}` });
    }

    return json(200, { ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return json(500, { error: message });
  }
});
