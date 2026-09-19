import { extractAuthParams, parseFragment, parseQuery } from '@/features/auth/auth-deep-link';

describe('parseFragment', () => {
  it('returns nothing when there is no fragment', () => {
    expect(parseFragment('travelmapping://auth-callback')).toEqual({});
    expect(parseFragment('travelmapping://auth-callback?code=abc')).toEqual({});
  });

  it('decodes percent-encoded values', () => {
    const params = parseFragment('travelmapping://x#error_description=Link%20has%20expired');
    expect(params.error_description).toBe('Link has expired');
  });

  it('keeps values that themselves contain "="', () => {
    const params = parseFragment('travelmapping://x#access_token=aa.bb==&refresh_token=cc');
    expect(params.access_token).toBe('aa.bb==');
    expect(params.refresh_token).toBe('cc');
  });
});

describe('parseQuery', () => {
  it('reads query parameters', () => {
    expect(parseQuery('travelmapping://auth-callback?code=xyz').code).toBe('xyz');
  });

  it('does not treat fragment content as query parameters', () => {
    // The "?" here lives inside the fragment, so there is no query string.
    expect(parseQuery('travelmapping://auth-callback#a=1?code=leaked')).toEqual({});
  });

  it('stops at the fragment so a hash token is not read as a query value', () => {
    const params = parseQuery('travelmapping://auth-callback?code=real#access_token=other');
    expect(params.code).toBe('real');
    expect(params.access_token).toBeUndefined();
  });
});

describe('extractAuthParams', () => {
  it('reads the implicit flow (tokens in the fragment)', () => {
    const r = extractAuthParams(
      'travelmapping://auth-callback#access_token=AT&refresh_token=RT&token_type=bearer',
    );
    expect(r.accessToken).toBe('AT');
    expect(r.refreshToken).toBe('RT');
    expect(r.code).toBeNull();
    expect(r.errorDescription).toBeNull();
  });

  it('reads the PKCE flow (code in the query string)', () => {
    const r = extractAuthParams('travelmapping://auth-callback?code=ONE_TIME');
    expect(r.code).toBe('ONE_TIME');
    expect(r.accessToken).toBeNull();
    expect(r.refreshToken).toBeNull();
  });

  it('surfaces an error description from either location', () => {
    expect(
      extractAuthParams('travelmapping://auth-callback#error_description=Expired')
        .errorDescription,
    ).toBe('Expired');
    expect(
      extractAuthParams('travelmapping://auth-callback?error_description=Denied').errorDescription,
    ).toBe('Denied');
  });

  it('falls back to a bare error code when there is no description', () => {
    const r = extractAuthParams('travelmapping://auth-callback?error=access_denied');
    expect(r.errorDescription).toBe('access_denied');
  });

  it('returns all-null for a link carrying no auth payload', () => {
    expect(extractAuthParams('travelmapping://auth-callback')).toEqual({
      accessToken: null,
      refreshToken: null,
      code: null,
      errorDescription: null,
    });
  });

  it('handles the Expo Go development URL shape', () => {
    // Expo Go deep links route through exp:// with a /--/ prefix.
    const r = extractAuthParams('exp://192.168.1.7:8081/--/auth-callback?code=DEV');
    expect(r.code).toBe('DEV');
  });
});
