---
title: "Requirement: req-005 - One shared query validation gate"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-005 - One shared query validation gate

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000019-loopback-daemon-hardening
**Source:** US-002
**Priority:** must-have

## User Story

As a developer, I want the HTTP path to reuse the MCP path's `QueryShape` gate, so that the log viewer's path is no less strict than the MCP one.

## Current defect

`src/server-http.ts:226-227` parses arbitrary JSON and calls `dispatchQuery(qs, q)` directly. The MCP path applies `QueryShape.safeParse` first (`src/server-factory.ts:180`). The HTTP path — which is what the log viewer uses — bypasses it entirely.

## Reuse alone is not sufficient — read this before implementing

Backlog 00010's suggested action was "reuse the existing `QueryShape` zod schema on the HTTP path." Applying `QueryShape` unchanged closes only **one** of the four reproduced defects. `QueryShape` (`src/server-factory.ts:61-69`) is:

```ts
z.object({ ..., limit: z.number().optional(), loop_threshold: z.number().optional() }).passthrough()
```

| Reproduced input | Closed by reusing QueryShape as-is? |
|---|---|
| `limit: "abc"` | Yes — a string fails `z.number()` |
| `limit: -5` | **No** — a valid number |
| `limit: 1.5` | **No** — a valid number |
| `offset: 1e21` | **No** — `offset` is not declared at all, and `.passthrough()` lets any type through |

Note the last row's consequence: because `offset` is undeclared, the offset defect is present on the **MCP path as well**, not only over HTTP. This requirement fixes both.

## Functional Requirements

- The HTTP `/query` path validates through the same shared gate as the MCP path before `dispatchQuery` is reached. One gate, one definition, two callers — not two schemas kept in step by hand.
- The shared gate is tightened beyond the current `QueryShape`:
  - `limit`: integer, `>= 1`. A non-integer, negative, or non-numeric value is **rejected**, never rounded.
  - `offset`: newly declared — integer, `>= 0`, with an explicit ceiling
  - `loop_threshold`: integer, `>= 1`
  - `limit` when `mode: trend` — see the note below

### The ceiling is per-mode, and over-ceiling is a rejection

Two facts about the existing code constrain how the gate handles the upper bound. Both were verified against the tree at P1, and getting either wrong breaks a passing test or a documented contract.

**Over-ceiling rejects; it does not clamp.** `src/query/event-log.ts:40-41` throws `event_log limit must not exceed 1000 (received N)`. `tests/integration/query-telemetry.test.ts:299` asserts `.rejects.toThrow('must not exceed 1000')`. `docs/usage-guide.md:667` documents *"Capped at 1000 — a higher value is rejected with an error"*. The gate must preserve rejection. Clamping would break that test and contradict the published contract.

**`MAX_LIMIT` is not one number.** It is two module-local constants, neither exported: `event-log.ts:19` is 1000, `distinct-values.ts:20` is 20. A single global ceiling in the shared gate would let `{"mode":"distinct_values","limit":500}` through, to be silently reduced to 20 downstream. The gate must therefore either resolve the ceiling per mode, or validate only type and lower bound and leave the upper bound to the owning module. Either is acceptable; a single global ceiling is not.

**`trend.limit` does not exist.** `src/query/token-efficiency.ts:25` reads `queryTrend(db, query.limit ?? 30, initiativeId)` — it is the **top-level `limit`**, reinterpreted as a day count. There is no nested `trend` object. The gate must not apply a row ceiling to it: 1000 rows and 1000 days are different quantities. Constrain it as a positive integer with its own documented ceiling.
- Rejection is explicit rather than comparison-derived. `NaN > MAX_LIMIT` evaluating to `false` is how the current cap at `event-log.ts:40` is bypassed; the gate must reject on a positive type/range test, never on a failed comparison.
- Loosening `QueryShape` for the MCP path is not acceptable. If tightening it breaks an existing MCP caller, report it — do not widen the schema to accommodate.
- The gate returns a structured `{ok:false, errors:[{field, message}]}` naming the offending field, per req-006. It never surfaces a DuckDB message.

## Test corpus

**Rejected, each naming its field:** `limit: "abc"`, `limit: -5`, `limit: 1.5`, `limit: 0`, `limit: 1001` on `event_log`, `limit: 21` on `distinct_values`, `offset: -1`, `offset: 1e21`, `offset: 1.5`, `loop_threshold: 0`, `loop_threshold: -1`, and `limit: 0` with `mode: trend`.
**Accepted:** `limit: 1000` on `event_log`, `limit: 20` on `distinct_values`, `limit: 30` with `mode: trend`, `offset: 0`, omitted values falling back to their existing defaults.

## Acceptance Criteria

- [ ] Every rejected-corpus value returns a structured field-level error naming the offending field, with no DuckDB text in the body; every accepted-corpus value succeeds with an unchanged response shape
- [ ] The whole corpus behaves **identically over the HTTP and MCP paths** — same input, same outcome on both. This is the requirement's central property: today the two paths disagree
- [ ] The existing rejection contract is preserved — `event_log` with `limit: 1001` still throws `must not exceed 1000`, keeping `tests/integration/query-telemetry.test.ts:299` green — and the log viewer's own `/query` payloads all still succeed (design R-004)

## Dependencies

- req-006 governs the error body shape produced on rejection.
- ADR-016 is the precedent for limit/offset bounding; extend it, do not replace it.
- Design R-004: tightening may break callers relying on loose coercion. `src/ui/index-html.ts` is the main in-repo caller and must be audited at P3.

## Input Validation

- [ ] Input source: JSON request body of `POST /query`, and the `query` tool argument on the MCP path
- [ ] Allowed character pattern: not applicable to the numeric fields; identifier-valued fields (`sortField`, `distinct_values.field`) remain governed by the ADR-024 allow-list and are covered by req-009
- [ ] Maximum length: numeric bounds as listed above; `MAX_LIMIT` unchanged from its current value
- [ ] Failure behaviour: reject the whole request with `400` and a field-named error; never coerce, round, or partially apply a query
- [ ] Logging policy: the offending field name is returned to the caller; the offending value is written to stderr only
