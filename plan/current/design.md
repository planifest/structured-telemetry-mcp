# Design - 0000008c-mcp-fixes-and-enhancements

## Feature
- Problem: Deployed 0008a server has 3 data-loss bugs, 5 missing event types, and 3 missing query capabilities discovered during 0008b integration
- Adoption mode: retrofit
- Feature ID: `0000008c-mcp-fixes-and-enhancements`

## Product Layer
- User stories confirmed: 4 (schema additions, bug fixes, query enhancements, post-deployment truncation)
- Acceptance criteria confirmed: 9
- Constraints: additive schema changes only; truncation requires `--confirm` flag; no structural DB migration
- Integrations: framework skills → structured-telemetry-mcp via HTTP/SSE MCP protocol

## Architecture Layer
- Latency target: `emit_event` p95 < 100ms (CI threshold; Windows GH-hosted runners measure ~28ms p95 in practice — 100ms chosen to tolerate slow CI disk while catching regressions)
- Availability target: local daemon — no SLO
- Scalability target: inherit from 0008a — DuckDB handles millions of records without query degradation
- Security: no auth (localhost-only HTTP/SSE daemon, bound to 127.0.0.1); no authz model; data classification: internal dev metadata — not PII, not regulated
- Data privacy: no regulated data; no retention policy required
- Observability: existing stdout logging; existing performance test suite
- Cost boundary: not constrained (local tool)

## Engineering Layer
- Stack: TypeScript / Node.js / Express / DuckDB (raw SQL) / Vitest / GitHub Actions
- Components:
  - `structured-telemetry-mcp` (existing) — MCP server; schema validation; query service; CLI
- Data ownership: `structured-telemetry-mcp` owns `telemetry.db` exclusively
- Deployment: local Windows Service via `deploy.ps1`; version bump to `0.2.0`; no new npm packages — existing dependency set only; all dependency versions must be verified as latest stable via live registry before ship
- API versioning: event schema versioned via `schema_version` field in common envelope

## Scope

### In
- SCH-001–005: Add `phase_skip`, `security_finding`, `retry_limit_exceeded`, `adr_decision`, `doc_gap` to `schemas/telemetry-event.schema.json`
- BUG-001: Add `mcp_mode` to `BottleneckGroupBy` and `resolveGroupColumn()` in `src/query/bottlenecks.ts`
- BUG-002: Validate `session_id` for `failure_sequence` in `src/query/failures.ts`; throw on missing
- BUG-003: Validate `session_id` for `drill_down` in `src/query/token-efficiency.ts`; throw on missing
- FEA-001: Add `mode: "event_log"` to query service (session or initiative scoped, full payload, ordered by timestamp)
- FEA-002: Add `group_by: "initiative_id"` to `BottleneckGroupBy` and `resolveGroupColumn()`
- FEA-003: Add `initiative_id` optional filter to all three query families (`bottlenecks.ts`, `failures.ts`, `token-efficiency.ts`)
- POST-001: Add `scripts/DELETE-ALL-PRODUCTION-RECORDS.ps1` (Windows) and `scripts/DELETE-ALL-PRODUCTION-RECORDS.sh` (Unix) — human-only deployment scripts, NOT exposed via npx or the MCP CLI

### Out
- 0008b framework doc changes (separate repo, tracked separately)
- Auth / access control changes
- npm publish to registry

### Deferred
- Nothing deferred.

## Assumptions
- `initiative_id` and `mcp_mode` are already first-class columns in the `events` table — impact if wrong: FEA-002, FEA-003, BUG-001 require a DB migration first
- All schema additions are additive — impact if wrong: migration file required before deployment
- No production users exist — truncation is safe — impact if wrong: data loss (mitigated by admin/sudo requirement, interactive phrase confirmation, and human-only script placement)
- `event_log` mode fits within the existing query service dispatch pattern — impact if wrong: new query family file required

## Risks
- `resolveGroupColumn()` is an exhaustive switch — adding cases is safe but the exhaustive check must be updated in TypeScript; likelihood: low; impact: compile error (caught by CI)
- `initiative_id` filter added to three query families simultaneously — risk of inconsistent implementation; likelihood: medium; impact: incorrect query scoping (caught by tests)
- Truncation script misuse; likelihood: very low; impact: data loss; mitigated by three layers: (1) requires admin/sudo — agents rarely have elevated privileges; exits with a clear message if not elevated, (2) prints "ERROR! YOU MUST CONSULT THE HUMAN ON THE LOOP! YOU SHOULD NOT HAVE RUN THIS" and asks for consent, (3) requires interactive entry of exact phrase "I UNDERSTAND THAT THIS WILL DELETE ALL RECORDS!" before proceeding

## Dependencies
- Upstream: framework skills (0008b) — need new event types before they can emit them
- Downstream: none

## Confirmation
Human confirmed this design before proceeding: yes
Date confirmed: 2026-04-14
