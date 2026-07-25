# Design - 0000008-structured-telemetry-mcp-server

## Feature
- Problem: Planifest pipeline runs produce no structured telemetry — there is no way to measure performance improvements or identify where agents fail, loop, or waste tokens.
- Adoption mode: greenfield
- Feature ID: 0000008-structured-telemetry-mcp-server

## Product Layer

### User Stories

**S1 — Bottleneck visibility**
As the human on the loop, I want to understand bottlenecks at all stages of the SDLC.
- AC: `query_telemetry({ group_by: "phase", metrics: ["avg_duration_ms", "p95_duration_ms"] })` returns a Markdown table + JSON payload + sample of 5 raw events, ranked by duration, filterable by pipeline run / agent skill / tool call / phase / content format.

**S2 — Failure and loop detection**
As the human on the loop, I want to see where the process fails and where agents get stuck in a failing loop.
- AC: `query_telemetry({ event: "validation_failure", group_by: "session_id,phase", metrics: ["retry_instance_count", "pass_rate_within_5_retries", "fail_rate_within_5_retries"] })` returns the count of retry instances (each action requiring a retry = 1 instance regardless of attempt count) and pass/fail % within 5 retries. Raw events are stored; loop detection is query-side only (threshold: 5+ consecutive identical failures within a single phase).

**S3 — Token and request efficiency**
As the human on the loop, I want to see where tokens and requests are used and optimise for efficiency.
- AC: `query_telemetry({ event: "context_pressure", group_by: "phase", metrics: ["avg_peak_fill_pct"] })` and `query_telemetry({ group_by: "agent", metrics: ["total_tool_calls", "avg_calls_per_phase"] })` return per-operation token consumption with event detail sufficient to understand why (what was in context, what triggered the call), enabling trend tracking across successive runs.

- Constraints: Google TypeScript Style Guide enforced throughout
- Integrations: context-mode-mcp (source of `context_pressure` events via PostToolUse hook)

## Architecture Layer
- Latency target: `emit_event` p95 < 5ms; actual avg latency measured and reported in performance test output
- Availability target: local process — no Service Level Objective (SLO) applicable
- Scalability target: DuckDB store handles millions of records without query degradation
- Security: no auth (local stdio process, no network exposure); no authz model required; data classification: internal dev metadata (file paths, agent names, phase names) — not PII, not regulated
- Data privacy: no regulated data; event payloads may contain file paths and agent identifiers; no retention policy required
- Observability: server reports startup/shutdown to stdout; DuckDB file is the persistent store; performance test reports avg emit_event latency
- Cost boundary: not constrained (local tool, no cloud costs)

## Engineering Layer
- Stack: no frontend / TypeScript + Node.js 18+ / DuckDB / no ORM (raw DuckDB SQL) / no IaC / local / npm / GitHub Actions
- Build toolchain: `tsc` + `esbuild` → `server.bundle.mjs` (modelled on context-mode-mcp)
- Testing: Vitest
- Components:
  - `src/server.ts` — MCP server entrypoint; registers `emit_event` and `query_telemetry` tools; stdio transport
  - `src/db/` — DuckDB storage layer; schema initialisation; temporal optimisation; raw SQL queries
  - `src/validation/` — runtime JSON Schema validation for event envelope and all payload types
  - `src/cli.ts` — setup/doctor CLI (modelled on context-mode-mcp)
  - `schemas/telemetry-event.schema.json` — canonical event schema (common envelope + typed payloads)
  - `scripts/` — build, deploy, setup (.sh + .ps1), postinstall, version-sync scripts
- Data ownership: `structured-telemetry-mcp` owns all telemetry events (single DuckDB file, path configurable via env/setup)
- Deployment: npm package, stdio transport, local dev tool; npm publish scaffolded but not shipped this run
- API versioning: event schema versioned via `schema_version` field in common envelope

### Event Types
`phase_start`, `phase_end`, `spec_gap`, `validation_failure`, `deviation`, `migration_proposal`, `context_pressure`, `mcp_impact`, `self_correction`

### Common Envelope
```json
{
  "schema_version": "1.0",
  "event": "<event_type>",
  "session_id": "<uuid>",
  "initiative_id": "<plan/current id>",
  "phase": "<orchestrator|spec|adr|codegen|validate|security|docs|change>",
  "agent": "<skill name>",
  "tool": "<claude-code|cursor|...>",
  "model": "<model identifier>",
  "mcp_mode": "none|workspace|context|workspace+context",
  "timestamp": "<ISO 8601>",
  "data": {}
}
```

## Scope
- In:
  - MCP server with `emit_event` and `query_telemetry` tools
  - DuckDB storage layer with temporal optimisation
  - JSON Schema validation for all event types at ingestion
  - All event types listed above
  - Query: filter by session / agent / phase / timestamp; aggregation (avg_duration, p95_duration, success_rate, token_efficiency, retry_instance_count, pass/fail rate within 5 retries); output as Markdown table + JSON + 5-event raw sample
  - Build, bundle, setup (.sh + .ps1), doctor, postinstall scripts (modelled on context-mode-mcp)
  - GitHub Actions CI: typecheck, test, build
  - Vitest test suite including performance test reporting avg emit_event latency
- Out:
  - 0008b framework integration (separate pipeline run, depends on this server existing)
  - npm publish (scaffolded, not shipped)
  - Remote / hosted deployment
  - Web dashboard (0024 — future)
  - Auto-discovery of a running server instance
  - Loop detection as a derived server-side event
- Deferred:
  - npm publish — blocked on: decision to make package public
  - Hosting / containerisation — blocked on: user demand signal

## Assumptions
- DuckDB installs as a Node.js native dependency on Windows, Mac, and Linux without platform-specific issues — impact if wrong: storage layer must be replaced
- stdio transport is sufficient for local dev use — impact if wrong: HTTP/SSE transport must be added
- Event payloads do not contain credentials or secrets — impact if wrong: encryption at rest required

## Risks
- DuckDB native module compilation fails on some platforms (likelihood: medium, impact: high — blocks all storage; mitigation: test CI matrix against Windows/Mac/Linux)
- Large event volume causes file lock contention on Windows (likelihood: low, impact: medium — mitigation: single-writer architecture, WAL mode)
- Schema evolution breaks existing stored events (likelihood: medium, impact: medium — mitigation: `schema_version` field in envelope; migration scripts in `src/db/`)

## Dependencies
- Upstream: `@modelcontextprotocol/sdk`, `duckdb` (or `@duckdb/node-api`), `zod`, context-mode-mcp (reference implementation)
- Downstream: 0008b (planifest-framework integration), 0024 (observability store dashboard)

## Confirmation
Human confirmed this design before proceeding: yes
Date confirmed: 2026-04-13
