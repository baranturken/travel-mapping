# Stack Decisions

## Chosen direction

- **Mobile app:** React Native with Expo
- **Language:** TypeScript
- **Navigation:** Expo Router
- **Forms and validation:** React Hook Form with Zod
- **State strategy:** local screen state first, shared state only where necessary
- **Local storage:** Expo SQLite for trip data and drafts
- **Secure credential storage:** Expo SecureStore
- **Backend:** Supabase
- **Auth:** Supabase email/password auth
- **Map rendering for MVP:** Leaflet inside React Native WebView, backed by OpenStreetMap tiles
- **MCP server:** Node.js + TypeScript + Model Context Protocol SDK

## Why this stack

### Expo

- Mobile-first
- Good development speed
- Strong Android emulator workflow
- Large community and solid free tooling

### Supabase

- Fastest practical path to auth
- SQL-backed model fits future backend evolution better than document-first services
- Easier migration path to a custom backend than a more provider-specific stack

### Expo SQLite

- Matches the local-first requirement
- Keeps core trip data available even when the network is weak
- Works well for drafts, cached geocoding results, and trip records

### Leaflet in WebView

- Keeps the MVP on free/open map tooling
- Avoids paid map dependencies
- Is sufficient for marker and straight-line rendering
- Can be replaced later if native map needs become stronger

## Decisions intentionally deferred

- Full sync model for trips
- Push notifications
- Collaboration model
- Route engine provider
- Photo storage and media pipeline
