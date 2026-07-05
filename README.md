# Travel Mapping

A mobile travel journal and social app. Plan multi-stop trips on a map, attach
photo memories to each stop, publish trips to a social feed, and export a trip as
a shareable "photo collage" story for Instagram/TikTok.

Built with **Expo (React Native)** and **Supabase**. Trips are authored fully
offline in on-device SQLite and only sync to the cloud when the user chooses to
publish. Targeting the App Store and Google Play.

> **Status:** pre-launch. Core planning, social, and story-export features work.
> Remaining work is store/account setup and hardening — see
> [`DEPLOYMENT.md`](DEPLOYMENT.md) and [`FUTURE.md`](FUTURE.md).

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project layout](#project-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Backend setup (Supabase)](#backend-setup-supabase)
- [Scripts](#scripts)
- [Testing](#testing)
- [Photo story / collage renderer](#photo-story--collage-renderer)
- [Roadmap & deployment](#roadmap--deployment)

---

## Features

**Trip planning**
- Create multi-stop trips with cities searched from a bundled world-cities
  dataset (offline, no geocoding API needed).
- Ordered stops with accommodation, notes, places to visit, and per-stop dates.
- Legs between stops with transport type (car, ferry, bus, plane, …).
- Real driving routes drawn on the map via OSRM; ferry legs get sea-route
  handling and a review step for landlocked/impossible segments.
- Interactive Leaflet map rendered in a WebView, with route polylines between
  stops.
- Computed trip stats: countries, cities, days, total distance.

**Photo memories**
- Attach photos to stops from the device library (`expo-image-picker`).
- Reads embedded photo GPS/EXIF location metadata when available to place
  memories on the map.

**Social**
- Email/password and Apple sign-in (`expo-apple-authentication`).
- Publish a private trip to a public feed; follow other users; like and comment
  on published trips.
- User profiles with avatar and 3:1 banner (custom pan/pinch crop sheet).
- Feed, search, and shared-trip deep links.

**Photo story export**
- Render a trip into a 1080×1920 shareable image ("photo collage") with one of
  six templates, drawn on an HTML canvas inside an off-screen WebView.
- Each template embeds a real Geoapify static basemap of the visited cities
  (with the route polyline), falling back to a drawn route if the map can't load.
- Share via the native share sheet (`expo-sharing`).

**Security / accounts**
- Client-side failed-login lockout (5 attempts → 15-minute lock).
- Supabase Row-Level Security on every table; storage writes scoped to each
  user's own folder.
- Branded auth email templates ready to apply.

---

## Tech stack

| Layer | Choice |
|---|---|
| App framework | Expo `~54`, React Native `0.81`, React `19` |
| Navigation | Expo Router `v6` (typed routes, file-based) |
| Language | TypeScript `~5.9` |
| Local data | `expo-sqlite` (offline-first trip storage) |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| Maps (in-app) | Leaflet in a WebView |
| Maps (story) | Geoapify Static Maps API |
| Routing | OSRM (public demo server) |
| Forms/validation | `react-hook-form` + `zod` |
| Story render | HTML5 Canvas in `react-native-webview` |
| Testing | Jest `29` + `babel-preset-expo` |

New React Native architecture and the React Compiler are enabled
(`app/app.json` → `newArchEnabled`, `experiments.reactCompiler`).

---

## Architecture

- **Offline-first authoring.** Trips, stops, legs, and memories live in on-device
  SQLite (`app/lib/db`, `app/features/trips/sqlite-trip-repository.ts`). Nothing
  hits the network until the user publishes.
- **Publish to sync.** Publishing writes the trip into Supabase
  (`published_trips`) and uploads photos to the `trip-photos` storage bucket. The
  social graph (`follows`, `trip_likes`, `trip_comments`) lives entirely in
  Supabase.
- **Feature-sliced code.** Domain logic is grouped by feature (`auth`,
  `locations`, `social`, `trips`) rather than by technical layer. Pure logic
  (mappers, schemas, stats, route helpers, the story renderer) is separated from
  React components so it can be unit-tested in a Node environment.
- **Canvas-in-WebView rendering.** The story renderer builds a self-contained
  HTML document with an inline canvas script, injects it into a hidden WebView,
  and receives the exported `data:image/jpeg` back over `postMessage`. A watchdog
  salvages a partial render if a heavy template stalls.

---

## Project layout

```
travel-mapping/
├─ app/                       # the Expo application
│  ├─ app/                    # Expo Router routes (file-based navigation)
│  │  ├─ (auth)/              # sign-in, sign-up, profile setup
│  │  ├─ (tabs)/              # feed, search, trips, profile
│  │  ├─ trips/              # trip detail, create, edit, story, shared
│  │  ├─ users/[userId].tsx  # public user profile
│  │  └─ profile/edit.tsx
│  ├─ features/
│  │  ├─ auth/                # auth context, login throttle
│  │  ├─ locations/           # bundled world-cities dataset + search
│  │  ├─ social/              # feed, follows, likes, comments, photo upload
│  │  └─ trips/               # repository, schemas, stats, routing, story
│  │     ├─ routing/          # OSRM fetch, ferry review, route cache
│  │     ├─ map/              # Leaflet HTML builder
│  │     ├─ components/       # trip form, editors, map webview, story card
│  │     └─ photo-story-renderer.ts
│  ├─ lib/
│  │  ├─ db/                  # SQLite + migrations
│  │  └─ supabase.ts          # Supabase client
│  └─ __mocks__/              # Jest mocks (e.g. expo/virtual/env)
├─ supabase/
│  ├─ schema.sql              # tables, indexes, RLS, storage bucket
│  └─ email-templates.md      # branded auth email HTML
├─ DEPLOYMENT.md              # launch checklist (accounts, EAS, stores)
└─ FUTURE.md                  # backlog / roadmap
```

---

## Getting started

**Prerequisites:** Node.js 18+, the Expo tooling (`npx expo`), and either the
Expo Go app or a device/emulator. A Supabase project is required for auth and
publishing.

```bash
# 1. Install dependencies
cd app
npm install

# 2. Configure environment (see below)
cp .env.example .env.local
#   then fill in your Supabase + Geoapify values

# 3. Run the app
npm start          # Expo dev server (choose a target)
npm run android    # or launch straight to Android
npm run ios        # or iOS
```

> **Note:** some features (Apple sign-in, the Geoapify basemap, and future
> ad/CAPTCHA integrations) require a **development build** rather than Expo Go.

---

## Environment variables

Create `app/.env.local` (git-ignored). All client env vars must be prefixed
`EXPO_PUBLIC_` to be inlined by Expo.

| Variable | Required | Purpose |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase anon/publishable key |
| `EXPO_PUBLIC_GEOAPIFY_KEY` | for story basemaps | Geoapify Static Maps key |

> `.env.example` currently lists only the two Supabase vars. Add
> `EXPO_PUBLIC_GEOAPIFY_KEY` to get real basemaps in the photo-story templates.
>
> **Security:** the Geoapify key ships in the client (static-map URLs). Before
> launch, restrict it by allowed referrer/domain and set a usage cap in the
> Geoapify dashboard — see `FUTURE.md`.

---

## Backend setup (Supabase)

1. Create a Supabase project.
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL Editor. It
   creates the tables (`profiles`, `published_trips`, `follows`, `trip_likes`,
   `trip_comments`), indexes, an `updated_at` trigger, Row-Level Security
   policies, grants, and the public **`trip-photos`** storage bucket (writes
   scoped to each user's `{userId}/…` folder).
3. Copy the project URL and anon key into `.env.local`.
4. (Optional) Apply the branded auth email templates from
   [`supabase/email-templates.md`](supabase/email-templates.md).
5. For production: set Auth Site URL / Redirect URLs to your deep link, enable
   leaked-password and attack protection, and audit RLS — see `DEPLOYMENT.md`.

---

## Scripts

Run from `app/`:

| Script | Action |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run android` / `ios` / `web` | Launch on a target platform |
| `npm run lint` | ESLint over `app`, `features`, `lib`, `constants` |
| `npm test` | Run the Jest suite |
| `npx tsc --noEmit` | Type-check |

---

## Testing

Unit tests live next to the code in `__tests__/` folders and run in Node via
`babel-preset-expo`. Coverage focuses on the pure logic that would silently
break the app: schema validation, trip mappers, distance/stat computation, route
and ferry review helpers, DB migrations, the Geoapify URL builder, and the photo
story renderer.

The story-renderer suite goes beyond a syntax check: it **executes** each
template's generated canvas script against a mocked 2D context and stubbed
`Image`, at multiple photo counts and with/without a basemap, asserting each
template posts back a valid `data:image` — so a regression in the draw logic
fails CI rather than the device.

```bash
cd app
npm test
```

---

## Photo story / collage renderer

`app/features/trips/photo-story-renderer.ts` builds a 1080×1920 story image on an
HTML canvas. Six templates are available, each with its own photo rules
(`TEMPLATE_PHOTO_LIMITS` is the single source of truth for the renderer and the
picker):

| Template | Photos (min–max) |
|---|---|
| `navy` (Classic) | 0–4 |
| `journey` | 1–4 |
| `filmstrip` | 0–4 |
| `minimal` | 1–4 |
| `sunset` | exactly 3 |
| `passport` (Boarding pass) | 0–4 |

Every template paints a real Geoapify basemap of the visited cities (with the
route polyline), loaded with `crossOrigin="anonymous"` so the canvas stays
exportable, and falls back to a drawn route if the map fails. Rendering happens
in a hidden off-screen WebView; the result returns as a JPEG data URL and is
shared through the native share sheet. A 10s watchdog salvages whatever has been
drawn if a heavy template stalls, and render failures surface as an on-screen
banner (device logs aren't always accessible).

---

## Roadmap & deployment

- **[`FUTURE.md`](FUTURE.md)** — backlog: collaborative trip planning, ticket/
  hotel aggregation, CAPTCHA (Turnstile), more story polish.
- **[`DEPLOYMENT.md`](DEPLOYMENT.md)** — the path from "done" to "live": name/
  trademark, developer accounts, EAS build config, backend hardening, privacy/
  legal, store listings, AdMob, and review.

Bundle identifiers are already set (`com.baranturken.travelmapping` for both iOS
and Android). A final app name is still to be chosen.
