---
title: "ADR 013: emit_event Tool-Argument Schema Redesign"
summary: "Replace emit_event's z.unknown() tool argument with a real Zod object schema (EmitEventEnvelope) mirroring the JSON Schema envelope shape, and rename the argument from event to envelope. ajv/JSON Schema remains the source of truth for the data payload; Zod is added only as a tool-argument gate."
status: "accepted"
version: "0.1.0"
---
# ADR-013 - emit_event Tool-Argument Schema Redesign

**Skill:** planifest-adr-agent
**Tool:** claude-code
**Model:** claude-sonnet-5
**Feature:** 0000010-macos-launchd-service
**Component:** structured-telemetry-mcp
**Status:** accepted
**Date:** 2026-07-12

---

## Context

R-009 (root-caused in `plan/current/emit-event-rca-and-fix-spec.md`) found that `emit_event`'s tool argument was registered as `{ event: z.unknown() }` — the `@modelcontextprotocol/sdk` requires *some* Zod shape for tool argument registration (this is an SDK constraint, not an open choice; ADR-005's "Zod is not used" ruled out Zod for the `data` payload's wire-schema validation, not for the mandatory tool-registration argument itself). `z.unknown()` converts to `{ "$schema": "..." }` with no `type`, `properties`, or `enum` — the calling model is given zero structural information and, per the RCA's reproduction, most likely serialized the envelope to a string rather than constructing an object. ajv then rejects it with a generic `"(root): must be object"`, which is correct but undiagnosable.

Separately, the tool argument's name (`event`) collides with the envelope's own `event` discriminator field, which the RCA spec's reproduction case D showed produces real confusion (an agent double-wrapping the envelope under a second `event` key).

A decision was needed on how to give calling models real structural guidance without duplicating or destabilizing the existing JSON-Schema-as-source-of-truth validation established in ADR-005.

---

## Decision

Register `emit_event`'s tool argument as a full Zod object (`EmitEventEnvelope`) that mirrors `schemas/telemetry-event.schema.json`'s top-level envelope shape — `schema_version`, `event` (enum of all 25 types), `session_id`, `initiative_id` (optional), `phase`, `agent`, `tool`, `model`, `mcp_mode`, `timestamp`, `model_config` (optional), `data` (record) — using `.strict()`.

Rename the tool argument from `event` to `envelope`, resolving the name collision with the envelope's own discriminator field.

`validateEvent()`/ajv remains the sole source of truth for cross-field rules on the `data` payload (unchanged from ADR-005) — Zod here is strictly an **argument-shape gate** that runs before ajv, not a replacement for it. This keeps the JSON Schema file as the single shareable, language-agnostic contract (still consumable by `planifest-framework` without a TypeScript dependency), while satisfying the SDK's mandatory Zod requirement for tool registration with a schema that actually informs the calling model.

Explicitly rejected: silently `JSON.parse()`-ing a string argument as a compatibility fallback. This would mask the real client-side bug (a model that serializes instead of passing an object) and let other malformed shapes (case D's double-wrapping) slip through unnoticed. The fix must make the correct shape discoverable and the incorrect shape loudly rejected, not paper over the ambiguity.

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Keep `z.unknown()`, improve only the free-text description | No code/type changes | Description text is not part of the tool's structural schema exposed to the calling model — RCA reproduction shows this doesn't help; error stays opaque | Doesn't address the root cause (no structural scaffold) |
| `JSON.parse()` fallback if the argument is a string | Tolerates the exact failure mode observed in the 0000016 run without requiring the calling model to change | Masks the real bug; lets other malformed shapes (double-wrapping) through; every future malformed call silently degrades instead of failing loudly | Explicitly rejected per RCA spec — hides the defect instead of fixing it |
| Full Zod object mirroring the JSON Schema, `.strict()` (chosen) | Gives calling models real structural guidance; rejects malformed shapes before ajv with a clearer error; keeps JSON Schema as sole wire-validation source of truth | Two schemas (Zod + JSON Schema) must be kept in sync manually — same class of risk ADR-005 already flagged for TS types vs. JSON Schema | Directly fixes the root cause with an acceptable, already-precedented sync-risk (mitigated by req-009's regression test asserting the Zod schema's introspected shape) |
| Replace JSON Schema/ajv entirely with Zod (reopen ADR-005) | Single schema definition, no sync risk | Loses shareability with `planifest-framework` (still true today, per ADR-005's original rationale — no TypeScript dependency exists there) | ADR-005's rationale still holds; not reopened |

---

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | `src/server-factory.ts`'s `emit_event` registration changes shape and argument name; `createEmitEventHandler` destructuring updated to read `envelope`; `README.md`/`docs/usage-guide.md` examples updated |
| planifest-framework (sibling repo, downstream consumer) | Any code calling `emit_event` with the old `{ event: ... }` top-level argument name must update to `{ envelope: ... }` — a coordinated breaking change, reflected in the 0.10.0 version bump |

---

## Consequences

**Positive:**
- Calling models get a real object schema (`type: "object"`, full `properties`) — the structural scaffold that was missing is now present, directly closing the gap the RCA identified.
- Malformed calls fail with a specific, self-diagnosable Zod error instead of ajv's generic root-level message.
- The `event`/`envelope` name collision is resolved, removing a second, independently-confirmed source of confusion (case D).
- ADR-005's JSON-Schema-as-source-of-truth principle is preserved — this is additive at the tool-registration layer, not a reversal.

**Negative:**
- Two schema definitions (Zod `EmitEventEnvelope` and the JSON Schema file) must now be kept in sync for the envelope-level fields (not just the `data` sub-schemas, which were already dual-defined). Mitigated by req-009's regression test (`tests/unit/server-factory.test.ts`) asserting the introspected Zod-derived schema matches expectations.
- This is a breaking change for the tool argument name — any caller using the old `{ event: ... }` shape must update. No known callers exist outside `planifest-framework`, which is updated as a coordinated follow-up (see `plan/current/scope.md` › Out of Scope).

**Risks:**
- If the Zod `event` enum and the JSON Schema `event` enum drift (e.g. a future event type added to one but not the other), the Zod gate could reject a type that ajv would have accepted, or vice versa. Mitigated by req-009's and req-011's requirement that all three enforcement points (Zod enum, JSON Schema enum/`$defs`, `EVENT_REQUIRED_DATA_FIELDS`) land together in one change, verified by an integration test asserting all 25 types round-trip.

---

## Related ADRs

- ADR-005 (schema-validation-json-schema) - related-to, does not supersede. ADR-005's decision (JSON Schema/ajv as the source of truth for the `data` payload, "Zod is not used") stands unchanged. This ADR adds Zod only at the MCP tool-registration layer, which the `@modelcontextprotocol/sdk` already mandates some Zod shape for — it was already in use (as `z.unknown()`), just unstructured.
- ADR-004 (event-storage-schema) - related-to (the `data` column's stored shape is unaffected by this decision).

---

## Supersedes

- none

## Superseded By

- none

---

*Generated by adr-agent. Path: `plan/current/adr/ADR-013-emit-event-tool-argument-schema.md`*
