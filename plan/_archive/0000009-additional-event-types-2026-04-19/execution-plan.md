# Execution Plan — 0000009-ship-phase-enum

**Route:** Change Pipeline
**Date:** 2026-04-18
**Feature ID:** 0000009-ship-phase-enum

---

## Delivery Tracks

### Track 1 — Phase enum extension (REQ-021)

| Step | File | Change |
|------|------|--------|
| 1 | `schemas/telemetry-event.schema.json` | Add `"ship"` to `phase` enum |
| 2 | `src/types/events.ts` | Add `'ship'` to `Phase` union type |

### Track 2 — New event types: schema (REQ-022–028)

All changes are additive. For each new event type:
1. Add value to `event` enum in `schemas/telemetry-event.schema.json`
2. Add `$defs` entry for its data shape
3. Add `$ref` to `data.oneOf`

| Req | Event type | Data fields (required) | Optional |
|-----|-----------|------------------------|---------|
| REQ-022 | `context_reset` | `phase_name`, `reason` | — |
| REQ-023 | `approval_requested` | `phase_name`, `subject`, `action_id` | — |
| REQ-024 | `fast_path_engaged` | `change_type`, `reason` | — |
| REQ-025 | `test_failure` | `test_name`, `phase_name`, `attempt_number` | `error_summary` |
| REQ-026 | `performance_regression` | `metric`, `threshold`, `actual`, `phase_name` | — |
| REQ-027 | `dependency_blocked` | `phase_name`, `dependency`, `reason` | — |
| REQ-028 | `schema_migration_applied` | `component_id`, `migration_path`, `destructive` | — |

### Track 3 — New event types: TypeScript + cross-field validation (REQ-022–028)

| Step | File | Change |
|------|------|--------|
| 3 | `src/types/events.ts` | Add 7 new interfaces; add all to `EventData` union |
| 4 | `src/validation/validate-event.ts` | Add 7 entries to `EVENT_REQUIRED_DATA_FIELDS` |

### Track 4 — Test coverage (see `plan/current/test-plan.md` for full spec)

| Step | File | Change |
|------|------|--------|
| 5 | `tests/unit/validation.test.ts` | `phase: "ship"` accepted; `phase: "change"` regression; valid + invalid payload for each of REQ-022–028 |
| 6 | `tests/unit/server-factory.test.ts` | Add ≥1 new event type through `createEmitEventHandler` end-to-end (validateEvent → mock repo.write) — confirms handler pipeline accepts new types, not just the validator in isolation |
| 7 | `tests/integration/emit-event.test.ts` | Add ≥1 new event type through real `DuckDbEventRepository.write` — confirms new types store correctly via the integration path |

### Track 5 — Docs

| Step | File | Change |
|------|------|--------|
| 8 | `src/structured-telemetry-mcp/component.yml` | Version bump `0.2.0` → `0.3.0`; update `feature` to `0000009-ship-phase-enum`; update "14 event types" references → 22; add new event types to `scope.inScope`; update `responsibilities`; update `metadata.updatedAt`; update `quality.testCoverage` counts |
| 9 | `docs/0009--feature--ship-phase-enum.md` | New feature doc: what changed, why, event type reference table with all 22 types, data payload shapes for the 8 new additions |

### Track 6 — Build & deploy

| Step | Action |
|------|--------|
| 10 | `build.ps1` — rebuild bundles |
| 11 | `deploy.ps1` — global install + service restart |
| 12 | Smoke-test: POST `phase_start` with `phase: "ship"` → `ok: true`; POST `context_reset` → `ok: true` |

---

## NFRs

- No latency impact (AJV enum and `oneOf` additions are O(1) at validation time)
- Fully backward compatible — all existing stored events and queries unaffected
- `schema_version` remains `"1.0"` — additive changes do not increment schema version

---

## Risks

| ID | Risk | Mitigation |
|----|------|------------|
| R-001 | Deploy order violation (ship-agent merges before this deploys) | Deploy immediately after merge; notify framework team |

---

## Done Definition

- [ ] `phase` enum includes `"ship"` in schema and TS type
- [ ] All 7 new event types in schema (`event` enum + `$defs` + `oneOf`)
- [ ] All 7 new TS interfaces in `src/types/events.ts`; added to `EventData` union
- [ ] All 7 new entries in `EVENT_REQUIRED_DATA_FIELDS` in `validate-event.ts`
- [ ] Unit tests pass — validation.test.ts (all new types valid/invalid + phase enum)
- [ ] Unit tests pass — server-factory.test.ts (≥1 new type through handler pipeline)
- [ ] Integration tests pass — emit-event.test.ts (≥1 new type through DuckDB write)
- [ ] `component.yml` at `0.3.0` with correct event type counts and updated scope
- [ ] `docs/0009--feature--ship-phase-enum.md` written
- [ ] Build succeeds (`npm run build`)
- [ ] Deployed and smoke-tested against live daemon
- [ ] Framework team notified: deploy complete, ship-agent PR may be raised
