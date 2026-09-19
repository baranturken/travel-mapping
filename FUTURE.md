# Travel Mapping — Future Development

Running list of planned features and improvements. Newest ideas at the top of each
section. This is a backlog, not a commitment of order.

## Big features

### Collaborative trip planning
- Let users plan trips **together with friends** on the app.
- Shared/editable itineraries: invite collaborators to a trip, co-edit stops,
  legs, dates, and notes.
- ✅ **DB groundwork shipped:** `trip_collaborators` table + RLS (owner
  invites/manages, editors may update the trip, members can leave) is live and
  mirrored in `schema.sql`. Remaining: invite UI, co-edit screens, realtime
  sync (Supabase Realtime), conflict handling.

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
- ✅ **Password policy:** min 8 chars, letter + number, common-password
  blocklist, live strength meter on sign-up and reset
  (`features/auth/password-policy.ts`). Pair with the server-side
  leaked-password toggle below.
- ✅ **Forgot / reset password:** in-app flow with recovery deep link
  (`(auth)/forgot-password` + `reset-password`). Requires the redirect URL to
  be allow-listed in Supabase → Auth → URL Configuration.
- ✅ **Two-factor authentication (TOTP):** enroll/disable in Profile →
  Security; sign-in is gated by an `mfa-challenge` screen when a verified
  factor exists. Follow-up: enforce AAL2 in RLS policies so the API (not just
  the app) requires the second factor.
- ✅ **In-app account deletion (Apple requirement):** Profile → Edit → danger
  zone; `delete-account` edge function removes storage + auth user, DB rows
  cascade.
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
- **Restrict the Geoapify key:** `EXPO_PUBLIC_GEOAPIFY_KEY` is necessarily shipped
  in the client (static-map URLs). Before launch, lock it down in the Geoapify
  dashboard with allowed-referrer/domain restrictions and a usage cap so a leaked
  key can't be abused for billing.

## Media & story polish

- ✅ **Route lines on the story map:** the Geoapify basemap now draws the
  polyline between stops (not just markers).
- ✅ **Geoapify basemap on every template:** all six story templates now paint
  the real cropped basemap into their route card (falling back to the drawn
  polyline if the map can't load), not just Classic/navy.
- ✅ **Custom banner cropper:** real 3:1 pan/pinch crop sheet
  (`features/social/components/banner-crop-modal.tsx`) replacing the iOS
  square-crop limitation.
- ✅ **Per-template photo rules:** `TEMPLATE_PHOTO_LIMITS` is the single source
  of truth — Sunset requires exactly 3, others take up to 4; the picker gates on
  it. Journey now shows every selected photo (background + thumbnail strip),
  not just the first.
- Manual photo crop refinements, more story templates, shape clips, route-only
  card (see earlier photo-story roadmap notes).

## UX polish

- ✅ **Skeleton loading screens:** layout-mirroring skeletons
  (`app/components/skeleton.tsx`) replace full-screen spinners on feed,
  trips, search, profiles, and trip detail screens.

## Store / launch readiness

- ✅ `eas.json` + EAS Build config for production builds.
- ✅ Privacy policy + terms of service **drafts** in `docs/legal/` — still
  need lawyer review and public hosting, then link from store listings.
- App Store / Play Store metadata: description, screenshots.
- A development build (not Expo Go) for Apple/Google social login and Turnstile
  WebView testing.
- Decide on the final app name and secure domain + handles. Leading candidate
  **Sharevel**: stores are clear (checked Jul 2026); `sharevel.com` is
  registered but dormant; do the formal USPTO/EUIPO check.
