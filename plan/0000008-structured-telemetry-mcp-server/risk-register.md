---
title: "Risk Register: 0000008-structured-telemetry-mcp-server"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
---

# Risk Register - 0000008-structured-telemetry-mcp-server

## Risks

| ID | Category | Description | Likelihood | Impact | Mitigation | Status |
|----|----------|-------------|------------|--------|------------|--------|
| R-001 | technical | DuckDB native module fails to compile on one or more CI matrix platforms (Windows, macOS, Linux). Blocks all storage. | medium | high | CI matrix tests all three platforms from day one; use `@duckdb/node-api` which has prebuilt binaries; document SQLite as fallback path | open |
| R-002 | technical | File lock contention on Windows when the MCP server and a DuckDB client (e.g. CLI) open the file simultaneously. | low | medium | WAL mode reduces lock window; single-writer architecture ensures only the server writes; document that direct DuckDB client access should be read-only | open |
| R-003 | technical | Schema evolution breaks existing stored events when `schema_version` increments. Queries on old rows fail if new required fields are assumed present. | medium | medium | Store `schema_version` on every row; query layer handles missing fields gracefully with null coalescing; migration scripts in `src/db/migrations/` | open |
| R-004 | technical | `emit_event` p95 latency exceeds 5ms target on slower machines or under load. Blocks agent sessions perceptibly. | low | high | DuckDB is designed for high-throughput writes; WAL mode; benchmark on CI; if threshold is exceeded, investigate async write buffering | open |
| R-005 | technical | esbuild bundle includes DuckDB native bindings incorrectly, causing the bundled `server.bundle.mjs` to fail at runtime. | medium | high | Mark `duckdb` / `@duckdb/node-api` as external in esbuild config (same pattern as context-mode-mcp with `better-sqlite3`); test bundled binary in CI | open |
| R-006 | operational | DuckDB file grows unboundedly over many pipeline runs, consuming significant disk space on developer machines. | medium | low | Document recommended retention: archive or delete events older than 90 days; provide a `doctor` check for file size; no automated purge in v1 | open |
| R-007 | operational | Agent emits credentials or sensitive file paths in event `data` payloads (e.g. in `deviation.description`). | low | high | Document that `data` fields must not contain secrets; add a `doctor` check that scans recent events for common credential patterns (e.g. `Bearer `, `password=`); note in README | open |
| R-008 | security | The MCP server process runs locally with filesystem access; a compromised agent could emit crafted events to pollute the telemetry store. | low | low | Local tool, no network exposure; trust boundary is the developer's machine; no mitigation beyond stdio isolation | accepted |
| R-009 | technical | A-001: `@duckdb/node-api` package API is unstable or breaking between minor versions, requiring frequent updates. | low | medium | Pin to a tested minor version; add a `npm audit` step in CI | open |

## Assumptions Carried as Risks

| ID | Category | Description | Likelihood | Impact | Mitigation | Status |
|----|----------|-------------|------------|--------|------------|--------|
| R-A001 | technical | A-001: DuckDB installs cleanly on all target platforms. | medium | high | See R-001 | open |
| R-A002 | technical | A-002: stdio transport is sufficient; no HTTP/SSE needed. | low | medium | Deferred to future pipeline run if use case arises | open |
| R-A003 | security | A-003: Event payloads contain no credentials. | low | high | See R-007 | open |
