# Architecture Overview

> Living document. Reflects current system state. Updated after every pipeline run.
> Do not archive this file — update it in place.

Last updated: 0000019-loopback-daemon-hardening

---

## System Summary

`structured-telemetry-mcp` is a local MCP server that ingests structured telemetry events (phase timings, failures, context pressure, loop iterations, phase reversals) from Planifest pipeline agents and answers structured queries over them. It runs continuously as a background service — on Windows via `nssm`, and as of 0000010 also on macOS (`launchd`) and Linux (`systemd --user`) — so any Planifest project's telemetry hooks work without a foreground terminal. As of 0000015, the same backend also serves a read-only browser UI (`GET /ui`) for browsing, filtering, and paging events — the first human-facing (non-MCP, non-CLI) surface this component exposes. As of 0000016, the HTTP/browser surface (`/emit`, `/query`, `/health`, `/ui`) has true black-box E2E coverage (`@playwright/test`, real server process + ephemeral DuckDB per run) — the first automated test layer in this project that exercises the live `node:http` server rather than its exported handlers. As of 0000017, the Log Viewer gained three interaction-quality improvements over 0000015's static browse-only view: live auto-refresh/tail mode (interval polling, no push mechanism), per-field filter-value suggestions (a new `distinct_values` query mode), and sortable table headers backed by a genuine per-column backend sort (previously hardcoded to `timestamp` only) — all three kept in sync via URL query params. As of 0000018, the daemon guarantees the integrity of its own record: it checkpoints on a schedule and on graceful shutdown (bounding data loss on an unclean kill to 60s/100 events), refuses to start rather than serve from a locked or unreplayable-WAL database (exiting cleanly, per ADR-030, so supervision correctly leaves it stopped), and takes a daily verified backup in-process on its own DuckDB connection (ADR-028/029) — restored, row-counted, and only then promoted, never left in a state that could be mistaken for good. Deploy tooling gained a build-content fingerprint (an additive `/health` field) and orphan-port detection, so a stale running process is caught even at an unchanged version string. As of 0000019, the loopback HTTP daemon hardens its request boundary: it checks caller provenance on every request (a `Host` allow-list and `Origin` rejection before routing, plus a `Content-Type: application/json` requirement on writes — ADR-032), closing a browser-mediated CSRF-write and DNS-rebinding-read surface that `127.0.0.1` binding alone does not cover, deliberately without adding a shared secret; caps request bodies at two independent enforcement points and times out a stalled request so a single malformed request can no longer reach the `uncaughtException` exit path; runs one shared query-validation gate across both the HTTP and MCP paths (rejecting rather than clamping over-ceiling numerics, and validating the previously-unchecked `offset`); and redacts engine errors to a generic `500` carrying a `correlationId` that maps to a full stderr log line, replacing the previous `400` responses that interpolated raw SQL text and stored row values. This is the first formal OpenAPI contract for the HTTP surface (`src/structured-telemetry-mcp/docs/openapi-spec.yaml`).

---

## Components

| Component | Type | Purpose | Status |
|-----------|------|---------|--------|
| structured-telemetry-mcp | microservice | MCP server + local HTTP backend for telemetry ingestion, querying, and service supervision | active |

---

## Communication Patterns

```mermaid
flowchart LR
    Agent[Agent tool<br/>Claude Code / Cursor / etc.] -->|MCP stdio| Proxy[stdio proxy<br/>server.bundle.mjs]
    Proxy -->|HTTP :3741| Backend[server-http.bundle.mjs<br/>persistent daemon]
    Browser[Browser<br/>Log Viewer UI] -->|GET /ui, POST /query<br/>incl. 5s auto-refresh poll| Backend
    Backend -->|read/write, checkpoint| DuckDB[(DuckDB<br/>telemetry.db)]
    Backend -->|daily, in-process timer<br/>verify -> promote -> prune| Backups[(Backup artifacts<br/>~/.planifest-backups)]
    Deploy[npm run deploy] -->|GET /health incl. buildId| Backend
    Doctor[npm run doctor] -.->|reads sidecar, never opens telemetry.db| Backups
```

The stdio proxy (spawned per agent session, per ADR-009) forwards `emit_event`/`query_telemetry` calls over HTTP to a single persistent backend process, which owns the one DuckDB connection. The backend is what 0000010's service scripts install and supervise — it's the process launchd/systemd/nssm keep running. As of 0000015, a human's browser talks to the same backend directly (`GET /ui` for the page, same-origin `POST /query` for data) — no proxy, no separate process (ADR-018). As of 0000018, the backend also owns a second on-disk location for verified backups (ADR-029: in-process, its own connection, never a second connection to `telemetry.db`) — `doctor` reads a small sidecar file there rather than ever opening the live database.

---

## Data Ownership

| Data Store | Owner | Consumers |
|------------|-------|-----------|
| `telemetry.db` (DuckDB, `~/.planifest/telemetry.db`) | structured-telemetry-mcp | Read-only via `query_telemetry` MCP tool or `POST /query` REST endpoint — never direct file access |
| Backup artifacts (`PLANIFEST_TELEMETRY_BACKUP_DIR`, default `~/.planifest-backups`) — not a DuckDB table, `EXPORT DATABASE` directories + a sidecar JSON metadata file (0000018) | structured-telemetry-mcp | `npm run doctor` reads the sidecar file only; a human restores via `IMPORT DATABASE` per `src/structured-telemetry-mcp/docs/restore-procedure.md` |

---

## External Dependencies

| Dependency | Type | Components That Use It |
|-----------|------|----------------------|
| `@modelcontextprotocol/sdk` | npm | structured-telemetry-mcp (MCP tool registration, stdio transport) |
| `@duckdb/node-api` | npm | structured-telemetry-mcp (storage engine, ADR-002) |
| `ajv` / `ajv-formats` | npm | structured-telemetry-mcp (JSON Schema wire validation, ADR-005) |
| `zod` | npm | structured-telemetry-mcp (`emit_event` tool-argument gate only, ADR-013 — not a replacement for ajv) |
| `planifest-framework` (sibling repo) | consumer, not a code dependency | Calls `emit_event`/`query_telemetry`; as of 0000010 also emits `loop_iteration` and `phase_reversal_*` events |
| macOS `launchd` / Linux `systemd --user` / Windows `nssm` | OS service supervisor | Keeps the backend process running across logout/reboot (0000010, 0000008-foundation for Windows) |

---

## Key Architectural Decisions

Reference `docs/decisions-index.md` for the full list.

- **ADR-001–002:** TypeScript/Node.js + DuckDB foundation.
- **ADR-005:** JSON Schema/ajv is the source of truth for event wire validation — deliberately not Zod, so the schema stays shareable with `planifest-framework` without a TS dependency.
- **ADR-009:** stdio proxy + persistent HTTP backend — the architecture 0000010's service scripts supervise.
- **ADR-013:** `emit_event`'s MCP tool *argument* now uses a real Zod object schema (distinct from ADR-005's wire-schema decision) — gives calling models a structural scaffold instead of an opaque `z.unknown()`.
- **ADR-014:** Background service supervision is always user-scoped (never a root daemon), and never silently escalates privileges or changes persistent account settings — explains and prints the remediation command instead.
- **ADR-015:** `query_telemetry` gets the same tool-argument treatment as ADR-013, but permissively (`.passthrough()`, no enum, no rename) — `dispatchQuery`'s existing validation remains the semantic source of truth for query shape.
- **ADR-016:** `event_log`'s mandatory scope-filter requirement is removed (amends ADR-010) — every request is bounded solely by `limit`/`offset` instead.
- **ADR-017:** `product_id` is additive (optional envelope field + nullable column) and never backfilled on existing rows — no reliable signal exists for pre-0000015 data.
- **ADR-018:** The Log Viewer UI is plain HTML/CSS/vanilla JS with no build step, embedded as a TypeScript string and served in-process — no new component, no new dependency.
- **ADR-019:** Populating `product_id` in `planifest-framework`'s own emission hooks is that product's responsibility, not this one's — tracked as a cross-product backlog dependency, not built here.
- **ADR-020:** `@playwright/test` adopted as the E2E test framework for both suites (backend HTTP, browser UI) — Vitest continues to own all unit/integration tests unchanged.
- **ADR-021:** The Playwright MCP server is an interactive test-authoring/verification aid used during codegen only — `@playwright/test` remains the sole CI-executed engine for the shipped suites.
- **ADR-022:** Both E2E suites use an ephemeral real-server-process + temp-DuckDB harness per run (never handler-level mocking, never a shared dev instance) — genuine black-box coverage, isolated by construction.
- **ADR-023:** The UI E2E suite is Chromium-only — the vanilla-JS, framework-free `/ui` page (ADR-018) carries low cross-browser risk, and the narrower scope keeps CI runtime well within budget.
- **ADR-024:** One shared, exported column allow-list (`src/query/column-allow-list.ts`) is the single SQL-injection-via-identifier defense for both `event_log`'s `sortField` and `distinct_values`' `field` — DuckDB has no parameterized-identifier binding, so this allow-list is the only defense for either.
- **ADR-025:** `event_log` gains a real per-column `sortField` (allow-listed, defaults to `timestamp`), replacing the previously hardcoded `ORDER BY timestamp` — additive, non-breaking.
- **ADR-026:** `distinct_values` is a new `mode` on the existing `POST /query` dispatch, not a new REST route — consistent with how every other query family (bottlenecks, failures, token-efficiency, event_log) is reached.
- **ADR-027:** Auto-refresh is client-side interval polling (5s) against the existing `/query` endpoint — no WebSocket/SSE/push mechanism; the server has no awareness a request is a "poll."
- **ADR-028:** Backups use DuckDB's native `EXPORT DATABASE` (Parquet + `schema.sql`), not a raw file copy — version-independent, unlike the exact failure mode that caused the 2026-08-03 incident.
- **ADR-029:** The backup routine runs in-process, on the daemon's own DuckDB connection — never a second connection to `telemetry.db`, eliminating the single-writer-lock conflict by construction rather than by scheduling around it.
- **ADR-030:** Refuse-to-start exits 0, deliberately — matches `planifest-framework`'s own ADR-005 (0000003) hook precedent, and is mechanically correct against both `launchd`'s and `systemd`'s existing restart-on-failure-only semantics.
- **ADR-031 (amends ADR-014):** Supervision circuit-breaker config (`ThrottleInterval`/`StartLimitBurst`) is defense-in-depth against unrelated crash loops, not the primary stay-stopped mechanism — that's ADR-030's exit code.
- **ADR-032:** The loopback daemon checks caller *provenance* (`Host` allow-list, `Origin` rejection, `Content-Type` requirement on writes) but adds no shared-secret credential — a token in `~/.planifest/` would defend only against browser pages the three checks already fully exclude, while giving nothing against a same-user process that reads `telemetry.db` off disk. Narrows, rather than removes, the earlier "no auth model required" position.

---

*Template: architecture-overview.template.md*
