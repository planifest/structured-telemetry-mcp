---
title: "ADR 016: Event Log Bounding — Limit/Offset Replaces Mandatory Scope Filter"
summary: "event_log queries are now bounded solely by limit/offset; the runtime requirement for a session_id/initiative_id/event_type filter is removed."
status: "accepted"
version: "0.1.0"
---
# ADR-016 - Event Log Bounding — Limit/Offset Replaces Mandatory Scope Filter

**Skill:** [adr-agent](../skills/planifest-adr-agent/SKILL.md)
**Feature:** 0000015-telemetry-log-viewer-ui
**Component:** structured-telemetry-mcp
**Date:** 2026-08-01

## Context

ADR-010 (0000008c) established `event_log` as a fourth query family and decided "unbounded queries are not supported," with a default `limit` of 100. The concrete runtime enforcement of that principle, implemented in `src/query/event-log.ts` and duplicated in `src/server-factory.ts`'s `dispatchQuery`, went further than the ADR text: it throws `"event_log requires at least one scope parameter: session_id, initiative_id, or event_type"` whenever none of those three is supplied — regardless of `limit`.

The new browser log-viewer UI (0000015) needs a default "recent events" view with no filter pre-selected. That view is impossible under the current rule: a user must already know a `session_id`/`initiative_id`/`event_type` before seeing anything. During P0 coaching, the human pointed out that this scope-filter requirement was never actually necessary for boundedness — pagination (`limit`/`offset`) already bounds every request's result size on its own, independent of whether a filter narrows the row set.

## Decision

Remove the mandatory-scope-filter check entirely from both `src/query/event-log.ts` and `src/server-factory.ts`. An `event_log` query with zero filters is now valid. Every request remains bounded, but by `limit`/`offset` alone:

- `limit` keeps its existing default of 100 when omitted (unchanged from ADR-010).
- A new upper bound is added: `limit` values above 1000 are rejected with a clear error. This is an API-misuse guard only — normal page sizes (10–100) are far below it — not a feature restriction.
- `offset` is added (default 0) to support real pagination, alongside a new `total_count` in the response so callers can compute "page X of Y."

This is recorded as an **amendment to ADR-010**, not a supersession: ADR-010's core decision (event_log as its own query family, AND-semantics when multiple scope filters are given, insertion-order default) is unchanged. Only the "unbounded queries are not supported → therefore a scope filter is mandatory" inference is revised — that inference conflated two different bounding mechanisms (filtering vs. pagination), and pagination alone already satisfies the original "not unbounded" goal.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Keep the mandatory scope filter; UI must prompt the user to pick one before showing anything | No contract change, zero risk to existing callers | Poor UX for the stated use case ("browse recent events") — defeats the point of a log viewer | Rejected — fails the confirmed happy-path scenario (open UI → see recent events) |
| Add a fixed hard cap (e.g. always return ≤100 rows regardless of requested limit) for unscoped queries specifically | Simple, obviously safe | Redundant given limit/offset already bounds every request; treats unscoped queries as more dangerous than scoped ones for no real reason | Rejected per P0 discussion — the human correctly identified this as an unnecessary extra restriction |
| Keep the requirement, add a special "browse mode" query type instead | Avoids touching existing behavior | Adds a fifth query family/mode for something that's really just "event_log with no filters" — unnecessary complexity | Rejected — event_log already supports zero-to-many optional filters; making "zero filters" a special case is inconsistent |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | `src/query/event-log.ts` (remove throw, add offset/total_count/max-limit guard), `src/server-factory.ts` (remove duplicate pre-check), three existing tests updated (`tests/unit/server-factory.test.ts:125`, `tests/integration/query-telemetry.test.ts:256`, `tests/regression/query-routing.test.ts:132`) |

## Consequences

**Positive:**
- The log-viewer UI can show a useful default view without requiring upfront knowledge of a session_id/initiative_id
- The bounding mechanism is simpler to reason about: one rule (limit/offset), not two overlapping rules (scope filter AND limit)
- Existing scoped queries are completely unaffected — this is a pure relaxation, not a behavior change for any caller that already supplies a filter

**Negative:**
- Any external caller that relied on the old error as expected behavior (none found in application code — only test assertions, see risk-register.md R-002/A-003) would see a behavior change
- A caller that forgets to pass `limit` on an unscoped query now gets up to 100 rows across the whole table by default, rather than an error — a caller must now deliberately choose page size rather than being forced to narrow by scope first

**Risks:**
- The rule is enforced in two separate files; if a future change updates one without the other, the two call paths will drift out of sync again (tracked in risk-register.md R-001)

## Related ADRs

- ADR-010 - amended (bounding mechanism revised; all other decisions in ADR-010 stand)

## Supersedes

- None (amends ADR-010; does not supersede it)

## Superseded By

- None
