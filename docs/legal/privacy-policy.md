# Privacy Policy — Sharevel

> **Draft.** Written for the working name "Sharevel" — find-and-replace if the
> final name changes. Review by a lawyer is recommended before publishing.
> Host this at a public URL (required by Apple and Google) and link it from
> both store listings and the app.

_Last updated: July 5, 2026_

Sharevel ("the app", "we") is a travel journaling and social app operated by
Baran Türken. This policy explains what data the app handles, where it goes,
and your choices.

## What we collect

**Account data** — When you create an account we collect your email address
and a password (stored as a salted hash by our authentication provider,
Supabase). If you sign in with Apple or Google, we receive the identity token
they provide; we never see those passwords.

**Profile data** — Username, display name, bio, and any avatar or banner
image you choose to upload.

**Trip content** — Trips you author (titles, stops, dates, transport legs,
notes) are stored **locally on your device** and are not sent to our servers
unless you choose to **publish** a trip. Publishing uploads the trip content
and its selected photos so other users can see them.

**Photos** — Photos you attach stay on your device unless you publish the
trip or share a story image. When you grant photo-library access, the app may
read a photo's embedded location (EXIF GPS) solely to place your memories on
the map; you can deny this permission and the app still works.

**Location** — We do not track your live device location. Location data in
the app comes from the cities you type in and, optionally, photo EXIF data as
described above.

**Usage/diagnostics** — The app itself does not currently include analytics
or advertising SDKs. If this changes (e.g. ads are introduced), this policy
and the store listings will be updated first.

## Where your data is processed

- **Supabase** (database, authentication, file storage) — hosts published
  trips, profiles, comments, likes, follows, and uploaded images.
- **Geoapify** (static map images) — when a story image is generated, the
  request includes only the coordinates of the cities on your route.
- **OSRM** (route calculation) — road-route requests include the coordinates
  of your trip stops.

These providers receive only what is needed to perform their function. We do
not sell your data.

## Who can see what

- Published trips, your profile, comments, and likes are visible to other
  users of the app.
- Unpublished trips never leave your device.
- Uploaded images are stored in a public storage bucket addressed by unique
  URLs; only your own account can add or remove files in your folder.

## Security

- Passwords must meet a strength policy and are checked against known-breach
  lists.
- Optional two-factor authentication (TOTP) is available in Security settings.
- Access to server data is enforced with row-level security: you can only
  modify your own content.

## Your rights and choices

- **Access/rectify** — edit your profile and published trips in the app.
- **Delete** — "Delete account" in Profile → Edit removes your profile,
  published trips, photos, comments, and likes from our servers immediately.
  Locally saved trips remain on your device until you delete the app.
- **Unpublish** — you can unpublish a trip at any time, which removes it from
  other users' view.

If you have questions or requests, contact: **baranturken@hotmail.com**

## Children

The app is not directed at children under 13 (or the applicable minimum age
in your country) and we do not knowingly collect their data.

## Changes

We will update this page and the "last updated" date when the policy changes.
Material changes will be announced in the app.
