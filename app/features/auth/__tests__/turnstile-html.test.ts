import {
  buildTurnstileHtml,
  parseTurnstileMessage,
  TURNSTILE_BASE_URL,
} from '@/features/auth/turnstile-html';

describe('buildTurnstileHtml', () => {
  const html = buildTurnstileHtml('0xTESTKEY');

  it('loads the Turnstile script with explicit rendering', () => {
    expect(html).toContain('challenges.cloudflare.com/turnstile/v0/api.js');
    expect(html).toContain('render=explicit');
    expect(html).toContain('onload=onTurnstileReady');
  });

  it('renders with the supplied site key', () => {
    expect(html).toContain('sitekey: "0xTESTKEY"');
  });

  it('quotes the site key rather than interpolating it raw', () => {
    // Defensive: the key is public, but it still lands in a script context.
    const nasty = buildTurnstileHtml('a"; alert(1); var x="');
    expect(nasty).not.toContain('alert(1); var x=""');
    expect(nasty).toContain(JSON.stringify('a"; alert(1); var x="'));
  });

  it('wires every Turnstile callback back over the bridge', () => {
    for (const cb of ['callback', 'error-callback', 'expired-callback', 'timeout-callback']) {
      expect(html).toContain(cb);
    }
    expect(html).toContain('window.ReactNativeWebView.postMessage');
  });

  it('reports script load failures instead of hanging silently', () => {
    expect(html).toContain('window.onerror');
  });
});

describe('TURNSTILE_BASE_URL', () => {
  it('is the hostname registered on the Cloudflare widget', () => {
    // Turnstile validates the requesting hostname. If this drifts from the
    // widget configuration, every challenge fails with a domain error.
    expect(TURNSTILE_BASE_URL).toBe('https://sharevel.app');
  });
});

describe('parseTurnstileMessage', () => {
  it('reads a token message', () => {
    expect(parseTurnstileMessage('{"type":"token","token":"abc"}')).toEqual({
      type: 'token',
      token: 'abc',
    });
  });

  it('rejects a token message with no usable token', () => {
    expect(parseTurnstileMessage('{"type":"token","token":""}')).toBeNull();
    expect(parseTurnstileMessage('{"type":"token"}')).toBeNull();
    expect(parseTurnstileMessage('{"type":"token","token":123}')).toBeNull();
  });

  it('reads error, expired and ready messages', () => {
    expect(parseTurnstileMessage('{"type":"error","code":"timeout"}')).toEqual({
      type: 'error',
      code: 'timeout',
    });
    expect(parseTurnstileMessage('{"type":"expired"}')).toEqual({ type: 'expired' });
    expect(parseTurnstileMessage('{"type":"ready"}')).toEqual({ type: 'ready' });
  });

  it('defaults a missing error code rather than dropping the error', () => {
    expect(parseTurnstileMessage('{"type":"error"}')).toEqual({ type: 'error', code: 'unknown' });
  });

  it('ignores anything that is not a recognised message', () => {
    // A WebView can post arbitrary strings; none of these should be acted on.
    for (const raw of ['', 'not json', 'null', '[]', '"token"', '{"type":"nope"}', '{}']) {
      expect(parseTurnstileMessage(raw)).toBeNull();
    }
  });
});
