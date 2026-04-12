# Copilot Instructions for Travel Mapping

## Project intent

Travel Mapping is a mobile-first travel planning app. The app must help a user enter a trip, understand it quickly on a map, and keep the experience visually calm, clean, and easy to use on a phone.

## Build order

Follow this order unless explicitly overridden:

1. Maintain the agent orchestration system and shared rules.
2. Maintain and extend the custom MCP server.
3. Build or change the mobile app.

## Product rules

- Treat mobile as the primary platform.
- Keep the UI bright, airy, and Mediterranean in tone.
- Prefer white backgrounds and blue accents.
- Optimize v1 for single-user trip creation.
- Keep trip data local-first in v1.
- Support real email/password accounts from day one.
- Do not introduce paid services or paid-only dependencies.
- Keep provider-specific code isolated so a custom backend can replace Supabase later.

## MVP rules

- Use a simple form-first trip builder in v1.
- Render route legs as straight lines in v1.
- Show transport icons per leg.
- Support plane, bus, ferry, train, and car, plus a custom transport option.
- Track route-aware geometry, map-first editing, and travel memories as future work, not hidden TODOs.

## Engineering rules

- Keep code and docs aligned.
- Prefer TypeScript-first solutions.
- Use small abstractions around auth, storage, map rendering, and geocoding so future migrations stay practical.
- Treat the MCP server as the source of project context for future automation.
- When adding dependencies, prefer free, stable, widely used libraries.

## Required references before major work

- `docs/product/non-negotiables.md`
- `docs/architecture/stack-decisions.md`
- `docs/architecture/agent-orchestration.md`
- `docs/architecture/mcp-server.md`
- `docs/ai/shared-rules.md`
- `.github/agents/*.agent.md`
