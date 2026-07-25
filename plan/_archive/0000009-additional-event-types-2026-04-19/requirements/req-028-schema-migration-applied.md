---
title: "Requirement: REQ-028 - schema_migration_applied event type"
summary: "New event type emitted when a database migration is executed, completing the proposal→applied lifecycle."
status: "active"
version: "0.1.0"
---
# Requirement: REQ-028 — schema_migration_applied event type

**Skill:** change-agent
**Feature:** 0000009-ship-phase-enum
**Priority:** must-have

---

## Context

`migration_proposal` is emitted when an agent writes a migration proposal and stops for human approval. There is no corresponding event for when the migration is actually applied. The lifecycle is incomplete — you can observe that a migration was proposed but not whether or when it was executed. `schema_migration_applied` closes this gap.

Mirrors the `migration_proposal` envelope shape to make the proposal→applied pair queryable as a lifecycle.

---

## Functional Requirements

- The schema accepts `event: "schema_migration_applied"` with a `SchemaMigrationAppliedData` payload.
- `SchemaMigrationAppliedData` requires:
  - `component_id` (string, minLength: 1) — component whose schema was migrated
  - `migration_path` (string, minLength: 1) — path to the migration file that was applied
  - `destructive` (boolean) — whether the migration included destructive operations
- `additionalProperties: false` on `SchemaMigrationAppliedData`.
- TypeScript interface `SchemaMigrationAppliedData` added to `src/types/events.ts`.
- `EVENT_REQUIRED_DATA_FIELDS` maps `schema_migration_applied` → `['component_id', 'migration_path', 'destructive']`.

---

## Acceptance Criteria

- [ ] `POST /emit` with `event: "schema_migration_applied"`, `data: { component_id: "auth-service", migration_path: "src/auth-service/docs/migrations/0003-add-refresh-token.sql", destructive: false }` returns `ok: true`.
- [ ] Missing any required field returns `ok: false`.
- [ ] `destructive: true` accepted (boolean, not string).
- [ ] Unit test covers valid and invalid payloads.
