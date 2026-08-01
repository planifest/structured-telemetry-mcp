---
title: "ADR 017: product_id Field — Additive, No Historical Backfill"
summary: "product_id is added as an optional envelope field and nullable DB column; existing rows are never backfilled and permanently display as unknown."
status: "accepted"
version: "0.1.0"
---
# ADR-017 - product_id Field — Additive, No Historical Backfill

**Skill:** [adr-agent](../skills/planifest-adr-agent/SKILL.md)
**Feature:** 0000015-telemetry-log-viewer-ui
**Component:** structured-telemetry-mcp
**Date:** 2026-08-01

## Context

The telemetry backend is a single shared store (`$HOME/.planifest/telemetry.db`) used by every project that registers this MCP server. Today, nothing on the event envelope identifies which repo/project emitted a given event. The new log-viewer UI needs to distinguish events across projects, which requires a new field.

Two design questions had to be resolved: (1) what value should this field hold, and (2) what happens to the rows that already exist without it. On (2), the human confirmed that other projects besides this repo have historically emitted to this same shared backend — so there is no reliable signal (not even "assume it's all this repo") to reconstruct which repo produced a pre-existing row.

## Decision

Add `product_id` as an **optional** field on the `TelemetryEvent` envelope (`schemas/telemetry-event.schema.json`), following the same additive pattern already used for `initiative_id`. Value: the emitting repo's root path, derived via `git rev-parse --show-toplevel`, falling back to the raw `cwd` already threaded through every emission hook (e.g. `emit-phase-start.mjs`) if the working directory is not inside a git repo.

Add a matching nullable `product_id VARCHAR` column to the `events` table via a written migration proposal (`src/structured-telemetry-mcp/docs/migrations/proposed-add-product-id.md`), requiring human approval before application per the framework's schema-change hard limit. This is purely additive — no existing column changes type, nullability, or constraint.

**No backfill is performed, ever, on existing rows.** Every row written before this migration — and any row written after it by an emitter that hasn't yet been updated to populate the field (see ADR-019) — has `product_id = NULL`, which the query layer and UI treat as a stable, permanent "unknown" value, not an error or a gap to be filled later.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Backfill all existing NULL rows with this repo's path | Every row would have a non-null value; simpler UI (no "unknown" case) | Factually wrong for any historical row that came from a different project — confirmed by the human that other projects have used this backend | Rejected — would silently mislabel data with false provenance, worse than leaving it unknown |
| Make `product_id` required going forward (reject events without it) | Forces every emitter to be updated before events are accepted | Breaks every currently-deployed emission hook immediately (this component doesn't control when `planifest-framework`'s hooks get updated — see ADR-019); would silently drop or reject valid telemetry from every project not yet updated | Rejected — this component doesn't own the emitters and can't force a synchronized rollout |
| Derive `product_id` from `session_id` or some other existing field via heuristic | No schema change needed | No existing field encodes repo identity even implicitly; would be guesswork dressed up as data | Rejected — no such signal exists |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | `schemas/telemetry-event.schema.json` (new optional property), `events` table (new nullable column, migration proposal + approval required), `src/query/event-log.ts` (new filter, expanded SELECT), `src/structured-telemetry-mcp/docs/data-contract.md` (updated once migration is applied) |

## Consequences

**Positive:**
- Fully backward-compatible: no existing event, caller, or stored row is invalidated
- Honest data model — "unknown" accurately represents genuine provenance gaps rather than a fabricated guess

**Negative:**
- Every event emitted between now and whenever `planifest-framework`'s hooks are updated (ADR-019) still shows "unknown," not just historical data — the gap is open-ended, not a one-time migration cost
- The UI must design an explicit "unknown" state for this field rather than assuming every row has a value

**Risks:**
- `product_id` values are absolute filesystem paths, which can reveal local usernames/directory structure (risk-register.md R-005) — accepted given the no-auth, 127.0.0.1-only posture; would need re-evaluation if that posture ever changes

## Related ADRs

- ADR-019 - depends-on (this field is only useful once ADR-019's cross-product emission work lands; not blocked on it, but its value is limited until then)

## Supersedes

- None

## Superseded By

- None
