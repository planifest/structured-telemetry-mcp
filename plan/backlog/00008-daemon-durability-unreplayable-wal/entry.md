---
title: "Backlog Entry: 00008 - Daemon durability: no checkpoint or graceful shutdown produces an unreplayable WAL"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "critical"
---
# Backlog Entry: 00008 - Daemon durability: no checkpoint or graceful shutdown produces an unreplayable WAL

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

**This defect destroyed a live database on 2026-08-03 and has no recovery path.** It is the
highest-severity item in this backlog.

Three independent gaps combine into permanent data unavailability:

1. **No graceful shutdown.** There is no `checkpoint`, `close()`, `SIGTERM`, or `SIGINT` handling
   anywhere in `src/`. The DuckDB connection is never closed cleanly, so the database file is never
   checkpointed on exit.
2. **Function-valued column defaults.** `src/db/schema.ts:7,21` declare
   `id VARCHAR NOT NULL DEFAULT gen_random_uuid()` and `inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()`.
3. **Startup migrations issue ALTERs.** `MIGRATE_ADD_MODEL_CONFIG` and `MIGRATE_ADD_PRODUCT_ID`
   (`src/db/schema.ts:27,32`) run `ALTER TABLE events ADD COLUMN IF NOT EXISTS ...` on every start.

DuckDB serialises that ALTER into the WAL **together with the table's function defaults**. On replay,
`ReplayAlter -> AddColumn -> BindDefaultValues -> BindAndQualifyFunction` tries to resolve
`gen_random_uuid()` / `now()` before a default database is attached, and raises:

```
INTERNAL Error: Failure while replaying WAL file ".../telemetry.db.wal":
Calling DatabaseManager::GetDefaultDatabase with no default database set
```

Because (1) means the WAL is never checkpointed away, that poison ALTER stays in the WAL **forever**.
Every subsequent start must replay it and dies. `uncaughtException` -> `process.exit(1)`
(`src/server-http.ts:47-54`) -> launchd `KeepAlive` -> crash loop.

### Observed impact

The production database at `~/.planifest/telemetry.db` was last checkpointed **2026-06-14 23:59** and
contained **1 row**; approximately **4,100 events** spanning Jun 14 -> Aug 3 existed only in a 2.4 MB
WAL that no DuckDB build can replay. The Jun-14 checkpoint is missing the `product_id` column, which
confirms `MIGRATE_ADD_PRODUCT_ID` wrote the poison entry when 0000015 shipped.

**The database had been un-restartable since the day `product_id` shipped.** It kept serving only
because the process never restarted. Any reboot, OOM, crash, or deploy would have triggered this
identically.

Aggravating factor: the product has **no backup mechanism at all** — no dump, snapshot, or
`EXPORT DATABASE` anywhere in `src/` or `scripts/`. There was no restore point.

Preserved artefacts (not deleted): `~/.planifest/preserved-2026-08-03-unreplayable-wal/` (with a README
describing the failure and merge path) and a checksum-verified second copy at
`~/.planifest/backup-2026-08-03-0210/`.

## Suggested Action

Treat as several related fixes; the first two are the minimum viable repair.

1. **Graceful shutdown.** Handle `SIGTERM`/`SIGINT`: stop accepting connections, `CHECKPOINT`, close
   the DuckDB connection, then exit 0.
2. **Periodic checkpoint.** Checkpoint on an interval and/or WAL-size threshold so an unclean kill can
   never strand more than a bounded window of events.
3. **Make migrations WAL-safe.** Guard `ADD COLUMN` behind an `information_schema` check so it is a
   true no-op when the column exists (rather than relying on `IF NOT EXISTS`, which still executes),
   and consider moving `gen_random_uuid()` / `now()` defaults into the insert path so no
   function-valued default is ever serialised into a WAL ALTER entry.
4. **Do not exit on recoverable errors.** `uncaughtException -> process.exit(1)` converts a
   recoverable condition into a crash loop. Distinguish startup failure from runtime error, and fail
   loudly without a restart storm.
5. **Backups.** Tracked separately as [[00024-scheduled-database-backups]] — do not drop it if this
   entry's scope narrows. The checkpoint work in item 1 is a prerequisite for it.
6. **Startup self-check.** On WAL-replay failure, emit a clear operator message naming the WAL file and
   the recovery procedure, instead of a raw DuckDB assertion and an exit.

Consider also a `doctor` check that warns when WAL size or time-since-checkpoint exceeds a threshold.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. This is a correctness and
data-durability defect in a component that already shipped, so it needs its own P0 rather than being
folded into a feature wave. Recommend it is picked up **first**, ahead of every other entry filed in
this batch.

## Related

Recovery of the ~4,100 stranded events is tracked separately — see
[[00023-recover-stranded-wal-events]].

The absence of any backup mechanism — which is why this incident had no restore point — is tracked as
[[00024-scheduled-database-backups]].
