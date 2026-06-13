# Travel Mapping — Launch & Deployment Checklist

Everything between "development is done" and "it's live on the stores with ads."
Roughly in order. None of this is code we've written yet — it's accounts,
config, content, and review.

## 0. Name & trademark (do this first — it gates everything)
- The exact name **"Travelly" is already taken** on Google Play (an eSIM app,
  `com.global1sim.travelly.android`). Apple/Google can reject a duplicate or
  confusingly-similar app name, and there's trademark risk.
- Check before committing to a name:
  - App Store + Play Store search for the exact name.
  - Trademark: USPTO TESS (US), EUIPO (EU), your local registry.
  - Domain (`.com`) + social handles (Instagram/TikTok/X).
- Pick a distinctive name, then reserve the domain + handles.

## 1. Developer accounts
- **Apple Developer Program** — $99/year (required to ship on iOS / TestFlight).
- **Google Play Developer** — $25 one-time.
- A Google account for **AdMob** (ads) and, later, analytics.

## 2. Build pipeline (EAS)
- Add **`eas.json`** and configure **EAS Build** (`npx eas build`).
- Bundle IDs are already set: iOS `com.baranturken.travelmapping`,
  Android `com.baranturken.travelmapping`.
- Final **app icon** + **splash screen** + adaptive icon.
- A **production / development build** (NOT Expo Go) — required for AdMob,
  Apple/Google sign-in, and the Turnstile WebView.
- Bump `version` + build numbers per release.

## 3. Backend hardening (Supabase)
- Move off the free tier for production (paid plan = backups, no pausing, higher
  limits).
- **Custom SMTP** (e.g. Resend) + verified sending domain for branded,
  deliverable auth emails. Customize the email templates.
- **Auth URL config**: set Site URL + Redirect URLs to the production deep link
  (fixes the localhost confirmation link).
- **Attack Protection / CAPTCHA** (Cloudflare Turnstile) — needs the in-app
  WebView widget first (see FUTURE.md).
- Audit **RLS** on every table; confirm storage bucket policies.
- **OSRM**: we use the public demo server (no SLA, rate-limited). Self-host or
  use a paid routing provider before real traffic.
- Geoapify: confirm the free tier covers expected map requests; add billing if
  needed.

## 4. Legal / privacy (required by both stores)
- **Privacy policy** + **terms of service** hosted at a public URL. We collect
  email, photos, and location → this is mandatory.
- Apple **App Privacy "nutrition label"** (App Store Connect).
- Google Play **Data safety** form.
- Account **deletion** path (Apple requires in-app account deletion).
- If ads: disclose ad tracking; iOS **App Tracking Transparency** prompt.

## 5. Store listings & assets
- App name, subtitle, description, keywords.
- **Screenshots** per device size (iPhone, iPad, Android phone/tablet) + optional
  preview video.
- **Content rating** (Play questionnaire / Apple age rating).
- Category, support URL, marketing URL.

## 6. Testing before submit
- **TestFlight** (iOS) and Play **internal testing** track.
- Test on real devices: auth, publish, story render, photo upload, deep links.

## 7. Ads (AdMob)
- `react-native-google-mobile-ads` (needs a dev build, not Expo Go).
- Create AdMob ad units (banner / interstitial / rewarded).
- Consent: Google **UMP** consent form (GDPR) + iOS ATT.
- Keep ad density reasonable to avoid review rejection.

## 8. Monitoring & analytics (recommended)
- **Sentry** for crash/error reporting.
- Product analytics (PostHog / Firebase) for funnels & retention.

## 9. Submit & review
- Apple review: ~1–3 days, stricter; have a demo account ready for reviewers.
- Google review: usually faster; new developer accounts may get extra scrutiny.
- Respond to rejections, resubmit.

## 10. Post-launch
- Monitor crashes, reviews, ad revenue.
- Set up an update cadence (EAS Update for JS-only fixes, store builds for native).
