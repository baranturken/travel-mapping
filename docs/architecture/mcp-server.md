# MCP Server

## Purpose

The project-specific MCP server gives agents structured access to project context and development automation so they do not need to rediscover project rules on every task.

## Phase 1 responsibilities

- read project documentation
- list and fetch agent specifications
- expose architecture and product references
- expose transport type metadata
- expose reusable workflow guidance for the app

## Phase 2 responsibilities

- Android emulator discovery
- emulator boot helpers
- app install and launch helpers
- screenshot capture
- build and test wrappers

## Phase 3 responsibilities

- geocoding helpers
- route normalization helpers
- map asset lookup
- task and backlog retrieval

## Guardrails

- Prefer local project context over ad hoc reasoning.
- Avoid hidden mutable state.
- Keep tools explicit, typed, and small.
- Keep the MCP server safe to run locally.
- Emulator tools assume Android SDK commands such as `adb` and `emulator` are installed and available on PATH.
