# Design — 0000009-ship-phase-enum

## Feature
- Problem: `phase: "ship"` rejected by MCP schema; 7 agent activity categories lack dedicated event types
- Adoption mode: retrofit
- Feature ID: 0000009-ship-phase-enum

## Product Layer
- User stories confirmed: 9
- Acceptance criteria confirmed: 10
- Constraints: additive only — no existing enums, $defs, or required arrays modified
- Integrations: planifest-ship-agent (framework repo, consumes this server)

## Architecture Layer
- Latency target: unchanged (inherit existing p95 < 50 ms target)
- Availability target: unchanged
- Scalability target: unchanged
- Security: no change — schema validation only
- Data privacy: no regulated data
- Observability: standard defaults (existing logging unchanged)
- Cost boundary: not constrained

## Engineering Layer
- Stack: TypeScript / Node.js 22 / DuckDB / esbuild / Vitest / GitHub Actions
- Components: structured-telemetry-mcp (single component — schema + types only)
- Data ownership: structured-telemetry-mcp owns telemetry.db
- Deployment: Windows service via NSSM; global npm package; build.ps1 → deploy.ps1
- API versioning: not applicable (schema_version remains "1.0" — additive change)

## Scope
- In: `"ship"` phase enum (REQ-021); 7 new event types — `context_reset`, `approval_requested`, `fast_path_engaged`, `test_failure`, `performance_regression`, `dependency_blocked`, `schema_migration_applied` (REQ-022–028); unit tests for all
- Out: query layer changes, CI guard (lives in framework repo)
- Deferred: nothing

## Assumptions
- `"change"` is already in the phase enum — confirmed in schema read. Impact if wrong: none (it is there).
- Ship-agent uses existing `phase_start` / `phase_end` event types only — confirmed in SKILL.md. Impact if wrong: additional event types would need separate requirements.

## Risks
- R-001: Deploy order violation — ship-agent telemetry silently lost (ADR-005 exit-0). Likelihood: low. Impact: low (telemetry gap only, not operational failure).

## Dependencies
- Upstream: none
- Downstream: planifest-ship-agent (framework repo) — must not merge before this is deployed

## Confirmation
Human confirmed this design before proceeding: yes
Date confirmed: 2026-04-18
