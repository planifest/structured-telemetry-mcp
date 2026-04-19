---
title: "Scope: 0000008-structured-telemetry-mcp-server"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
---

# Scope - 0000008-structured-telemetry-mcp-server

## In Scope

- MCP server process with stdio transport (`src/server.ts`)
- `emit_event` tool: validates and ingests telemetry events into DuckDB
- `query_telemetry` tool: structured queries with Markdown + JSON + raw event output
- All 9 event types: `phase_start`, `phase_end`, `spec_gap`, `validation_failure`, `deviation`, `migration_proposal`, `context_pressure`, `mcp_impact`, `self_correction`
- All query modes: bottleneck (REQ-002), failure/loop (REQ-003), token efficiency (REQ-004)
- JSON Schema validation at ingestion (`schemas/telemetry-event.schema.json`)
- DuckDB storage layer with WAL mode and temporal optimisation (`src/db/`)
- Setup CLI: `setup` and `doctor` commands (`src/cli.ts`)
- Build and bundle pipeline: `tsc` + `esbuild` → `server.bundle.mjs`, `cli.bundle.mjs`
- Scripts: `postinstall.mjs`, `build.sh`, `build.ps1`, `setup.sh`, `setup.ps1`, `version-sync.mjs`
- GitHub Actions CI: typecheck, test (including performance test), build — matrix: Windows, macOS, Linux
- Vitest test suite: unit tests, performance test (p95 < 5ms gate), benchmark tests (informational)
- Component manifest: `src/structured-telemetry-mcp/component.yml`
- Data contract: `src/structured-telemetry-mcp/docs/data-contract.md`
- npm package scaffolding (valid `package.json`, correct `files` array, `bin` entry)

## Out of Scope

- **0008b framework integration**: updating `planifest-framework` skills to emit events — separate pipeline run, depends on this server existing
- **npm publish**: package is scaffolded and valid but not published this run
- **Remote or hosted deployment**: this is a local dev tool only; no containers, no cloud infrastructure
- **Web dashboard (0024)**: the DuckDB file is the data source for a future observability UI — not built here
- **Auto-discovery**: the server is never auto-detected; registration is always explicit via `setup`
- **Server-side loop detection**: loops are identified via query, not detected and emitted as derived events
- **HTTP/SSE transport**: stdio only; other transports are a future concern
- **Authentication or authorisation**: local process, no network exposure, no auth required
- **Event replay or backfill**: no mechanism to re-emit historical events

## Deferred

- **npm publish** — blocked on: decision to make the package public on npmjs.com
- **Hosting / containerisation** — blocked on: user demand signal; no blocking technical dependency
- **Plugin manifests** (`.claude-plugin/`, `.openclaw-plugin/`) — blocked on: decision to list in agent marketplaces; scaffolding can be added when needed
- **Multi-writer support** — blocked on: use case where more than one process writes concurrently; current single-writer architecture is sufficient
