---
title: "RCA and Fix Spec: emit_event envelope rejection (R-009)"
summary: "Root-caused and reproduced from planifest-framework's 0000016 run. Two independent, stacked gaps in this repo block telemetry on every run. Candidate scope for inclusion in this repo's next Feature Brief."
status: "candidate — not yet confirmed into a design"
---
# RCA and Fix Spec: `emit_event` Envelope Rejection (R-009)

> Filed by an investigation session in `planifest-framework` (sibling repo), read-only against this repo's source. Not yet part of any confirmed design here — surfacing as a candidate for the next P0 brief. See `plan/current/feature-brief.md` in this same directory for other in-progress brief material; this document is separate scope, not a continuation of it.

**Origin:** `planifest-framework` backlog entry `plan/backlog/0000005-telemetry-schema-blocks-emit-event/entry.md`, investigated during that repo's feature `0000017-ratchet-forgery-detection-and-telemetry-schema-spec`.
**Investigation performed:** read-only against this repo's live source at the time of writing; no changes committed here as part of that investigation. Scratch reproduction scripts were written and deleted from this working tree — nothing left behind.

---

## 1. Corrected Diagnosis

The originating backlog entry's premise — "the fix is already spec'd in `docs/0008c`, just needs implementing" — is **wrong**. `docs/0008c` was fully shipped in this repo on **19 Apr 2026** (commit `9028b63`, "Feat/additional event types (#3)"): all five schema additions (`phase_skip`, `security_finding`, `retry_limit_exceeded`, `adr_decision`, `doc_gap`), all three query bugs, and all three query features it lists are already live. `docs/0008c` is stale as a diagnosis; do not re-implement anything it lists.

The actual `R-009` failure (`emit_event` rejecting `phase_start`/`phase_end`/`security_finding` with `"(root): must be object"` on all 3 attempts during `planifest-framework`'s 0000016 run, 11 Jul 2026) has **two independent, stacked root causes**, both confirmed below. Both must be fixed together — fixing only one leaves telemetry broken for a subset of the framework's real call patterns.

---

## 2. Root Cause A — Tool argument has no structural schema (primary; explains the exact recorded error)

**Location:** `src/server-factory.ts`, tool registration for `emit_event`:

```ts
server.tool(
  'emit_event',
  'Ingest a structured telemetry event into the Planifest telemetry store.',
  { event: z.unknown().describe('The telemetry event envelope. Must conform to schemas/telemetry-event.schema.json.') },
  createEmitEventHandler(repo),
);
```

`z.unknown()` accepts any JSON value with no structural constraint. This directly determines what the MCP protocol exposes to the calling model as the tool's argument schema.

**Reproduction — what the model actually sees:**

Ran `zodToJsonSchema(z.object({ event: z.unknown() }))` (the same conversion the `@modelcontextprotocol/sdk` v1.26 pipeline uses to build the tool definition shown to the model):

```json
{ "$schema": "http://json-schema.org/draft-07/schema#" }
```

No `type`, no `properties`, no object shape — nothing. The model is told only, via free-text description, that the value "must conform to schemas/telemetry-event.schema.json" — a file it has no access to at call time. Under that ambiguity a tool-calling model has no structural scaffold to fill in and is free to (and evidently did) pass something that isn't a JS object.

**Reproduction — what happens server-side when it doesn't:**

Ran the real `validateEvent()` from `src/validation/validate-event.ts` (via `npx tsx`, in-repo, no modifications) against six candidate payload shapes:

| Case | Payload | Result |
|---|---|---|
| A — correct envelope object | `{ schema_version: "1.0", event: "phase_start", ... }` | `{"isValid":true,"errors":[]}` |
| B — envelope JSON-stringified | `JSON.stringify(envelope)` | `{"isValid":false,"errors":["(root): must be object"]}` |
| C — `undefined` | `undefined` | `{"isValid":false,"errors":["(root): must be object"]}` |
| D — double-wrapped `{event: envelope}` | nested under an extra key | `{"isValid":false,"errors":["(root): must have required property 'schema_version'", ...]}` (different error — ruled out as the recorded cause) |
| E — `null` | `null` | `{"isValid":false,"errors":["(root): must be object"]}` |
| F — array-wrapped | `[envelope]` | `{"isValid":false,"errors":["(root): must be object"]}` |

Cases B, C, E, F all reproduce **byte-for-byte** the error recorded three times in `planifest-framework`'s `plan/_archive/0000016-.../build-log.md` and `build-report.md`: `"(root): must be object"`. This is ajv's generic message for failing the schema's root `"type": "object"` check — it fires identically whether the value is a string, `undefined`, `null`, or an array, which is consistent with the failure being systematic (3/3 attempts, across 3 different event types) rather than a one-off malformed call.

Case D (an agent nesting the envelope under a second `event` key, confused by the tool param and the envelope's own `event` field sharing a name) produces a **different**, more specific error and is **ruled out** as the recorded cause. Worth fixing regardless (see §4) but it is not what happened in the 0000016 run.

**Conclusion:** The tool schema gives calling models zero type information, so the model most likely serialized the envelope to a string (a common LLM tool-call failure mode against unconstrained "blob" parameters) or otherwise failed to produce a bare object. This is a **tool-interface design defect**, not a missing schema definition.

---

## 3. Root Cause B — Four event types the framework actually emits are missing from this repo's deployed schema (still live, unlike 0008c)

Cross-referencing every `## Telemetry` section across all `planifest-framework/skills/*/SKILL.md` files plus `planifest-framework/standards/telemetry-standards.md` against this repo's deployed `schemas/telemetry-event.schema.json` `event` enum:

**Deployed enum (21 types, confirmed by reading the live schema file):**
`phase_start, phase_end, spec_gap, validation_failure, deviation, migration_proposal, context_pressure, mcp_impact, self_correction, phase_skip, security_finding, retry_limit_exceeded, adr_decision, doc_gap, context_reset, approval_requested, fast_path_engaged, test_failure, performance_regression, dependency_blocked, schema_migration_applied`

**Framework-emitted types not in that enum:**

| Event | Emitted by | Data shape (from `telemetry-standards.md` / `planifest-loop-runner/SKILL.md`) |
|---|---|---|
| `loop_iteration` | `planifest-loop-runner`, after every RECORD step | `{ "loop_id": "<p0_completeness \| design_critic \| reversal_protocol \| verify_by_execution \| cross_model_review>", "iteration": <n>, "cap": <n>, "decision": "continue \| done \| escalate", "toggle_level": "report-only \| on" }` |
| `phase_reversal_petitioned` | loop-runner, when a defect report is filed | `{ "report": "<seq>-<slug>", "filing_phase": "<P3–P6>", "binding_artifact": "<path>" }` |
| `phase_reversal_granted` | loop-runner, on assessor verdict | `{ "report": "<seq>-<slug>", "classification": "additive \| altering", "cascade_size": <n>, "budget_remaining": <n> }` |
| `phase_reversal_denied` | loop-runner, on assessor verdict | same shape as `phase_reversal_granted` |

These are real, currently-live gaps introduced by `planifest-framework` feature `0000016-pipeline-governance-and-loop-engineering` (11 Jul 2026) — they postdate this repo's last schema update (19 Apr 2026) and were never ported over. **Even after Root Cause A is fixed, every loop-runner and phase-reversal emission will still fail** (enum mismatch → ajv rejects with `"/event: must be equal to one of the allowed values"`), silently defeating NFR-004 (cost visibility for loop iterations/reversals) — the exact capability feature 0000016 needed telemetry for.

Every other framework-emitted event type was checked against this repo's field-level requirements (`EVENT_REQUIRED_DATA_FIELDS` in `src/validation/validate-event.ts`) by comparing to each skill's documented `data` payload — all 14 pre-existing types match field-for-field. No other gaps found there.

**Not currently emitted anywhere in the framework, so out of scope for this fix (do not implement speculatively):** `ratchet_blocked` — recommended in `planifest-framework`'s `plan/_archive/0000016-.../recommendations.md` (REC-006, low priority) but no skill emits it today. Leave for a future item once/if a skill actually starts emitting it — adding unused schema surface is speculative scope.

---

## 4. Required Implementation

### 4.1 Fix Root Cause A — give the tool argument a real object schema

Replace the `z.unknown()` argument with a Zod object mirroring `schemas/telemetry-event.schema.json`'s top-level shape, so the MCP tool definition exposed to calling models declares `type: object` with real `properties` — turning "guess the shape of an opaque blob" into "fill in a structured form":

```ts
const EmitEventEnvelope = z.object({
  schema_version: z.literal('1.0'),
  event: z.enum([/* full enum, generated from schemas/telemetry-event.schema.json — see 4.3 */]),
  session_id: z.string().min(1),
  initiative_id: z.string().optional(),
  phase: z.enum(['orchestrator', 'spec', 'adr', 'codegen', 'validate', 'security', 'docs', 'change', 'ship']),
  agent: z.string().min(1),
  tool: z.string().min(1),
  model: z.string().min(1),
  mcp_mode: z.enum(['none', 'workspace', 'context', 'workspace+context']),
  timestamp: z.string(),
  model_config: z.record(z.string(), z.unknown()).optional(),
  data: z.record(z.string(), z.unknown()),
}).strict();

server.tool(
  'emit_event',
  'Ingest a structured telemetry event into the Planifest telemetry store. Pass the full event envelope as the `event` argument — it must be a JSON object (not a string) with the fields shown in this tool\'s schema.',
  { event: EmitEventEnvelope },
  createEmitEventHandler(repo),
);
```

Two things this buys, both necessary:
- **The model gets a real schema** — MCP-aware clients render `properties`/`required`/`enum` for tool arguments, so the model is guided to construct an object, not guess.
- **Zod itself now rejects a wrong shape before `validateEvent()`/ajv ever runs**, giving a clearer error (`"Expected object, received string"` etc.) if a client still gets it wrong, rather than the opaque root-level ajv message. Keep `validateEvent()`/ajv as the source of truth for cross-field rules (§4.3) — Zod here is an argument-shape gate, not a replacement for the existing schema validation.

Do **not** silently `JSON.parse()` a string argument as a "helpful" fallback. That masks the actual client-side bug (a model that serializes instead of passing an object) instead of fixing the root cause, and it would let case D-style double-wrapping or other malformed shapes slip through unnoticed. Fail loudly and let the improved tool schema prevent the mistake at the source.

### 4.2 Fix Root Cause A, secondary — resolve the parameter/field name collision

Independent of the schema-type fix: the tool argument and the envelope's own discriminator field are both named `event`, which is confusing even with a proper object schema (`emit_event({ event: { event: "phase_start", ... } })` reads oddly). Recommend renaming the tool argument to `envelope` (`{ envelope: EmitEventEnvelope }`), updating `createEmitEventHandler`'s destructuring accordingly, and updating the README's `emit_event` usage example. This is a naming clarity improvement, not required to fix R-009, but do it in the same pass since it's touching this exact code and case D shows the collision is a real confusion risk worth closing off even though it wasn't this run's cause.

### 4.3 Fix Root Cause B — add the four missing event types

In `schemas/telemetry-event.schema.json`:
1. Add `loop_iteration`, `phase_reversal_petitioned`, `phase_reversal_granted`, `phase_reversal_denied` to the `event` enum.
2. Add four `$defs` entries (`LoopIterationData`, `PhaseReversalPetitionedData`, `PhaseReversalGrantedData`, `PhaseReversalDeniedData`) matching the field shapes in §3 exactly — `phase_reversal_granted` and `phase_reversal_denied` share an identical shape; either reuse one `$def` for both or keep them separate for future divergence (either is fine — pick whichever this repo's existing pattern favors).
3. Add each to the top-level `data.anyOf` array (this schema uses `anyOf` per the April 2026 commit message — "`oneOf -> anyOf` (`context_reset`/`phase_skip` structural conflict)" — follow that existing precedent, don't reintroduce `oneOf`).
4. Add all four to `EVENT_REQUIRED_DATA_FIELDS` in `src/validation/validate-event.ts`:
   ```ts
   loop_iteration:              ['loop_id', 'iteration', 'cap', 'decision', 'toggle_level'],
   phase_reversal_petitioned:   ['report', 'filing_phase', 'binding_artifact'],
   phase_reversal_granted:      ['report', 'classification', 'cascade_size', 'budget_remaining'],
   phase_reversal_denied:       ['report', 'classification', 'cascade_size', 'budget_remaining'],
   ```
5. Update the `EmitEventEnvelope` Zod `event` enum from §4.1 to include these four — the two fixes must land together or the Zod gate will itself reject valid loop/reversal events with the new schema in place.

This is an **additive-only** schema change (new enum values, new `$defs`) — no migration file required, consistent with the "Schema Migration Policy" section already in `docs/0008c` (`§6`, still valid guidance even though the rest of that doc is stale).

---

## 5. Testing Requirements

This repo already has a `tests/regression/` convention (`cross-field-validation.test.ts`, `enum-validation.test.ts`, `event-types.test.ts`, `emit-handler.test.ts`) plus `tests/unit/` and `tests/integration/`. Follow it exactly — do not invent a new test layout.

**Required, not optional — "well tested" means every one of these, not a representative sample:**

1. **`tests/unit/server-factory.test.ts`** — add a case asserting `zodToJsonSchema` (or equivalent introspection of the registered tool) on the new `emit_event` argument schema produces a real `type: "object"` with `properties` including every envelope field. This is the regression guard for Root Cause A specifically — it must fail loudly if someone reverts to `z.unknown()`.
2. **`tests/regression/emit-handler.test.ts`** — add the exact negative cases reproduced in §2 (stringified envelope, `undefined`, `null`, array-wrapped, double-wrapped) as explicit test cases with their expected error shape. These are the tests that would have caught R-009 before it shipped.
3. **`tests/regression/enum-validation.test.ts`** and **`tests/regression/event-types.test.ts`** — add the four new event types alongside every existing type, following the same per-type pattern already used for the 19 April and 0000009 additions (accept valid, reject missing required fields, reject unknown extra fields per `additionalProperties: false`).
4. **`tests/regression/cross-field-validation.test.ts`** — add missing-required-field rejection cases for all four new types, matching the existing per-type pattern.
5. **Full framework coverage matrix** — add one integration test (`tests/integration/emit-event.test.ts`) that iterates every event type in §3's table plus the existing 21 (25 total) and asserts a minimally-valid envelope for each is accepted end-to-end through the real MCP tool handler (not just the schema validator in isolation) — this is what actually proves telemetry works for every valid case, rather than proving the schema and the handler separately.
6. **Do not regress:** run the full existing suite (`tests/unit`, `tests/integration`, `tests/regression`, `tests/performance.test.ts`) and confirm the count only grows — the April 2026 commit reported "289 tests passing"; get and record the new total.

---

## 6. Documentation Requirements

`README.md`'s `## Event Payloads` section (`§141` onward) currently documents only 9 of the 21 already-deployed event types — it stops at `self_correction` and was never updated for the 12 types added since (`phase_skip` through `schema_migration_applied`, plus the four new ones from this fix). This predates R-009 but is worth fixing in the same pass:

1. **`README.md`** — add all missing `#### <event_name>` entries under `## Event Payloads` so all 25 event types (21 existing + 4 new) are documented with their full envelope + data example, matching the existing entries' format exactly.
2. **`README.md`** — update the `### emit_event` tool section (`§63`) to reflect the new `event`/`envelope` argument name and show a complete, correctly-shaped example call (the exact thing that was ambiguous before).
3. **`docs/usage-guide.md`** — add a short "Common mistakes" or "Troubleshooting" note documenting the `(root): must be object` failure mode this spec found, so a future agent hitting a similar error can self-diagnose against real guidance instead of re-deriving this RCA from scratch.
4. **Pipeline/changelog** — this repo runs its own Planifest pipeline (see `docs/0008a`, `docs/0008c`, `docs/0009--feature--ship-phase-enum.md`). Run this fix as its own feature through that pipeline rather than as an ad hoc patch — it changes a public tool contract and a deployed schema, both of which warrant an ADR (the tool-argument redesign in §4.1/§4.2 is a real architectural decision with alternatives worth recording, same as this repo's own ADR-004-equivalent pattern) and a version bump. Current version is `0.3.0`; this is additive-but-contract-changing (tool argument shape changes for callers, even though wire-compatible callers who already send correct objects are unaffected) — recommend `0.4.0` (minor), confirm during this repo's own P0.

---

## 7. Definition of Done

Do not consider this closed until all of the following hold — this is the bar for telemetry working on every run for every valid case:

- [ ] `emit_event`'s tool argument schema exposes `type: object` with full `properties` to calling models (verified by the test in §5.1, not just by reading the source)
- [ ] All six reproduction cases from §2 have corresponding regression tests, and cases B/C/E/F now produce a clear, actionable error (not just correctly reject — the error should be self-diagnosable)
- [ ] All 25 event types (21 existing + 4 from §3) round-trip successfully through the real MCP handler in an integration test
- [ ] `EVENT_REQUIRED_DATA_FIELDS`, the schema `$defs`, and the schema `event` enum are in sync for all 25 types (no drift between the three)
- [ ] Full existing test suite still passes; new total test count recorded
- [ ] `README.md` documents all 25 event types under `## Event Payloads`
- [ ] `docs/usage-guide.md` has a troubleshooting note for this failure mode
- [ ] An ADR exists for the tool-argument schema redesign decision
- [ ] Version bumped and shipped through this repo's own Planifest pipeline
- [ ] Back in `planifest-framework`: once deployed, re-run a pipeline phase there with the `emit_event` tool available and confirm `phase_start`/`phase_end`/`loop_iteration` events actually land (close the loop on R-009 for real, not just by inspection) — file as a follow-up verification step at the next P0 in that repo
