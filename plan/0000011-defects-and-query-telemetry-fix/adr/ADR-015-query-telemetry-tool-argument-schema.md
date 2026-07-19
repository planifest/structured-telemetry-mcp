---
title: "ADR 015: query_telemetry Tool-Argument Schema"
summary: "Replace query_telemetry's z.unknown() tool argument with QueryShape, a permissive .passthrough() Zod object schema — the same R-009-class fix ADR-013 applied to emit_event, scoped more loosely because query shapes genuinely vary and dispatchQuery already validates them."
status: "accepted"
version: "0.1.0"
---
# ADR-015 - query_telemetry Tool-Argument Schema

**Skill:** planifest-change-agent
**Tool:** claude-code
**Model:** claude-sonnet-5
**Feature:** 0000011-defects-and-query-telemetry-fix
**Component:** structured-telemetry-mcp
**Status:** accepted
**Date:** 2026-07-19

---

## Context

After shipping ADR-013's fix for `emit_event`, direct testing this session found `query_telemetry` has the identical root cause: its tool argument was registered as `{ query: z.unknown().describe(...) }`, giving calling models no structural schema. Confirmed broken with two well-formed queries (`{"mode":"event_log",...}` and `{"group_by":"phase"}`) both failing with `dispatchQuery`'s generic `"Unrecognised query shape. Provide group_by or mode."` — the same symptom pattern as R-009, caused by the argument not reliably arriving as a parsed object.

Unlike `emit_event`, `query_telemetry`'s argument space is not one fixed envelope shape — it's four different query families (bottleneck/`group_by`, failure/`mode`, token-efficiency/`mode`, event_log/`mode`) with overlapping optional fields, and `dispatchQuery` (`src/server-factory.ts`, already unit-tested directly with plain object literals in `tests/regression/query-routing.test.ts`) already implements correct, well-tested routing and clear error messages for genuinely invalid shapes (missing `session_id`, unrecognised mode, etc.). The routing logic itself was never the bug.

## Decision

Add `QueryShape` — a Zod object with every known query field (`group_by`, `mode`, `session_id`, `initiative_id`, `event_type`, `limit`, `loop_threshold`) declared as optional, using `.passthrough()` rather than `.strict()`. Register `query_telemetry`'s tool argument as `{ query: QueryShape }`, replacing `z.unknown()`.

Deliberately **not** mirroring `EmitEventEnvelope`'s approach field-for-field:
- **No `.strict()`** — `.passthrough()` instead, so an unrecognised extra key never causes an argument-shape rejection; `dispatchQuery`'s own `"Unrecognised query shape"` error remains the signal for a genuinely invalid query, not a Zod error for an unexpected field.
- **No `z.enum()` for `group_by`/`mode`** — plain `z.string()`. Enumerating exact values here would create a second place (alongside `dispatchQuery`'s own `.includes()` checks) that must stay in sync, with no corresponding benefit: `dispatchQuery` already produces a clear, specific error for an unrecognised mode/group_by value, so duplicating that list in the Zod layer adds drift risk without adding clarity.

The `createQueryTelemetryHandler` function itself also gains an internal `QueryShape.safeParse()` gate before calling `dispatchQuery`, mirroring `emit_event`'s handler structure — this makes the fix independently verifiable via direct handler tests (not just via the MCP SDK's own upstream parsing) and gives non-object inputs a specific Zod error instead of `dispatchQuery`'s generic message.

This is **non-breaking**: every previously-valid call shape (a plain object with any of the known or unknown fields) still validates identically. Only the previously-broken non-object cases (string, `null`, array, `undefined`) — which never worked correctly anyway — are now rejected with a clearer error instead of silently reaching `dispatchQuery`'s generic fallback.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Mirror `EmitEventEnvelope` exactly: `.strict()` + `z.enum()` for `group_by`/`mode` (chosen approach's opposite) | Maximum structural guidance to calling models; single source of truth for valid values | Two places to keep the mode/group_by enum lists in sync (Zod schema + `dispatchQuery`'s `.includes()` checks) — drift risk on every future query family addition; `.strict()` would reject forward-compatible extra fields a future query family might add before this schema catches up | Query shapes are genuinely more varied and evolve independently of a fixed envelope; the duplication cost outweighs the guidance benefit given `dispatchQuery` already gives clear errors |
| `.passthrough()` object with all fields as `z.string()`/`z.number()` but no internal handler-level `safeParse` (rely on MCP SDK's own upstream parsing only) | Less code, matches "the SDK already does this" reasoning | Existing tests call the handler function directly (bypassing the SDK's Zod layer) — R-009-class regressions wouldn't be caught by direct handler tests, only by full MCP-protocol integration tests | Handler-level gate keeps the fix testable the same way `emit_event`'s fix is (`tests/unit/server-factory.test.ts` calls handlers directly) |
| Leave `z.unknown()`, rely entirely on `dispatchQuery`'s existing error handling | Zero code change | Doesn't fix the actual bug — the argument still arrives unparsed/serialized in the failure case; `dispatchQuery`'s error handling only helps once it *receives* a real object, which is exactly what wasn't happening | Doesn't address the confirmed root cause |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | `src/server-factory.ts`'s `query_telemetry` registration and `createQueryTelemetryHandler` gain the `QueryShape` gate; `dispatchQuery` itself is unchanged |

## Consequences

**Positive:**
- Calling models get a real object schema for `query_telemetry`, closing the same class of gap ADR-013 closed for `emit_event`.
- Non-breaking — no argument rename, no caller needs to change anything.
- `dispatchQuery`'s existing, well-tested routing and error messages remain the single source of truth for query semantics — no duplicated validation logic to drift.

**Negative:**
- The permissive `.passthrough()` + `z.string()` design means a caller sending `group_by: "not_a_real_dimension"` still passes the Zod gate and only fails later, inside `dispatchQuery` (as it already did before this fix) — this ADR does not tighten *semantic* validation, only *structural* validation (is it an object at all).

**Risks:**
- If `dispatchQuery` is ever refactored to accept a genuinely different top-level shape (e.g. a new query family with a required field not in `QueryShape`'s known list), `.passthrough()` means the Zod gate won't catch a caller omitting it — `dispatchQuery`'s own error handling remains the safety net, consistent with the division of responsibility this ADR establishes.

## Related ADRs

- ADR-013 (emit-event-tool-argument-schema) - extends. Same root-cause pattern (R-009-class: `z.unknown()` tool argument), deliberately looser structural constraint given `query_telemetry`'s more varied shape space and `dispatchQuery`'s existing semantic validation.
- ADR-005 (schema-validation-json-schema) - related-to, unaffected. `query_telemetry` has no JSON Schema/ajv layer (it was never part of the telemetry event envelope contract) — this ADR only concerns the MCP tool-argument gate.

---

## Supersedes

- none

## Superseded By

- none

---

*Generated by change-agent. Path: `plan/current/adr/ADR-015-query-telemetry-tool-argument-schema.md`*
