---
title: "ADR 019: product_id Emission Is a Cross-Product Dependency, Not Built Here"
summary: "Populating product_id at emission time is planifest-framework's responsibility, not structured-telemetry-mcp's; this feature only adds schema/storage/query/UI support and files a backlog dependency."
status: "accepted"
version: "0.1.0"
---
# ADR-019 - product_id Emission Is a Cross-Product Dependency, Not Built Here

**Skill:** [adr-agent](../skills/planifest-adr-agent/SKILL.md)
**Feature:** 0000015-telemetry-log-viewer-ui
**Component:** structured-telemetry-mcp
**Date:** 2026-08-01

## Context

`product_id` (ADR-017) is only useful once something actually populates it at emission time. The code that would do that — `planifest-framework/hooks/telemetry/emit-phase-start.mjs`, `emit-phase-end.mjs`, `context-pressure.mjs`, and the inline `emit_event` calls documented in various `planifest-*` skill files — belongs to `planifest-framework`, a **separate product** from `structured-telemetry-mcp`, with its own independent version and feature-numbering sequence (confirmed explicitly during P0: "It's not shared at all... Framework is just the build tool we use with our agents"). The framework's own hook files are, at the time of this feature, already mid an unrelated, uncommitted change (feature `0000021-framework-context-bloat-audit`, which rewrote the same `telemetry-standards.md` emission-gate logic).

## Decision

`structured-telemetry-mcp` (this feature) implements only its own side of the contract: the schema field, the DB column, the query filter, and the UI's display/filter support (ADR-017). It does **not** modify any file under `planifest-framework/`. The dependency on the framework product updating its emitters is recorded explicitly as a backlog entry (`plan/backlog/00002-framework-product-id-emission/entry.md`) for that product's own pipeline to pick up on its own schedule — this feature's pipeline run does not block on it, and does not implement it as a "quick fix while we're in there."

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Update the framework hooks as part of this feature | End-to-end feature works immediately after this pipeline run, no "unknown" gap for new events | Edits files already dirty with unrelated uncommitted 0000021 changes, risking entanglement between two unrelated in-flight products; blurs component/product ownership boundaries; this component's manifest doesn't own `planifest-framework/` | Rejected explicitly by the human during P0 — confirmed as "external dependency" |
| Block this feature until the framework product updates its emitters | Avoids ever shipping a "product_id exists but is always unknown" intermediate state | Introduces an artificial cross-product blocking dependency with no defined timeline; the framework's own WIP is unrelated in scope and has no committed schedule | Rejected — this feature's value (browsable UI, filtering, pagination) does not depend on product_id being populated; unknown is an acceptable interim state (ADR-017) |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | None beyond ADR-017's schema/query/UI work — no framework files touched |
| planifest-framework (external, not modified by this feature) | Future work item tracked at `plan/backlog/00002-framework-product-id-emission/entry.md`: update its telemetry hooks and inline `emit_event` call sites to populate `product_id` |

## Consequences

**Positive:**
- Clean separation of concerns between the two products sharing this repo; this feature's diff touches only `structured-telemetry-mcp`
- No risk of this feature's changes conflicting with or being silently overwritten by the framework's own in-progress, uncommitted work

**Negative:**
- `product_id` will show "unknown" for every event — historical and newly-emitted alike — until the framework product separately picks up the backlog item; there is no committed timeline for that
- The full value of ADR-017's work is not realized by this feature alone

**Risks:**
- The backlog entry could go unpicked indefinitely, leaving `product_id` permanently unpopulated for new events — this is a known, accepted risk given the explicit cross-product boundary decision, not a defect in this feature

## Related ADRs

- ADR-017 - depends-on (this ADR explains why ADR-017's field will show "unknown" for all current and near-term events)

## Supersedes

- None

## Superseded By

- None
