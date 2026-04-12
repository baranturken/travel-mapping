# Agent Orchestration

## Purpose

The orchestration layer defines how specialized agents work together so project decisions stay consistent and automation remains useful over time.

## Registration path

The human-readable design docs live in `docs/ai/agents/`, but the actual repository-level custom agents that should appear in Copilot's `/agent` picker live in `.github/agents/*.agent.md`.

## Agent roster

- Orchestrator
- Planner
- Coder
- Analyzer
- Designer
- QA
- Dependency Doctor
- Release Reviewer

## Workflow

1. **Orchestrator** receives the goal and checks constraints.
2. **Planner** turns the goal into scoped work and identifies dependencies.
3. **Designer** shapes UX when screens or flows are involved.
4. **Dependency Doctor** validates libraries, native modules, and build risk before major stack changes.
5. **Coder** implements the approved slice.
6. **QA** verifies user-flow correctness.
7. **Analyzer** reviews the result for bugs, regressions, and architecture drift.
8. **Release Reviewer** checks packaging, privacy, and store-readiness before release milestones.

## Handoff contract

Every agent handoff should include:

- current goal
- relevant files
- constraints
- definition of done
- open risks

## Hard rules

- Agents must follow the project docs, not improvise product scope.
- Agents must preserve the free-first tool constraint.
- Agents must keep Supabase replaceable.
- Agents must not skip the MCP layer when project context or automation tools are needed.
