# Travel Mapping — Future Development

Running list of planned features and improvements. Newest ideas at the top of each
section. This is a backlog, not a commitment of order.

## Big features

### Collaborative trip planning
- Let users plan trips **together with friends** on the app.
- Shared/editable itineraries: invite collaborators to a trip, co-edit stops,
  legs, dates, and notes.
- Likely needs: a trip-collaborators table (trip_id, user_id, role), realtime
  sync (Supabase Realtime), conflict handling, and an invite flow.

### Travel booking / ticket aggregation
- Show the most recent **plane, hotel, ferry, and bus tickets** for a planned
  route — Skyscanner / FerryScanner / FlixBus style.
- Per leg, surface live options and prices (plane tickets, hotel stays, ferry
  crossings, FlixBus bus tickets).
- Likely via partner/affiliate APIs (Skyscanner, FerryScanner/Direct Ferries,
  FlixBus, a hotel provider). Most require an approved API key / affiliate
  account. Start with one provider per category.

## Security & accounts

- ✅ **Failed-login lockout (basic):** 5 failed sign-ins → 15-min client-side
  lock (`app/features/auth/login-throttle.ts`). Still pair with server-side
  protection below.
- ✅ **Branded auth emails (templates):** ready to paste from
  `supabase/email-templates.md`. Custom from-address still needs SMTP + domain.
- **Bot/abuse protection (CAPTCHA):** Cloudflare Turnstile on sign-up and
  sign-in. Requires a Turnstile site in the Cloudflare dashboard (site key +
  secret), the secret added to Supabase Auth → Attack Protection, and a
  React-Native WebView Turnstile widget in the app to produce the token passed
  as `options.captchaToken`. (`@marsidev/react-turnstile` is web-only and does
  NOT work in Expo/React Native — needs a WebView wrapper.)
- **Failed-login lockout:** after ~5 failed password attempts, require the
  CAPTCHA challenge and/or temporarily lock the account. Supabase has built-in
  auth rate limits; explicit lockout needs client logic (attempt counter) plus
  the Turnstile gate above.
- **Leaked-password protection:** enable in Supabase Auth → Attack Protection
  (checks HaveIBeenPwned). One-click, no code.
- **Custom auth emails:** brand the confirmation / reset / magic-link emails with
  the app name and styling. Supabase Auth → Email Templates (edit subject + HTML).
  For production deliverability, configure a custom SMTP sender (e.g. Resend) and
  a verified sending domain.

## Media & story polish

- ✅ **Route lines on the story map:** the Geoapify basemap now draws the
  polyline between stops (not just markers).
- Roll the **Geoapify cropped basemap** route output into the other story
  templates (currently only the Classic/navy template; others still draw line
  routes).
- **Custom banner cropper:** a real wide-aspect crop UI (iOS `allowsEditing`
  forces a square crop that doesn't match the banner). For now the banner is
  picked uncropped and cover-fit on display.
- Manual photo crop refinements, more story templates, shape clips, route-only
  card (see earlier photo-story roadmap notes).

## Store / launch readiness

- `eas.json` + EAS Build config for production builds.
- App Store / Play Store metadata: description, screenshots, privacy policy.
- A development build (not Expo Go) for Apple/Google social login and Turnstile
  WebView testing.
- Decide on the final app name and secure domain + handles.
