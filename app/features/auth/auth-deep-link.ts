// Shared parsing for the auth deep links Supabase sends us.
//
// Supabase hands back a session in one of two shapes depending on the flow:
//   implicit — tokens in the URL *hash fragment*:
//              travelmapping://auth-callback#access_token=...&refresh_token=...
//   PKCE     — a one-time code in the *query string*:
//              travelmapping://auth-callback?code=...
//
// Errors can arrive in either place too (an expired link, a cancelled consent).
// Both the password-recovery screen and the auth callback screen need to read
// all of these, so the parsing lives here rather than being copied per screen.

export type AuthDeepLinkParams = {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  errorDescription: string | null;
};

/**
 * Pull key=value pairs out of a URL hash fragment. Returns an empty object when
 * the URL has no fragment.
 */
export function parseFragment(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) return {};

  const params: Record<string, string> = {};
  for (const pair of url.slice(hashIndex + 1).split('&')) {
    const eq = pair.indexOf('=');
    if (eq > 0) {
      params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
    }
  }
  return params;
}

/**
 * Pull key=value pairs out of a URL query string, stopping at the fragment so a
 * hash-delivered token is never mistaken for a query parameter.
 */
export function parseQuery(url: string): Record<string, string> {
  const hashIndex = url.indexOf('#');
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex);
  const qIndex = beforeHash.indexOf('?');
  if (qIndex === -1) return {};

  const params: Record<string, string> = {};
  for (const pair of beforeHash.slice(qIndex + 1).split('&')) {
    const eq = pair.indexOf('=');
    if (eq > 0) {
      params[decodeURIComponent(pair.slice(0, eq))] = decodeURIComponent(pair.slice(eq + 1));
    }
  }
  return params;
}

/**
 * Normalise an auth deep link into the pieces a screen actually acts on,
 * regardless of which flow produced it.
 */
export function extractAuthParams(url: string): AuthDeepLinkParams {
  const fragment = parseFragment(url);
  const query = parseQuery(url);

  return {
    accessToken: fragment.access_token ?? query.access_token ?? null,
    refreshToken: fragment.refresh_token ?? query.refresh_token ?? null,
    code: query.code ?? fragment.code ?? null,
    errorDescription:
      fragment.error_description ??
      query.error_description ??
      fragment.error ??
      query.error ??
      null,
  };
}
