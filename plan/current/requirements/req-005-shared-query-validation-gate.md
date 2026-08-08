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
  - `limit`: integer, `>= 1`, clamped to the existing `MAX_LIMIT`; a non-integer or negative value is rejected, not rounded or clamped silently
  - `offset`: newly declared — integer, `>= 0`, with an explicit ceiling
  - `loop_threshold`: integer, `>= 1`
  - `trend.limit` (days): integer, `>= 1`
- Rejection is explicit rather than comparison-derived. `NaN > MAX_LIMIT` evaluating to `false` is how the current cap at `event-log.ts:40` is bypassed; the gate must reject on a positive type/range test, never on a failed comparison.
- Loosening `QueryShape` for the MCP path is not acceptable. If tightening it breaks an existing MCP caller, report it — do not widen the schema to accommodate.
- The gate returns a structured `{ok:false, errors:[{field, message}]}` naming the offending field, per req-006. It never surfaces a DuckDB message.

## Acceptance Criteria

- [ ] `POST /query {"mode":"event_log","limit":"abc"}` returns a structured field-level error naming `limit`, and no DuckDB text appears in the body
- [ ] `limit: -5` is rejected naming `limit`
- [ ] `limit: 1.5` is rejected naming `limit` — it is not silently rounded
- [ ] `offset: 1e21` is rejected naming `offset`
- [ ] `offset: -1` is rejected naming `offset`
- [ ] `loop_threshold: 0` and `trend.limit: 0` are each rejected naming their field
- [ ] Each of the six cases above behaves **identically over the MCP path and the HTTP path** — the same input yields the same rejection on both
- [ ] `limit` above `MAX_LIMIT` is clamped, matching current documented behaviour, rather than rejected
- [ ] The log viewer's own `/query` payloads all still succeed (design R-004)
- [ ] A valid query returns an unchanged successful response shape

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
