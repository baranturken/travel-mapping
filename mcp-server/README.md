# Travel Mapping MCP Server

This workspace provides a project-specific MCP server for Travel Mapping.

## Current tools

- `project_overview`
- `list_docs`
- `read_doc`
- `search_docs`
- `list_agents`
- `read_agent`
- `transport_defaults`
- `build_order`
- `android_tooling`
- `adb_devices`
- `start_emulator`
- `capture_emulator_screenshot`

## Purpose

The server gives agents structured access to:

- product and architecture docs
- agent specifications
- transport defaults
- Android emulator status and helpers

## Development

```bash
npm install
npm run build:mcp
npm run dev:mcp
```

## Android tooling note

The Android-related MCP tools work when `adb`, `emulator`, and related SDK commands are available on PATH. The server handles missing tools gracefully and reports availability back to the caller.
