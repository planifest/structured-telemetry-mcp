# Changelog — 0000013-group-by-validation-fix — 26 Jul 2026

**Feature:** Group By Validation Fix
**Pipeline run:** Change Pipeline (precedent: `0000011-defects-and-query-telemetry-fix`, `0000012-test-harness-and-sdk-audit`)

## What Was Built

Fixes a real R-009-class validation gap discovered via a live repro from a sibling `planifest-framework` session: `query_telemetry`'s bottleneck query family (`group_by`) accepted any string without checking it against the real 7-value allow-list (`phase`, `agent`, `tool`, `run_id`, `content_type`, `mcp_mode`, `initiative_id`). An invalid value — e.g. `event_type`, a real column but not a valid `group_by` dimension — silently produced `undefined` as the SQL `GROUP BY` column (`resolveGroupColumn()`'s switch had no `default` case), which DuckDB rejected, surfacing to MCP callers as an opaque `"backend query failed: 400"` with the real cause lost. Every other query family (`mode`-based) already validated its values before dispatch; `group_by` was the one exception.

Fix: `BOTTLENECK_GROUP_BY_VALUES` exported from `src/query/bottlenecks.ts` as the single source of truth; `dispatchQuery` in `src/server-factory.ts` validates `group_by` against it before dispatching, throwing a clear error naming the invalid value and listing the valid ones.

## Artifacts Produced

- `plan/current/change-summary.md`
- Updated: `src/server-factory.ts`, `src/query/bottlenecks.ts`, `tests/regression/query-routing.test.ts`, `component.yml`, `product.yml`, `package.json`, `src/structured-telemetry-mcp/docs/quirks.md`

## Decisions

None requiring a new ADR — no interface/contract change; `group_by`'s valid values were already documented in `README.md`, this only tightens server-side validation to match documented behaviour.

## Validation

326/326 Vitest tests (2 new regression tests), typecheck clean, build succeeds. Live-verified against the running macOS daemon after `npm run deploy`: `{"group_by": "event_type"}` now returns a clear `Invalid group_by` error instead of an opaque 400; `{"group_by": "phase"}` continues to work correctly.

## Skipped Phases

None. (Full P1/P2/P5 artifact sets don't apply to Change Pipeline runs — see `0000011`'s changelog for the routing rationale, unchanged here.)
