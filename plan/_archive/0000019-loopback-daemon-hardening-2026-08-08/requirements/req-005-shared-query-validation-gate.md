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

### The ceiling is per-mode, over-ceiling always rejects — and one mode's behaviour is deliberately changing

Three facts about the existing code constrain how the gate handles the upper bound. All three were verified against the tree at P1.

**`MAX_LIMIT` is not one number, and the modes disagree on what happens above it — today.** Three module-local constants, none exported: `event-log.ts:19` (1000) and `event-log.ts:40-41` **throws** above it — asserted by `tests/integration/query-telemetry.test.ts:299` and documented at `docs/usage-guide.md:667` ("a higher value is rejected with an error"). `distinct-values.ts:20` (20) but `distinct-values.ts:39` — `Math.min(Math.max(1, Number(query.limit ?? DEFAULT_LIMIT)), MAX_LIMIT)` — **clamps silently**; `{"mode":"distinct_values","limit":500}` succeeds today and returns 20 rows. `failures.ts` and `token-efficiency.ts` have no ceiling at all yet (that gap is req-007's).

**This requirement makes rejection the uniform rule, changing `distinct_values`'s current behaviour.** Every mode gets an explicit ceiling and exceeding it is a `400`, never a silent clamp:

| Mode | Ceiling | Current behaviour above it | Behaviour after this requirement |
|---|---|---|---|
| `event_log` | 1000 | Rejects (`event-log.ts:40-41`) | Unchanged |
| `distinct_values` | 20 | **Clamps** (`distinct-values.ts:39`) | **Changed to reject** |
| `failure_sequence`, `drill_down` | 1000 (req-007's default) | No ceiling exists | New: rejects above 1000 |

A single global ceiling is explicitly rejected as an approach: it would let `{"mode":"distinct_values","limit":500}` through at the gate only to be silently reduced downstream, which is the exact defect this table is closing, just moved one layer up.

**This is a real, disclosed behaviour change, not an implementation detail.** `{"mode":"distinct_values","limit":500}` succeeds today; after this requirement it is a `400`. No caller in this codebase sends `limit` above 20 on `distinct_values` — the log-viewer's suggestion comboboxes never request more — but this is stated here because `execution-plan.md` NFR-012 and this requirement's own Input Validation section both describe "no successful-shape change" language that is true of every other case and must not be read as covering this one.

**`trend`'s `limit` does not exist as a separate field — it is the top-level `limit`, reinterpreted.** `src/query/token-efficiency.ts:25` reads `queryTrend(db, query.limit ?? 30, initiativeId)`. There is no nested `trend` object anywhere in this codebase — any artifact naming `trend.limit` as a distinct field is wrong. When `mode: trend`, `limit` is a **day count**, not a row count, and none of the per-mode row ceilings above apply to it. It gets its own ceiling, documented as a day count: default 30, ceiling 365 (a year of trend data is already a generous query).
- Rejection is explicit rather than comparison-derived. `NaN > MAX_LIMIT` evaluating to `false` is how the current cap at `event-log.ts:40` is bypassed; the gate must reject on a positive type/range test, never on a failed comparison.
- Loosening `QueryShape` for the MCP path is not acceptable. If tightening it breaks an existing MCP caller, report it — do not widen the schema to accommodate.
- The gate returns a structured `{ok:false, errors:[{field, message}]}` naming the offending field, per req-006. It never surfaces a DuckDB message.

## Test corpus

**Rejected, each naming its field:** `limit: "abc"`, `limit: -5`, `limit: 1.5`, `limit: 0`, `limit: 1001` on `event_log`, **`limit: 21` on `distinct_values` (the behaviour-change case — must reject, not clamp to 20)**, `limit: 1001` on `failure_sequence`, `limit: 1001` on `drill_down`, `limit: 366` with `mode: trend`, `offset: -1`, `offset: 1e21`, `offset: 1.5`, `loop_threshold: 0`, `loop_threshold: -1`, and `limit: 0` with `mode: trend`.
**Accepted:** `limit: 1000` on `event_log`, `limit: 20` on `distinct_values`, `limit: 1000` on `failure_sequence` and `drill_down`, `limit: 365` and `limit: 30` (the default) with `mode: trend`, `offset: 0`, omitted values falling back to their existing defaults.

## Acceptance Criteria

- [ ] Every rejected-corpus value returns a structured field-level error naming the offending field, with no DuckDB text in the body; every accepted-corpus value succeeds with an unchanged response shape
- [ ] The whole corpus behaves **identically over the HTTP and MCP paths** — same input, same outcome on both. This is the requirement's central property: today the two paths disagree
- [ ] Per-mode ceilings hold exactly as tabled above: `event_log`'s existing rejection contract is preserved (`limit: 1001` still throws `must not exceed 1000`, keeping `tests/integration/query-telemetry.test.ts:299` green), `distinct_values`'s clamp is replaced by rejection, and `failure_sequence`/`drill_down` gain a ceiling where none existed — with the log viewer's own `/query` payloads still succeeding throughout (design R-004)

## Dependencies

- req-006 governs the error body shape produced on rejection.
- ADR-016 is the precedent for limit/offset bounding; extend it, do not replace it.
- Design R-004: tightening may break callers relying on loose coercion. `src/ui/index-html.ts` is the main in-repo caller and must be audited at P3.

## Input Validation

- [ ] Input source: JSON request body of `POST /query`, and the `query` tool argument on the MCP path
- [ ] Allowed character pattern: not applicable to the numeric fields; identifier-valued fields (`sortField`, `distinct_values.field`) remain governed by the ADR-024 allow-list and are covered by req-009
- [ ] Maximum length: numeric bounds per the per-mode ceiling table above. `event_log`'s ceiling is unchanged from its current value; `distinct_values`'s ceiling value is unchanged but its enforcement changes from clamp to reject; `failure_sequence`/`drill_down` gain a ceiling for the first time (req-007); `trend`'s `limit` gets its own day-count ceiling, independent of the row ceilings
- [ ] Failure behaviour: reject the whole request with `400` and a field-named error; never coerce, round, or partially apply a query
- [ ] Logging policy: the offending field name is returned to the caller; the offending value is written to stderr only
