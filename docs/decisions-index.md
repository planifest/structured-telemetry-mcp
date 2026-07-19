# Decisions Index

> Living document. Index of all ADRs across all features. Updated after every pipeline run.
> Do not archive this file — update it in place.

Last updated: 0000011-defects-and-query-telemetry-fix

---

## All Architecture Decision Records

| ADR | Title | Feature | Status | Summary |
|-----|-------|---------|--------|---------|
| [ADR-001](../plan/0000008-mcp-server-foundation/adr/ADR-001-stack-choice.md) | Stack Choice — TypeScript, Node.js, @modelcontextprotocol/sdk | 0000008-mcp-server-foundation | active | Server built in TypeScript on Node.js using the official MCP SDK — foundation for every other technical decision. |
| [ADR-002](../plan/0000008-mcp-server-foundation/adr/ADR-002-storage-engine-duckdb.md) | Storage Engine — DuckDB | 0000008-mcp-server-foundation | active | DuckDB as the telemetry store — high-throughput OLAP on millions of rows, near-zero config, no separate server process. |
| [ADR-003](../plan/0000008-mcp-server-foundation/adr/ADR-003-mcp-transport-stdio.md) | MCP Transport — stdio | 0000008-mcp-server-foundation | superseded | Originally stdio at the agent boundary; superseded by ADR-008, then reinstated at the MCP layer by ADR-009 (stdio proxy + HTTP backend). |
| [ADR-004](../plan/0000008-mcp-server-foundation/adr/ADR-004-event-storage-schema.md) | Event Storage Schema — Single Table with JSON Data Column | 0000008-mcp-server-foundation | active | All event types stored in one `events` table; typed payload in a JSON column — trades column-level typing for schema flexibility. |
| [ADR-005](../plan/0000008-mcp-server-foundation/adr/ADR-005-schema-validation-json-schema.md) | Schema Validation Strategy — JSON Schema as Source of Truth | 0000008-mcp-server-foundation | active | `schemas/telemetry-event.schema.json` is canonical; runtime validation via ajv directly. Zod not used for wire validation (see ADR-013 for the narrower tool-argument exception). |
| [ADR-006](../plan/0000008-mcp-server-foundation/adr/ADR-006-loop-detection-query-side.md) | Loop Detection — Query-Side Only | 0000008-mcp-server-foundation | active | Server does not detect or emit loop events — loops identified by the human via `query_telemetry`. Keeps the server a dumb store. |
| [ADR-007](../plan/0000008-mcp-server-foundation/adr/ADR-007-dependency-versioning.md) | Always Use Latest Stable npm Packages | 0000008-mcp-server-foundation | active | All npm dependencies (runtime + dev) must be latest stable at time of pipeline run — minimises CVE exposure and breaking-change backlog. |
| [ADR-008](../plan/0000008-mcp-server-foundation/adr/ADR-008-mcp-transport-http-sse.md) | MCP Transport — HTTP/SSE daemon | 0000008-mcp-server-foundation | superseded | Replaced stdio with a persistent HTTP/SSE daemon; superseded by ADR-009 when Claude Desktop rejected SSE config formats. |
| [ADR-009](../plan/0000008-mcp-server-foundation/adr/ADR-009-mcp-transport-stdio-proxy-http-backend.md) | MCP Transport — stdio proxy + HTTP REST backend | 0000008-mcp-server-foundation | active | Each session spawns a lightweight stdio proxy; DB operations forwarded via HTTP to one persistent backend owning the DuckDB connection. This is the backend process 0000010's service scripts supervise. |
| [ADR-010](../plan/0000008c-bug-fixes-schema-and-query-extensions/adr/ADR-010-event-log-fourth-query-family.md) | event_log as a Fourth Distinct Query Family | 0000008c-bug-fixes-schema-and-query-extensions | active | `event_log` implemented as its own query family with a dedicated interface and dispatch branch, not a mode inside an existing family. |
| [ADR-011](../plan/0000008c-bug-fixes-schema-and-query-extensions/adr/ADR-011-session-id-validate-and-throw.md) | Validate-and-Throw for Required session_id Parameters | 0000008c-bug-fixes-schema-and-query-extensions | active | `failure_sequence`/`drill_down` throw on missing/empty `session_id` rather than silently returning zero rows. |
| [ADR-012](../plan/0000008c-bug-fixes-schema-and-query-extensions/adr/ADR-012-truncation-admin-shell-scripts.md) | Post-Deployment Truncation as Admin-Gated Shell Scripts | 0000008c-bug-fixes-schema-and-query-extensions | active | Truncation delivered as standalone admin/sudo-gated shell scripts, not a CLI subcommand — prevents accidental or agent-driven execution. |
| [ADR-013](../plan/_archive/0000010-macos-launchd-service-2026-07-19/adr/ADR-013-emit-event-tool-argument-schema.md) | emit_event Tool-Argument Schema Redesign | 0000010-macos-launchd-service | active | Replaces `z.unknown()` with a real `EmitEventEnvelope` Zod object schema; renames the argument `event`→`envelope`. ajv/JSON Schema remains the source of truth for `data` — Zod is an argument-shape gate only, not a reversal of ADR-005. |
| [ADR-014](../plan/_archive/0000010-macos-launchd-service-2026-07-19/adr/ADR-014-macos-linux-service-supervision.md) | macOS/Linux Background Service Supervision | 0000010-macos-launchd-service | active | User-scoped `launchd` (macOS) and `systemd --user` (Linux) supervise the backend, mirroring the existing Windows `nssm` approach. No root daemon on either platform; locked-permission/disabled-lingering failures are explained, never silently auto-fixed. |
| [ADR-015](../plan/0000011-defects-and-query-telemetry-fix/adr/ADR-015-query-telemetry-tool-argument-schema.md) | query_telemetry Tool-Argument Schema | 0000011-defects-and-query-telemetry-fix | active | Extends ADR-013 to `query_telemetry`: replaces `z.unknown()` with `QueryShape`, a permissive `.passthrough()` object schema (looser than `emit_event`'s, since query shapes vary and `dispatchQuery` already validates them). Non-breaking, no argument rename. |

---

## Status Definitions

| Status | Meaning |
|--------|---------|
| active | Decision stands; implementation follows it |
| superseded | Replaced by a later ADR (reference provided in the ADR body) |
| amended | Core decision unchanged but conditions or scope updated |

---

*Template: decisions-index.template.md*
