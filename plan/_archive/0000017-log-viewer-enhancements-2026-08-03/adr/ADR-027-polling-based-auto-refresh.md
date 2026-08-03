---
title: "ADR 027: Auto-Refresh Uses Client-Side Polling, Not a Push/WebSocket Channel"
summary: "Live auto-refresh re-issues the existing POST /query on a fixed interval from the browser; no WebSocket, SSE, or server-push mechanism is introduced."
status: "accepted"
version: "0.1.0"
---
# ADR-027 - Polling-Based Auto-Refresh

**Skill:** [adr-agent](../skills/planifest-adr-agent/SKILL.md)
**Feature:** 0000017-log-viewer-enhancements
**Component:** structured-telemetry-mcp
**Date:** 2026-08-02

## Context

req-001 (live auto-refresh / tail mode) needs the event table to reflect newly-ingested events without a manual reload. Two architectural approaches exist: client-side polling (the browser periodically re-issues the existing `POST /query` request) or a server-push mechanism (WebSocket or Server-Sent Events, where the server notifies connected clients when new rows are inserted). `design.md`'s Assumptions section already recorded polling as the working assumption (A-001); this ADR formalizes it as a decision, since it affects the server's transport surface and is costly to reverse once a UI pattern is built around it.

## Decision

Auto-refresh is implemented as client-side interval polling: the browser calls the existing `POST /query` (`mode: 'event_log'`) endpoint every 5 seconds (per req-001) while the toggle is on, exactly as if the user had manually re-submitted the filter form. No WebSocket endpoint, SSE stream, or server-side change-notification mechanism is introduced. The server remains entirely request/response — it has no awareness that a request is a "poll" versus a manual query.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Server-Sent Events (SSE) stream from `server-http.ts`, pushing new rows as they're inserted | Lower latency than polling; no wasted requests when nothing has changed | New long-lived connection type on a server that has never had one; requires tracking connected clients, wiring insert-time notification into `DuckDbEventRepository.write()`, and reasoning about reconnect/backpressure — significant new complexity for a local, single-developer tool with no measured latency problem today | Rejected — the confirmed NFR is p95 < 300ms per poll/query at local data volumes (design.md); a 5-second polling cadence already comfortably meets "feels live" for this use case without any of SSE's operational complexity |
| WebSocket bidirectional channel | Same push benefits as SSE, plus bidirectional if ever needed | Same complexity cost as SSE, plus a heavier protocol than this read-only feature needs (no client-to-server push use case exists) | Rejected for the same reason as SSE, more strongly — this feature has no bidirectional need at all |
| Polling, but server-side (a background job that periodically checks for new rows and caches a diff) | Could reduce redundant query work if many browser tabs poll simultaneously | This is a single-developer local tool — realistically one browser tab, one DuckDB process; the added caching-layer complexity has no real workload to justify it | Rejected — solves a scale problem this deployment model doesn't have (see design.md's explicitly deferred Scalability target) |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | `src/ui/index-html.ts` only (new `pollForUpdates`/`startAutoRefresh`/`stopAutoRefresh` functions, req-001); zero change to `server-http.ts`'s transport/routing — the server continues to see auto-refresh requests as ordinary `POST /query` calls indistinguishable from a manual one |

## Consequences

**Positive:**
- Zero new server-side transport code, connection tracking, or reconnect logic — the entire feature is additive to the existing static-page JS
- Trivially consistent with the existing no-auth, 127.0.0.1-only security posture (NFR-002) — no new listening surface
- Poll failures degrade gracefully using the exact same error path (`fetch` rejection / non-2xx) already handled for the manual-refresh case, rather than needing new push-specific error/reconnect handling

**Negative:**
- Slightly higher latency-to-see-new-events than a push model (up to ~5 seconds, per the poll interval) — accepted as adequate for a local single-developer tool, not a real-time collaboration surface
- Each poll tick is a full `event_log` query re-run (bounded by the existing `limit`/`offset`/filters), not an incremental "what's new since last poll" diff — slightly more DB work per tick than a change-feed would need, but well within NFR-001's p95 < 300ms target at local data volumes (A-002)

**Risks:**
- If local event volumes or poll frequency ever grow enough to make polling noticeably wasteful, this decision would need revisiting toward a push model — tracked as risk-register.md A-001 (documented assumption, not a defect)

## Related ADRs

- ADR-016 (0000015) - established the `limit`/`offset`-bounded query pattern that each poll tick reuses unchanged

## Supersedes

- None

## Superseded By

- None
