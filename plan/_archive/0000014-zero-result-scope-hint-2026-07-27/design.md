# Design - 0000014-zero-result-scope-hint

## Feature
- Problem: A scoped `query_telemetry` call (bottlenecks/failures/token-efficiency, `session_id` or `initiative_id`) that matches zero rows for its event-type/family is indistinguishable from a scope with no data at all — even when real events exist for that exact scope under a different event type. This has caused real, repeated confusion for an external caller in the same session.
- Adoption mode: standard-iterative
- Feature ID: 0000014-zero-result-scope-hint

## Product Layer
- User stories:
  - US-001: As a caller of `query_telemetry` whose scoped query returns zero rows, I want to know whether that's because no events exist for my scope at all, or because events exist but are the wrong type for this query family, so that I can correct my query instead of assuming the backend is broken or data is missing.
- Acceptance criteria confirmed: 1 — when `rows.length === 0` and the query was scoped by `session_id` and/or `initiative_id`, and events matching that exact scope exist under different event types, the response's JSON payload includes a `hint` string naming the event types and counts found; when no events exist for the scope at all, or the query wasn't scoped, no `hint` field is added (unchanged response shape)
- Constraints: additive only — no existing field removed or renamed, no behavior change for non-empty results or for `event_log` (which already returns real matching events)
- Integrations: none

## Architecture Layer
- Latency target: deferred - recorded in scope (one extra indexed lookup only on the already-rare empty-result path; no impact on the common path)
- Availability target: deferred - recorded in scope (unaffected)
- Scalability target: deferred - recorded in scope (unaffected; hint query is `LIMIT 5`, scoped by session_id/initiative_id which are the existing indexed/filtered columns)
- Security: no change
- Data privacy: no regulated data
- Observability: no change
- Cost boundary: not constrained

## Engineering Layer
- Stack: TypeScript / Node / DuckDB — unchanged, no new stack choices
- Components: structured-telemetry-mcp (single component)
- Data ownership: unchanged
- Deployment: unchanged
- API versioning: not applicable (additive JSON field, no contract break)

## Scope
- In: one shared helper (`buildScopeHint` in `src/query/format-results.ts`) that, given a DB connection and a `{session_id?, initiative_id?}` scope, returns a hint string (or `undefined`) summarising other event types found for that scope; wired into every query builder function in `bottlenecks.ts`, `failures.ts` (4 modes), and `token-efficiency.ts` (5 modes) at their zero-row path; regression/integration tests
- Out: `event_log` (no hint needed — it already returns real matching events); deduplicating the pre-existing `runQuery`/`sampleEvents`/`rowToRaw` triplication across the three query-builder files (real, pre-existing tech debt, out of scope for this change); any change to non-empty-result behavior
- Deferred: none

## Assumptions
- The extra `SELECT event, COUNT(*) ... GROUP BY event LIMIT 5` lookup on the empty-result path is cheap enough not to need a dedicated perf test — impact if wrong: revisit with an index or skip-on-large-scope guard if it shows up in the existing p95 performance gate

## Risks
- Low likelihood, low impact — purely additive, only triggers on the already-rare zero-row path, covered by new tests per query family

## Dependencies
- Upstream: none (branched off `main`, independent of the still-open 0000013 PR)
- Downstream: none

## Active Skills
None

## Skill Map
| Requirement | Best-fit Skill | Rationale |
|-------------|----------------|-----------|
| Zero-result scope hint | planifest-change-agent | Targeted addition to one existing component, no new component, no schema/contract change |

## Component Paths
- src/query/format-results.ts
- src/query/bottlenecks.ts
- src/query/failures.ts
- src/query/token-efficiency.ts
- tests/

## Repo Instructions
### archiving-policy.md
All pipeline runs archive to `plan/_archive/{feature-id}-{YYYY-MM-DD}/` when they finish — no exceptions for route (Change Pipeline included). See `planifest-overrides/instructions/archiving-policy.md` for the full rule and rationale.

## Confirmation
Human confirmed this design before proceeding: yes — explicit instruction "Go ahead — I'll build the fast-follow" given after the human proposed the fix and I confirmed the approach
Date confirmed: 27 Jul 2026
