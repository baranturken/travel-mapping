# Branded auth email templates

Paste these into **Supabase Dashboard → Authentication → Email Templates**.
Each section has the **Subject** and the **Message body (HTML)**.

- Replace `APP_NAME` with the final app name once chosen.
- These work with Supabase's default mailer. For production deliverability and a
  custom "from" address, also set up custom SMTP (e.g. Resend) + a verified
  domain (see DEPLOYMENT.md).
- Keep the `{{ .ConfirmationURL }}` / `{{ .Token }}` variables — Supabase fills
  them in.

A shared card style is inlined in each template (email clients ignore `<style>`
blocks, so styles must be inline).

---

## Confirm signup

**Subject:** Confirm your APP_NAME account

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6fbff;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d8e6f5;border-radius:20px;overflow:hidden;">
      <tr><td style="background:#1f5ea8;padding:22px 28px;">
        <span style="color:#ffffff;font-size:20px;font-weight:800;">✈ APP_NAME</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 12px;color:#15304b;font-size:22px;">Welcome aboard!</h1>
        <p style="margin:0 0 20px;color:#46627d;font-size:15px;line-height:22px;">
          Confirm your email address to start mapping and sharing your travels.
        </p>
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#1f5ea8;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:999px;">
          Confirm email
        </a>
        <p style="margin:22px 0 0;color:#8aa1b6;font-size:12px;line-height:18px;">
          If you didn't create an APP_NAME account, you can ignore this email.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
```

---

## Magic Link

**Subject:** Your APP_NAME sign-in link

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6fbff;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d8e6f5;border-radius:20px;overflow:hidden;">
      <tr><td style="background:#1f5ea8;padding:22px 28px;">
        <span style="color:#ffffff;font-size:20px;font-weight:800;">✈ APP_NAME</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 12px;color:#15304b;font-size:22px;">Sign in to APP_NAME</h1>
        <p style="margin:0 0 20px;color:#46627d;font-size:15px;line-height:22px;">
          Tap the button below to sign in. This link expires shortly.
        </p>
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#1f5ea8;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:999px;">
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

**Subject:** Reset your APP_NAME password

```html
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6fbff;padding:32px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #d8e6f5;border-radius:20px;overflow:hidden;">
      <tr><td style="background:#1f5ea8;padding:22px 28px;">
        <span style="color:#ffffff;font-size:20px;font-weight:800;">✈ APP_NAME</span>
      </td></tr>
      <tr><td style="padding:28px;">
        <h1 style="margin:0 0 12px;color:#15304b;font-size:22px;">Reset your password</h1>
        <p style="margin:0 0 20px;color:#46627d;font-size:15px;line-height:22px;">
          Tap the button below to choose a new password.
        </p>
        <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#1f5ea8;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:999px;">
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
