# Branded auth email templates

Paste these into **Supabase Dashboard → Authentication → Email Templates**.
Each section has the **Subject** and the **Message body (HTML)**.

- Filled in for the name **Sharevel**. If the name changes, find-and-replace it
  here and re-paste.
- These work with Supabase's default mailer. For production deliverability and a
  custom "from" address, also set up custom SMTP (e.g. Resend) + a verified
  domain (see DEPLOYMENT.md).
- The links use `{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=...` rather
  than `{{ .ConfirmationURL }}`.

  `ConfirmationURL` points at Supabase's `/verify` endpoint, which redirects to
  the app with the session in a URL **fragment** (`#access_token=...`).
  Fragments do not survive the trip through a mail app, the OS and Expo Go —
  the app receives a bare URL and cannot tell a stripped link from an invalid
  one.

  `token_hash` travels in the query string, which nothing strips, and the app
  exchanges it with `supabase.auth.verifyOtp({ token_hash, type })`. This is
  Supabase's documented pattern for mobile deep links.

- Set **Site URL** to the app's auth callback:
  - production: `travelmapping://auth-callback`
  - Expo Go development: `exp://<your-lan-ip>:8081/--/auth-callback`

  The callback screen verifies the hash and routes onward by `type`, so one
  Site URL serves signup, recovery and magic links.

A shared card style is inlined in each template (email clients ignore `<style>`
blocks, so styles must be inline).

---

## Confirm signup

**Subject:** Confirm your Sharevel account

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6fbff;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d8e6f5;border-radius:20px;overflow:hidden;">
      <tr><td style="background:#1f5ea8;padding:22px 28px;">
        <span style="color:#ffffff;font-size:20px;font-weight:800;">✈ Sharevel</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 12px;color:#15304b;font-size:22px;">Welcome aboard!</h1>
        <p style="margin:0 0 20px;color:#46627d;font-size:15px;line-height:22px;">
          Confirm your email address to start mapping and sharing your travels.
        </p>
        <a href="{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=signup" style="display:inline-block;background:#1f5ea8;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:999px;">
          Confirm email
        </a>
        <p style="margin:22px 0 0;color:#8aa1b6;font-size:12px;line-height:18px;">
          If you didn't create an Sharevel account, you can ignore this email.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## Magic Link

**Subject:** Your Sharevel sign-in link

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6fbff;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d8e6f5;border-radius:20px;overflow:hidden;">
      <tr><td style="background:#1f5ea8;padding:22px 28px;">
        <span style="color:#ffffff;font-size:20px;font-weight:800;">✈ Sharevel</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 12px;color:#15304b;font-size:22px;">Sign in to Sharevel</h1>
        <p style="margin:0 0 20px;color:#46627d;font-size:15px;line-height:22px;">
          Tap the button below to sign in. This link expires shortly.
        </p>
        <a href="{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=magiclink" style="display:inline-block;background:#1f5ea8;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:999px;">
          Sign in
        </a>
        <p style="margin:22px 0 0;color:#8aa1b6;font-size:12px;line-height:18px;">
          Didn't request this? You can safely ignore it.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## Reset Password

**Subject:** Reset your Sharevel password

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6fbff;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d8e6f5;border-radius:20px;overflow:hidden;">
      <tr><td style="background:#1f5ea8;padding:22px 28px;">
        <span style="color:#ffffff;font-size:20px;font-weight:800;">✈ Sharevel</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 12px;color:#15304b;font-size:22px;">Reset your password</h1>
        <p style="margin:0 0 20px;color:#46627d;font-size:15px;line-height:22px;">
          Tap the button below to choose a new password.
        </p>
        <a href="{{ .SiteURL }}?token_hash={{ .TokenHash }}&type=recovery" style="display:inline-block;background:#1f5ea8;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:999px;">
          Reset password
        </a>
        <p style="margin:22px 0 0;color:#8aa1b6;font-size:12px;line-height:18px;">
          If you didn't request a reset, ignore this email — your password stays the same.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```
