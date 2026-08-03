---
title: "Backlog Entry: 00024 - No database backup mechanism exists"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "high"
---
# Backlog Entry: 00024 - No database backup mechanism exists

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

**The product has no backup mechanism of any kind.** There is no dump, snapshot, `EXPORT DATABASE`, or
file-copy routine anywhere in `src/` or `scripts/`, and nothing in the launchd/systemd service
definitions performs one.

On 2026-08-03 the telemetry database became unopenable
([[00008-daemon-durability-unreplayable-wal]]). Recovery options were assessed and the finding was
stark:

| Source | Status |
|---|---|
| Backup logic in the product | **None** |
| Time Machine | **Not configured** — no destinations |
| APFS local snapshots | **None** |
| Last consistent checkpoint of the DB file | 2026-06-14, containing **1 row** |

There was **no restore point**. Roughly 4,100 events survived only because the corrupt files were
manually copied aside during the incident. Had anyone deleted the WAL to get the daemon running again —
the obvious and widely-suggested remedy — seven weeks of telemetry would have been permanently gone
with no way back.

This is a distinct concern from [[00008-daemon-durability-unreplayable-wal]]. That entry prevents one
specific corruption mechanism from recurring. This entry is about surviving the next failure of a kind
nobody has predicted: disk failure, an accidental `rm`, a bad migration, a future DuckDB format change.
A single-writer embedded database holding the sole copy of the telemetry record needs a restore path
regardless of how well any individual bug is fixed.

## Suggested Action

1. **Scheduled backup.** Run `EXPORT DATABASE` (or copy a freshly checkpointed DB file) on a schedule,
   into a timestamped directory. `EXPORT DATABASE` is preferable to a raw file copy — it produces a
   format-independent representation that survives DuckDB version changes, which is exactly the class
   of failure that caused this incident.
2. **Checkpoint before backing up**, so the copied artefact is self-contained and never depends on a
   WAL that may not replay. Depends on the checkpoint work in
   [[00008-daemon-durability-unreplayable-wal]].
3. **Retention policy.** Keep N daily and M weekly; prune automatically. Unbounded backups of a growing
   telemetry DB will silently fill the disk, which is its own outage.
4. **Verify restores, not just backups.** An untested backup is a hypothesis. Add a check that restores
   the newest backup into a scratch location, opens it, and asserts an expected row count. A backup
   that cannot be restored is worse than none, because it stops people worrying.
5. **Surface staleness.** Have `doctor` report the age of the most recent verified backup and warn past
   a threshold — the failure mode here is silent, so it needs an active signal.
6. **Document the restore procedure** in the usage guide, including how to point the daemon at a
   restored file. During this incident the recovery path had to be derived from first principles under
   time pressure.

Consider making the backup location configurable and defaulting it outside `~/.planifest/`, so a
mistaken wipe of that directory does not take the backups with it.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. Filed separately from
[[00008-daemon-durability-unreplayable-wal]] deliberately: 00008 fixes the mechanism that failed, while
this is the safety net for the ones that have not failed yet. It is small and directly answers the
incident, so it is a strong candidate to fold into 0000018 alongside 00008 rather than waiting — the
checkpoint work it depends on is already in that wave.
