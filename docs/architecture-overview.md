# Architecture Overview

> Living document. Reflects current system state. Updated after every pipeline run.
> Do not archive this file — update it in place.

Last updated: 0000015-telemetry-log-viewer-ui

---

## System Summary

`structured-telemetry-mcp` is a local MCP server that ingests structured telemetry events (phase timings, failures, context pressure, loop iterations, phase reversals) from Planifest pipeline agents and answers structured queries over them. It runs continuously as a background service — on Windows via `nssm`, and as of 0000010 also on macOS (`launchd`) and Linux (`systemd --user`) — so any Planifest project's telemetry hooks work without a foreground terminal. As of 0000015, the same backend also serves a read-only browser UI (`GET /ui`) for browsing, filtering, and paging events — the first human-facing (non-MCP, non-CLI) surface this component exposes.

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
    Browser[Browser<br/>Log Viewer UI] -->|GET /ui, POST /query| Backend
    Backend -->|read/write| DuckDB[(DuckDB<br/>telemetry.db)]
```

The stdio proxy (spawned per agent session, per ADR-009) forwards `emit_event`/`query_telemetry` calls over HTTP to a single persistent backend process, which owns the one DuckDB connection. The backend is what 0000010's service scripts install and supervise — it's the process launchd/systemd/nssm keep running. As of 0000015, a human's browser talks to the same backend directly (`GET /ui` for the page, same-origin `POST /query` for data) — no proxy, no separate process (ADR-018).

---

## Data Ownership

| Data Store | Owner | Consumers |
|------------|-------|-----------|
| `telemetry.db` (DuckDB, `~/.planifest/telemetry.db`) | structured-telemetry-mcp | Read-only via `query_telemetry` MCP tool or `POST /query` REST endpoint — never direct file access |

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

---

*Template: architecture-overview.template.md*
