# Design - 0000013-group-by-validation-fix

## Feature
- Problem: `query_telemetry`'s bottleneck query family (`group_by`) accepts any string without validating it against the real 7-value enum, so an invalid value silently produces `undefined` as the SQL `GROUP BY` column, which DuckDB rejects — surfacing to MCP callers as an opaque `"backend query failed: 400"` with the real cause lost.
- Adoption mode: standard-iterative
- Feature ID: 0000013-group-by-validation-fix

## Product Layer
- User stories:
  - US-001: As an agent or human calling `query_telemetry` with an invalid `group_by` value, I receive a clear error naming the invalid value and listing the valid ones, so that I can correct my call instead of guessing why a 400 occurred.
- Acceptance criteria confirmed: 1 (see change-summary.md for the full acceptance criterion — invalid group_by rejected with a descriptive error, valid group_by values unaffected, regression test added)
- Constraints: no interface/contract change — group_by's 7 valid values were already documented in README.md; this only tightens server-side validation to match documented behaviour
- Integrations: none

## Architecture Layer
- Latency target: deferred - recorded in scope (unaffected by this fix)
- Availability target: deferred - recorded in scope (unaffected by this fix)
- Scalability target: deferred - recorded in scope (unaffected by this fix)
- Security: no change — same MCP tool-argument trust boundary as ADR-013/015
- Data privacy: no regulated data
- Observability: no change
- Cost boundary: not constrained

## Engineering Layer
- Stack: TypeScript / Node / DuckDB — unchanged, no new stack choices
- Components: structured-telemetry-mcp (single component, this is a targeted bug fix within it)
- Data ownership: unchanged
- Deployment: unchanged
- API versioning: not applicable (no contract change)

## Scope
- In: validate `group_by` against the `BottleneckGroupBy` allow-list in `dispatchQuery` before dispatching to `qs.bottlenecks()`; throw a clear, actionable error naming the invalid value and the valid options; regression test
- Out: any change to `mode`-based query families (already validated correctly); any interface/contract change; any change to the HTTP transport error-mapping layer beyond what's needed to surface the new clear error message
- Deferred: none

## Assumptions
- No known caller relies on the current silent-`undefined`-then-400 behaviour for an invalid `group_by` — impact if wrong: a caller depending on the exact opaque error string would see a different (clearer) message instead; considered a non-breaking improvement

## Risks
- Low likelihood, low impact — purely additive validation tightening a previously-undocumented gap; existing valid `group_by` values are unaffected (regression-tested)

## Dependencies
- Upstream: none
- Downstream: none (single-component repo; no other component or documented consumer depends on the current unvalidated behaviour — confirmed via docs/dependency-graph.md)

## Active Skills
None

## Skill Map
| Requirement | Best-fit Skill | Rationale |
|-------------|----------------|-----------|
| Bottleneck group_by validation fix | planifest-change-agent | Targeted change to one existing component, no new component, no schema change |

## Component Paths
- src/server-factory.ts
- src/query/bottlenecks.ts
- tests/

## Repo Instructions
### archiving-policy.md
All pipeline runs archive to `plan/_archive/{feature-id}-{YYYY-MM-DD}/` when they finish — no exceptions for route (Change Pipeline included). See `planifest-overrides/instructions/archiving-policy.md` for the full rule and rationale.

## Confirmation
Human confirmed this design before proceeding: yes — implicit via explicit standing instruction "if so, create a release and fix it all," given after the defect was reported and before this pipeline run was kicked off
Date confirmed: 26 Jul 2026
