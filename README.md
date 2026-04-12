# Travel Mapping

Travel Mapping is a mobile-first trip planning app that turns an itinerary into a visual journey on a map. Users create a trip, add stops and transport methods, and then see the route as a clean map experience with city markers, leg lines, and transport icons.

## Current focus

The repository is being built in this order:

1. Agent orchestration system
2. Custom MCP server
3. Mobile app implementation

## Product summary

- **Primary goal:** make multi-stop travel plans easy to understand at a glance on mobile.
- **MVP:** form-first trip creation, straight-line route rendering, transport icons, and single-user travel planning.
- **Future direction:** map-first trip editing, route-aware land and sea paths, photo memories, accommodation pins, and richer travel storytelling.

## Technical direction

- **App:** React Native with Expo and TypeScript
- **Backend:** Supabase first, custom backend later if needed
- **Storage:** local-first trip data, authenticated accounts from day one
- **Maps:** free/open-source-first approach
- **Design:** clean Mediterranean look with white and blue tones

## Repository guide

- `app/` - Expo mobile app workspace
- `mcp-server/` - project-specific MCP server
- `docs/product/` - vision, scope, goals, and roadmap
- `docs/ux/` - flows, visual system, and screen definitions
- `docs/architecture/` - stack, data, integrations, MCP, and orchestration
- `docs/ai/` - agent rules, skills, and role definitions
- `.github/copilot-instructions.md` - project-wide Copilot guidance

## Start here

1. Read `docs/product/vision.md`
2. Read `docs/product/non-negotiables.md`
3. Read `docs/architecture/stack-decisions.md`
4. Read `docs/architecture/agent-orchestration.md`
5. Read `docs/architecture/mcp-server.md`
