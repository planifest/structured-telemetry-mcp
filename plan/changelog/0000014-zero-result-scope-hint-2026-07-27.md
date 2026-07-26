# Changelog — 0000014-zero-result-scope-hint — 27 Jul 2026

**Feature:** Zero-Result Scope Hint
**Pipeline run:** Change Pipeline (precedent: `0000011-defects-and-query-telemetry-fix`, `0000012-test-harness-and-sdk-audit`, `0000013-group-by-validation-fix`)

## What Was Built

Fast-follow to `0000013`. While verifying that fix, a sibling `planifest-framework` session hit a second, distinct source of confusion: a scoped `query_telemetry` call (`session_id`/`initiative_id`) that matched zero rows was indistinguishable from "no data exists for this scope" — even when real events existed under a different event type than the query family reads. Investigated and confirmed not a bug (bottleneck queries only ever read `phase_end` by design, already tested), but a real, repeated discoverability gap: a valid-shaped query silently returning an empty result gives no signal that the event type was wrong.

Fix: `buildScopeHint()` added to `src/query/format-results.ts` — on the zero-row path only, for a scoped query, runs one cheap `GROUP BY event LIMIT 5` lookup against the same scope and attaches a `hint` field (+ markdown note) naming what event types actually exist there, if any. Wired into all 10 query-builder functions across `bottlenecks.ts` (1), `failures.ts` (4), and `token-efficiency.ts` (5). `event_log` excluded — it already returns real matching events.

## Artifacts Produced

- `plan/current/change-summary.md`
- Updated: `src/query/format-results.ts`, `src/query/bottlenecks.ts`, `src/query/failures.ts`, `src/query/token-efficiency.ts`, `tests/integration/query-telemetry.test.ts`, `component.yml`, `product.yml`, `package.json`, `README.md`, `src/structured-telemetry-mcp/docs/quirks.md`

## Decisions

None requiring a new ADR — additive JSON field only, no interface/contract change.

## Validation

330/330 Vitest tests (6 new integration tests), typecheck clean, build succeeds.

## Skipped Phases

None. (Full P1/P2/P5 artifact sets don't apply to Change Pipeline runs — see `0000011`'s changelog for the routing rationale, unchanged here.)
