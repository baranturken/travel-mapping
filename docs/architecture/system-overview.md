# System Overview

## Main parts

### Mobile app

Owns the user experience for auth, trip creation, trip storage, and map viewing.

### Supabase

Owns identity and the first backend-auth layer. Later it may also hold synchronized trip data, but the app should not assume that all trip logic belongs there forever.

### Local data layer

Owns local trip persistence, drafts, cached locations, and fast read access for the app.

### Custom MCP server

Owns project-aware tooling for agents and automation. It should expose docs, architecture context, emulator helpers, and project workflow utilities.

### Agent orchestration layer

Owns how specialized AI roles plan, build, review, and validate work.

## Design objective

Separate product code, project automation, and decision documentation cleanly so the project can evolve without losing context.
