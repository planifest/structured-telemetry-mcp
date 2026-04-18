# Roadmap Item: Structured Telemetry MCP — Changes and Fixes (0008c)

## Source
Live exploration of the deployed 0008a MCP server — April 2026
Derived from: plan/current/mcp-exploration.md and direct source review of `C:/d/planifest/structured-telemetry-mcp/`

## Observation

0008a is complete and deployed. During exploration for 0008b wiring, several gaps, bugs, and undocumented behaviours were found in the server. This document covers all required changes: schema additions for new event types, query service bugs, missing query capabilities, and documentation gaps.

---

## 1. Schema Additions — New Event Types

The following event types are needed by framework skills but are absent from `schemas/telemetry-event.schema.json`. All require:
- Adding the event name to the `event` enum
- Adding a `$defs` data shape
- Adding the new `$ref` to the `data.oneOf` array

### 1.1 `phase_skip`

Emitted by `planifest-orchestrator` when a pipeline phase is determined to be unnecessary and bypassed.

```json
{
  "event": "phase_skip",
  "data": {
    "phase_name": "<phase that was skipped>",
    "reason": "<why the phase was skipped>"
  }
}
```

**Schema definition:**
```json
"PhaseSkipData": {
  "type": "object",
  "required": ["phase_name", "reason"],
  "additionalProperties": false,
  "properties": {
    "phase_name": { "type": "string", "minLength": 1 },
    "reason":     { "type": "string", "minLength": 1 }
  }
}
```

---

### 1.2 `security_finding`

Emitted by `planifest-security-agent` when a vulnerability or risk is identified. Currently these are forced into `deviation` which is semantically wrong — a security finding is not a design deviation.

```json
{
  "event": "security_finding",
  "data": {
    "component_id": "<component>",
    "title": "<short description>",
    "severity": "low" | "medium" | "high" | "critical",
    "cwe": "<CWE-NNN — optional>"
  }
}
```

**Schema definition:**
```json
"SecurityFindingData": {
  "type": "object",
  "required": ["component_id", "title", "severity"],
  "additionalProperties": false,
  "properties": {
    "component_id": { "type": "string", "minLength": 1 },
    "title":        { "type": "string", "minLength": 1 },
    "severity":     { "type": "string", "enum": ["low", "medium", "high", "critical"] },
    "cwe":          { "type": "string" }
  }
}
```

Note: `severity` gains a `"critical"` value not present on `deviation`. This is intentional — security findings warrant a stronger signal.

---

### 1.3 `retry_limit_exceeded`

Emitted by `planifest-validate-agent` (and potentially others) when the agent hits the 5-attempt escalation ceiling. Distinct from `self_correction` which fires on each retry — this fires once at the point of giving up and is the primary signal for systemic failures vs. transient ones.

```json
{
  "event": "retry_limit_exceeded",
  "data": {
    "phase_name": "<phase>",
    "action_id": "<the action that could not be resolved>",
    "attempt_count": 5
  }
}
```

**Schema definition:**
```json
"RetryLimitExceededData": {
  "type": "object",
  "required": ["phase_name", "action_id", "attempt_count"],
  "additionalProperties": false,
  "properties": {
    "phase_name":    { "type": "string", "minLength": 1 },
    "action_id":     { "type": "string", "minLength": 1 },
    "attempt_count": { "type": "integer", "minimum": 1 }
  }
}
```

---

### 1.4 `adr_decision`

Emitted by `planifest-adr-agent` after an ADR is written. Captures the decision in the telemetry store so architectural choices can be queried without reading ADR files. Currently `planifest-adr-agent` only has `phase_start`/`phase_end` — this fills the gap.

```json
{
  "event": "adr_decision",
  "data": {
    "adr_id": "ADR-001",
    "title": "<decision title>",
    "chosen_option": "<the option that was selected>"
  }
}
```

**Schema definition:**
```json
"AdrDecisionData": {
  "type": "object",
  "required": ["adr_id", "title", "chosen_option"],
  "additionalProperties": false,
  "properties": {
    "adr_id":         { "type": "string", "minLength": 1 },
    "title":          { "type": "string", "minLength": 1 },
    "chosen_option":  { "type": "string", "minLength": 1 }
  }
}
```

---

### 1.5 `doc_gap`

Emitted by `planifest-docs-agent` when documentation is missing or incomplete for a component. Distinct from `deviation` which implies divergence from a confirmed design — a doc gap is an absence, not a divergence.

```json
{
  "event": "doc_gap",
  "data": {
    "component_id": "<component>",
    "description": "<what is missing>"
  }
}
```

**Schema definition:**
```json
"DocGapData": {
  "type": "object",
  "required": ["component_id", "description"],
  "additionalProperties": false,
  "properties": {
    "component_id": { "type": "string", "minLength": 1 },
    "description":  { "type": "string", "minLength": 1 }
  }
}
```

---

## 2. Bugs in `query_telemetry`

### BUG-001 — `group_by: "mcp_mode"` returns HTTP 400

**Location:** `src/query/bottlenecks.ts` — `BottleneckGroupBy` type and `resolveGroupColumn()`

**Root cause:** `BottleneckGroupBy` is typed as `'phase' | 'agent' | 'tool' | 'run_id' | 'content_type'`. The `dispatchQuery` function in `server-factory.ts` routes any `group_by` string to `qs.bottlenecks()`, which passes it to `resolveGroupColumn()`. That function is an exhaustive switch — an unrecognised value falls through TypeScript's exhaustive check and returns `undefined`, producing invalid SQL that the backend rejects with 400.

**Impact:** `mcp_mode` is a first-class column in the `events` table and a critical analysis dimension. Being unable to group bottleneck data by `mcp_mode` is a significant gap — it prevents the primary use case of comparing phase durations across MCP configurations.

**Fix:**
1. Add `'mcp_mode'` to `BottleneckGroupBy`
2. Add `case 'mcp_mode': return 'mcp_mode';` to `resolveGroupColumn()`

```typescript
// bottlenecks.ts
export type BottleneckGroupBy = 'phase' | 'agent' | 'tool' | 'run_id' | 'content_type' | 'mcp_mode';

function resolveGroupColumn(groupBy: BottleneckGroupBy): string {
  switch (groupBy) {
    case 'phase':        return 'phase';
    case 'agent':        return 'agent';
    case 'tool':         return 'tool';
    case 'run_id':       return 'session_id';
    case 'content_type': return "COALESCE(data->>'content_type', 'unknown')";
    case 'mcp_mode':     return 'mcp_mode';   // ← add this
  }
}
```

---

### BUG-002 — `failure_sequence` silently returns empty results when `session_id` is omitted

**Location:** `src/query/failures.ts` — `queryFailures()` dispatch

**Root cause:**
```typescript
case 'failure_sequence': return queryFailureSequence(db, query.session_id ?? '');
```
When `session_id` is not provided, it falls back to `''`. The SQL `WHERE session_id = ''` returns zero rows — no error, no indication that the query was malformed. The caller receives an empty table with no feedback.

**Impact:** Silent data loss. An agent calling `{ mode: "failure_sequence" }` without a `session_id` will believe there are no events for the session, when in fact the query was never properly scoped.

**Fix:** Validate `session_id` presence and return an error if missing:

```typescript
case 'failure_sequence':
  if (!query.session_id) throw new Error('failure_sequence requires session_id');
  return queryFailureSequence(db, query.session_id);
```

---

### BUG-003 — `failure_sequence` `drill_down` require `session_id` but have no validation twin

**Location:** `src/query/token-efficiency.ts` — `queryDrillDown()`

**Root cause:** `queryDrillDown` follows the same pattern as `queryFailureSequence` — it calls with `query.session_id ?? ''`. The README documents `session_id` as required for `drill_down`, but the code silently uses `''` if omitted, returning empty results.

**Fix:** Same pattern as BUG-002:
```typescript
case 'drill_down':
  if (!query.session_id) throw new Error('drill_down requires session_id');
  return queryDrillDown(db, query.session_id);
```

---

## 3. Missing Query Capabilities (Feature Requests)

### 3.1 No raw event log query

There is no way to retrieve all event types for a session or initiative. `failure_sequence` is the closest — it returns a filtered timeline (`phase_start`, `validation_failure`, `self_correction`, `phase_end` only) for a single session. There is no mode that returns the complete event stream.

**Proposed addition:** `mode: "event_log"` as a new token-efficiency mode or fourth query family:

```json
{ "mode": "event_log", "session_id": "<uuid>", "limit": 50 }
{ "mode": "event_log", "initiative_id": "0000002-...", "limit": 100 }
```

Returns all events ordered by timestamp with full `data` payload. Useful for post-run audit and debugging.

---

### 3.2 `initiative_id` filter missing from all query types

`initiative_id` is a first-class column in the `events` table and is the natural scope for multi-initiative workspaces, but it is not exposed as a filter in any query family. The README documents only `session_id` and `limit` as bottleneck filters — code and docs are consistent with each other, so this is a missing feature, not a bug.

**Proposed addition:** Add `initiative_id` as an optional filter to all three query families:

`bottlenecks.ts`:
```typescript
export interface BottleneckQuery {
  readonly group_by: BottleneckGroupBy;
  readonly run_id?: string;
  readonly session_id?: string;
  readonly initiative_id?: string;  // ← add
  readonly limit?: number;
}
// in buildWhereClause:
if (query.initiative_id !== undefined) {
  clauses.push('AND initiative_id = $initiative_id');
  params['initiative_id'] = query.initiative_id;
}
```

Apply the same pattern to `failures.ts` and `token-efficiency.ts`.

---

### 3.3 `group_by: "initiative_id"` not supported

`initiative_id` is not in `BottleneckGroupBy`. Useful for comparing phase performance across multiple concurrent initiatives.

**Proposed addition:** Add `'initiative_id'` to `BottleneckGroupBy` and `resolveGroupColumn()` alongside the `mcp_mode` fix.

---

## 4. Gaps in 0008b (MCP repo documentation is complete)

Cross-comparison confirmed that `mcp_impact`, `model_config`, and the full query reference are all documented in the MCP repo README and `data-contract.md`. The gaps are in the 0008b framework integration doc only — the MCP repo needs no changes for these items.

### 4.1 `mcp_impact` event missing from 0008b

`mcp_impact` is documented in the MCP README under both Event Payloads and Query Reference. It is absent from the 0008b framework doc and from the skill telemetry sections.

**Action for 0008b:** Add `mcp_impact` to `planifest-orchestrator`'s Telemetry section. *(Already done in `plan/current/design.md`.)*

---

### 4.2 `model_config` envelope field missing from 0008b

`model_config` is documented in the MCP README under "Event Types" and has an applied migration record (`docs/migrations/applied-add-model-config.md`). It is absent from the 0008b event envelope table and from `plan/current/design.md`.

```json
{
  "schema_version": "1.0",
  "event": "phase_start",
  "model_config": { "effort": "high" },
  "data": { "phase_name": "codegen" }
}
```

**Action for 0008b:** Add `model_config` row to the event envelope table in `plan/current/design.md` and `docs/0008b`.

---

### 4.3 `query_telemetry` API missing from 0008b

The MCP README has a complete Query Reference covering all 14 modes across three query families. The 0008b framework doc covers only `emit_event` — agents have no framework-level reference for querying telemetry.

**Action for 0008b:** Add a Query Reference section to `docs/0008b` pointing to the MCP README, and note which query modes are most relevant for framework agents (e.g. `failure_sequence` for post-run diagnostics, `mcp_impact` for MCP effectiveness).

---

## 5. Summary of Required Changes

### Changes to 0008a (MCP repo)

| ID | Type | File | Change |
|---|---|---|---|
| SCH-001 | Schema addition | `schemas/telemetry-event.schema.json` | Add `phase_skip` event + `PhaseSkipData` |
| SCH-002 | Schema addition | `schemas/telemetry-event.schema.json` | Add `security_finding` event + `SecurityFindingData` |
| SCH-003 | Schema addition | `schemas/telemetry-event.schema.json` | Add `retry_limit_exceeded` event + `RetryLimitExceededData` |
| SCH-004 | Schema addition | `schemas/telemetry-event.schema.json` | Add `adr_decision` event + `AdrDecisionData` |
| SCH-005 | Schema addition | `schemas/telemetry-event.schema.json` | Add `doc_gap` event + `DocGapData` |
| BUG-001 | Bug fix | `src/query/bottlenecks.ts` | Add `mcp_mode` to `BottleneckGroupBy` and `resolveGroupColumn()` |
| BUG-002 | Bug fix | `src/query/failures.ts` | Validate `session_id` presence for `failure_sequence`; throw on missing |
| BUG-003 | Bug fix | `src/query/token-efficiency.ts` | Validate `session_id` presence for `drill_down`; throw on missing |
| FEA-001 | New feature | `src/query/` | Add `mode: "event_log"` raw event query |
| FEA-002 | New feature | `src/query/bottlenecks.ts` | Add `group_by: "mcp_mode"` and `group_by: "initiative_id"` to `BottleneckGroupBy` |
| FEA-003 | New feature | `src/query/bottlenecks.ts`, `failures.ts`, `token-efficiency.ts` | Add `initiative_id` filter to all query types |

### Changes to 0008b (framework doc + plan)

| ID | Type | Location | Change |
|---|---|---|---|
| 0008b-001 | Doc gap | `docs/0008b`, `plan/current/design.md` | Add `mcp_impact` to orchestrator Telemetry section *(plan already updated)* |
| 0008b-002 | Doc gap | `docs/0008b`, `plan/current/design.md` | Add `model_config` to event envelope table |
| 0008b-003 | Doc gap | `docs/0008b` | Add Query Reference section pointing to MCP README |

---

## 6. Schema Migration Policy

All schema additions (SCH-001 through SCH-005) are **additive** — new values in the `event` enum and new `$defs` entries. Existing stored events are unaffected. No migration required. The data contract migration policy in `src/structured-telemetry-mcp/docs/data-contract.md` permits additive changes without a migration file.

New event types require a `db/schema.ts` audit: the current `events` table stores `data` as a JSON column — no structural DB change needed. New event types are stored as-is.

---

## Dependencies

- **0008b** — framework skill telemetry sections reference the new event types. 0008c schema changes must be deployed before 0008b implementation begins for the new event types.
- **0008a** — changes are to the already-deployed server. A patch release (`0.1.1` → `0.2.0`) is required; clients must restart to pick up the new schema.
