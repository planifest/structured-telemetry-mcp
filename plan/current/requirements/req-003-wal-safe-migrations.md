---
title: "Requirement: req-003 - WAL-Safe Schema Migrations"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-003 - WAL-Safe Schema Migrations

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Source:** US-002
**Priority:** must-have

## User Story

As an operator of the telemetry daemon, I want the database to survive an unclean shutdown, so that a crash, reboot, or deploy never strands or destroys collected events.

## Functional Requirements

- **Finding, confirmed against source (not assumed):** `src/db/schema.ts`'s two existing migration statements — `MIGRATE_ADD_MODEL_CONFIG` (line 27-29) and `MIGRATE_ADD_PRODUCT_ID` (line 31-34) — are plain `ALTER TABLE events ADD COLUMN IF NOT EXISTS <col> <type>` statements with **no explicit `DEFAULT` clause**. The 2026-08-03 incident's root cause (an internal assertion in DuckDB's `ReplayAlter`, per `backlog/00023-recover-stranded-wal-events/entry.md`) is therefore not something this codebase's own SQL can avoid by omitting a function-valued default — it is a limitation in how this DuckDB version (`@duckdb/node-api` 1.5.1-r.2) replays *any* `ALTER TABLE ADD COLUMN` entry left pending in the WAL. The actionable fix is to never leave such an entry pending: checkpoint immediately after running any schema migration.
- On daemon startup, after running any pending `ALTER TABLE ADD COLUMN IF NOT EXISTS` migration in `src/db/schema.ts` against an already-existing database, immediately run a `CHECKPOINT` before proceeding to open the HTTP listener. This ensures the ALTER is flushed into the base file and never needs to be replayed from the WAL by a future crash.
- Apply the same immediate-checkpoint rule to any *new* migration statement added by a future feature — document this as a standing rule in the data contract's Migration Policy section (see data-contract.md update), not just a one-off fix for the two existing statements.
- This requirement does not change the SQL text of the two existing migrations — only when a checkpoint runs relative to them.

## Acceptance Criteria

- [ ] Running the daemon against a fresh (pre-migration) database applies both existing migrations and checkpoints immediately afterward, before accepting any HTTP connections
- [ ] After startup migration + checkpoint, an unclean `kill -9` immediately following startup does not require WAL replay of the `ALTER TABLE` entries on the next open
- [ ] A database that already has both columns present (already migrated) skips the `ADD COLUMN IF NOT EXISTS` no-op safely and still starts normally
- [ ] `data-contract.md`'s Migration Policy section documents the "checkpoint immediately after any ALTER" rule for future migrations to follow

## Dependencies

- Runs before req-002's periodic checkpoint timer starts — the startup migration-checkpoint is a one-time, synchronous step at boot, not the same code path as the recurring timer, though both ultimately call the same underlying `CHECKPOINT` primitive.
- Blocks req-004: the refuse-to-start check (an unopenable database) must run *before* migrations are attempted — a poisoned WAL from a pre-existing incident must never reach the migration step, since the migration step assumes the database is already openable.
