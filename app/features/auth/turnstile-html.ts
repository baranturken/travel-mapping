// Builds the self-contained page that hosts the Cloudflare Turnstile widget
// inside a WebView.
//
// Why a WebView at all: Turnstile is a browser widget. The usual React wrappers
// (@marsidev/react-turnstile and friends) are web-only and do not run under
// React Native, so the widget has to be rendered in a real browser context and
// the resulting token passed back over the bridge.
//
// The page is rendered with `baseUrl: 'https://sharevel.app'` (see
// TURNSTILE_BASE_URL) so the WebView presents that origin. Turnstile validates
// the requesting hostname against the widget's configured hostname list, and a
// WebView rendering raw HTML otherwise has no origin to check.

export const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY ?? '';

// Must match a hostname registered on the Turnstile widget in Cloudflare.
export const TURNSTILE_BASE_URL = 'https://sharevel.app';

// Messages the page posts back over the React Native bridge.
export type TurnstileMessage =
  | { type: 'token'; token: string }
  | { type: 'error'; code: string }
  | { type: 'expired' }
  | { type: 'ready' };

export function parseTurnstileMessage(raw: string): TurnstileMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { type } = parsed as { type?: unknown };

    if (type === 'token') {
      const { token } = parsed as { token?: unknown };
      return typeof token === 'string' && token.length > 0 ? { type: 'token', token } : null;
    }
    if (type === 'error') {
      const { code } = parsed as { code?: unknown };
      return { type: 'error', code: typeof code === 'string' ? code : 'unknown' };
    }
    if (type === 'expired') return { type: 'expired' };
    if (type === 'ready') return { type: 'ready' };
    return null;
  } catch {
    return null;
  }
}

export function buildTurnstileHtml(siteKey: string): string {
  // The site key is public, but it is still interpolated into a script context,
  // so quote-escape it rather than trusting its shape.
  const safeKey = JSON.stringify(siteKey);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 76px;
      padding: 4px 0;
    }
  </style>
</head>
<body>
  <div id="wrap"><div id="cf"></div></div>
  <script>
    function post(message) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }
    }

    // Surface script/network failures instead of hanging until the caller's
    // timeout — a blocked CDN is otherwise indistinguishable from a slow one.
    window.onerror = function (msg) {
      post({ type: 'error', code: 'script:' + String(msg).slice(0, 120) });
    };

    window.onTurnstileReady = function () {
      try {
        turnstile.render('#cf', {
          sitekey: ${safeKey},
          theme: 'light',
          callback: function (token) { post({ type: 'token', token: token }); },
          'error-callback': function (code) { post({ type: 'error', code: String(code || 'unknown') }); },
          'expired-callback': function () { post({ type: 'expired' }); },
          'timeout-callback': function () { post({ type: 'error', code: 'timeout' }); }
        });
        post({ type: 'ready' });
      } catch (e) {
        post({ type: 'error', code: 'render:' + String(e).slice(0, 120) });
      }
    };
  </script>
  <script
    src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileReady"
    async defer></script>
</body>
</html>`;
}
