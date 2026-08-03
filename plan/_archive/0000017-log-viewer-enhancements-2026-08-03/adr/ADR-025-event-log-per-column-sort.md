---
title: "ADR 025: event_log Gains a Real Per-Column sortField, Replacing Hardcoded ORDER BY timestamp"
summary: "event_log queries accept a new optional sortField param (allow-listed per ADR-024, defaulting to timestamp) so sorting is no longer fixed to a single column."
status: "accepted"
version: "0.1.0"
---
# ADR-025 - event_log Gains a Real Per-Column sortField

**Skill:** [adr-agent](../skills/planifest-adr-agent/SKILL.md)
**Feature:** 0000017-log-viewer-enhancements
**Component:** structured-telemetry-mcp
**Date:** 2026-08-02

## Context

This feature's design assumed a pre-existing "sort-field dropdown" for the UI's clickable headers to sync against (per the confirmed feature brief). During P1, inspection of the actual code found no such thing: `queryEventLog` (`src/query/event-log.ts:41,54`) hardcodes `ORDER BY timestamp ${sortDirection}` — only the direction (`asc`/`desc`) is configurable via the existing `sort` param; the sorted column has never been anything but `timestamp`. This was surfaced to the human as a P1 spec gap (`plan/current/build-log.md`, "spec_gap (sort field)") and confirmed: build real per-column sort, not a frontend-only reskin of the direction toggle.

This is a query-contract change to an existing, already-shipped endpoint (`event_log`, used by both the MCP `query_telemetry` tool and the REST `/query` endpoint since 0000008c/ADR-010), so it needs an ADR: it's costly to reverse once callers depend on it, and it's a direct extension of ADR-016's bounding/query-shape decisions.

## Decision

Add an optional `sortField` param to `EventLogQuery` (`src/query/event-log.ts:19-32`), typed against `SORTABLE_FIELDS` from the shared allow-list (ADR-024), **defaulting to `'timestamp'`** when omitted. `queryEventLog` validates `sortField` against the allow-list (throwing a clear error on an invalid value, before any SQL executes — same pattern as the existing `limit > MAX_LIMIT` guard), resolves it to a real column name via `ALLOWED_EVENT_COLUMNS`, and builds `ORDER BY ${resolvedColumn} ${sortDirection}` instead of the hardcoded `ORDER BY timestamp ${sortDirection}`.

Because the default is `'timestamp'`, every existing caller (MCP tool invocations, REST callers, existing tests) that does not pass `sortField` observes byte-identical behavior to today — this is a strictly additive, non-breaking change, consistent with how `sort` itself was introduced non-breaking in 0000015.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Keep `ORDER BY timestamp` fixed; headers only toggle direction, not field (reinterpret "sortable headers" as direction-only) | Zero backend change, smallest possible diff | Does not deliver what "click a column header to sort by that field" means to a user — a header labeled "Agent" that only ever sorts by timestamp when clicked is misleading UX, not a real feature | Rejected — human explicitly confirmed real per-column sort after the gap was surfaced (build-log.md P1 exchange) |
| A separate `event_log_sorted` query mode instead of extending `EventLogQuery` | Avoids touching the existing query family's contract at all | Splits one conceptual query family into two for no structural reason — `event_log` already accepts many optional params (filters, pagination, direction); a sort field is just one more, not a different query shape | Rejected — inconsistent with how every other optional `event_log` param has been added since ADR-010 |
| Client sorts already-fetched rows in the browser instead of a backend `ORDER BY` | No backend change | Only works correctly on the current page's rows, not the full filtered result set across pages — sorting by e.g. `agent` would need every matching row fetched client-side first, defeating the point of server-side pagination (ADR-016) | Rejected — breaks pagination correctness for anything but the currently-loaded page |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | `src/query/event-log.ts` (`EventLogQuery` interface, `queryEventLog`'s `ORDER BY` construction and new validation guard); no change to `src/server-factory.ts` (`dispatchQuery` already passes the raw query object through unchanged) or `src/query/query-service.ts` (`EventLogQuery` re-exported as-is) |

## Consequences

**Positive:**
- Delivers the actual user-facing capability ("sort by any visible column") rather than a misleading direction-only reskin
- Fully backward-compatible — no existing caller or test needs to change
- Reuses the existing, already-battle-tested `event_log` query family rather than introducing a parallel one

**Negative:**
- `queryEventLog` gains one more responsibility (identifier validation) beyond its existing value-parameter validation (`limit`, `offset`) — a slightly larger function, though the added guard is a two-line allow-list check consistent with the existing style

**Risks:**
- If `SORTABLE_FIELDS` (ADR-024) is ever bypassed or a future edit interpolates `sortField` directly, this reintroduces a SQL-injection-via-identifier vector — mitigated by ADR-024's shared allow-list and the requirement for a regression test asserting rejection of non-allow-listed input (risk-register.md R-001)

## Related ADRs

- ADR-016 (0000015) - established `event_log`'s limit/offset bounding and the pattern of adding optional, backward-compatible params to the same query family
- ADR-024 (0000017) - the shared allow-list this ADR's `sortField` validation depends on

## Supersedes

- None (additive to ADR-016; does not change its decisions)

## Superseded By

- None
