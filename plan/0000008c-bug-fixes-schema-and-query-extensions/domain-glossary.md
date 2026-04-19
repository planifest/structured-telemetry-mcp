---
title: "Domain Glossary - 0000008c-mcp-fixes-and-enhancements"
summary: "Ubiquitous language for the 0008c patch release. Extends 0008a terminology."
status: "active"
version: "0.1.0"
---
# Domain Glossary - 0000008c-mcp-fixes-and-enhancements

**Skill:** spec-agent (updated by any agent that introduces a new domain term)
**Tool:** Claude Code
**Model:** claude-sonnet-4-6
**Feature:** 0000008c-mcp-fixes-and-enhancements
**Version:** 0.1.0

> The ubiquitous language for this feature. Agents and humans use these terms in code, comments, file names, variable names, and documentation.

---

## Terms

| Term | Definition | Aliases | Used In |
|------|-----------|---------|---------|
| `phase_skip` | An event emitted by `planifest-orchestrator` when a pipeline phase is determined unnecessary and bypassed. Contains `phase_name` (the skipped phase) and `reason`. | — | `schemas/telemetry-event.schema.json`, `src/types/events.ts` |
| `security_finding` | An event emitted by `planifest-security-agent` when a vulnerability or security risk is identified during the security review phase. Contains `component_id`, `title`, `severity` (low/medium/high/critical), and optional `cwe`. Distinct from `deviation` — a finding is not a design deviation. | — | `schemas/telemetry-event.schema.json`, `src/types/events.ts` |
| `retry_limit_exceeded` | An event emitted once when an agent reaches the 5-attempt escalation ceiling and gives up. Distinct from `self_correction` (which fires on each retry attempt). The primary signal for systemic failures vs. transient ones. | — | `schemas/telemetry-event.schema.json`, `src/types/events.ts` |
| `adr_decision` | An event emitted by `planifest-adr-agent` after an ADR is written. Captures `adr_id`, `title`, and `chosen_option` in the telemetry store so architectural choices can be queried without reading ADR files. | — | `schemas/telemetry-event.schema.json`, `src/types/events.ts` |
| `doc_gap` | An event emitted by `planifest-docs-agent` when documentation is missing or incomplete for a component. Contains `component_id` and `description` of what is missing. Distinct from `deviation` — an absence, not a divergence. | — | `schemas/telemetry-event.schema.json`, `src/types/events.ts` |
| `BottleneckGroupBy` | A TypeScript union type enumerating the valid dimensions by which bottleneck queries can be grouped. In 0008c: `'phase' \| 'agent' \| 'tool' \| 'run_id' \| 'content_type' \| 'mcp_mode' \| 'initiative_id'`. | group dimension | `src/query/bottlenecks.ts` |
| `resolveGroupColumn` | The function in `src/query/bottlenecks.ts` that maps a `BottleneckGroupBy` value to the SQL column expression used in GROUP BY. An exhaustive switch — every union member must have a case. | — | `src/query/bottlenecks.ts` |
| `event_log` | A new query mode that returns the complete raw event stream for a session or initiative, ordered by timestamp ascending. Unlike `failure_sequence`, it is not filtered by event type — it returns all events with full `data` payloads. | raw event stream, full event timeline | `src/query/event-log.ts`, `src/server-factory.ts` |
| `initiative_id` filter | An optional query parameter added to all three query families (bottlenecks, failures, token-efficiency) that scopes results to events belonging to a specific initiative. Applied as `AND initiative_id = $initiative_id` in the WHERE clause. | — | `src/query/bottlenecks.ts`, `src/query/failures.ts`, `src/query/token-efficiency.ts` |
| `EventLogQuery` | The TypeScript interface for `event_log` queries. Contains `mode: "event_log"`, optional `session_id`, optional `initiative_id`, and optional `limit`. At least one scope parameter required. | — | `src/query/event-log.ts`, `src/query/query-service.ts` |
| `DELETE-ALL-PRODUCTION-RECORDS` | The filename prefix for the post-deployment truncation scripts (`scripts/DELETE-ALL-PRODUCTION-RECORDS.ps1`, `scripts/DELETE-ALL-PRODUCTION-RECORDS.sh`). All-caps by design — stands out visually among lowercase filenames as a warning signal. | truncation script | `scripts/` |
| Silent empty result | The bug pattern where a query requiring `session_id` falls back to `session_id = ''` and returns zero rows without error, misleading the caller into believing the session has no data. Fixed by BUG-002 and BUG-003. | — | `src/query/failures.ts`, `src/query/token-efficiency.ts` |

---

### Carried forward from 0008a (key terms)

| Term | Definition |
|------|-----------|
| `emit_event` | The MCP tool that accepts a `TelemetryEvent` envelope, validates it against the JSON schema, and persists it to DuckDB |
| `query_telemetry` | The MCP tool that accepts a query object, routes it via `dispatchQuery` to the appropriate query family, and returns a `QueryResponse` |
| `dispatchQuery` | The routing function in `src/server-factory.ts` that inspects the query object and calls the appropriate `IQueryService` method |
| `IQueryService` | The interface that abstracts DuckDB query logic; implemented by `HttpQueryService` |
| `QueryResponse` | The standard return format for all query results: `{ headers: string[], rows: unknown[][] }` |
| `mcp_mode` | One of `none \| workspace \| context \| workspace+context` — records which MCP servers were active during the session |
| `session_id` | UUID identifying a single agent session; present on every event |
| `initiative_id` | Optional feature/initiative identifier from `plan/current/`; nullable in the `events` table |

---

*Generated by spec-agent. Updated by any agent that introduces a new domain term.*
