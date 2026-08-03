---
title: "Backlog Entry: 00023 - Recover ~4,100 telemetry events stranded in an unreplayable WAL"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "medium"
---
# Backlog Entry: 00023 - Recover ~4,100 telemetry events stranded in an unreplayable WAL

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

Approximately **4,100 telemetry events spanning 2026-06-14 to 2026-08-03** exist only inside a
2.4 MB DuckDB WAL that DuckDB 1.5.1 cannot replay. The daemon was restarted onto a fresh database on
2026-08-03 so service could resume; the old files were **moved aside, not deleted**.

Cause is [[00008-daemon-durability-unreplayable-wal]] — that entry covers preventing recurrence. This
entry covers only recovering the already-stranded data.

Approximate contents, from a string scan of the WAL: 4,057 `context_pressure`, 21 `phase_start`,
18 `phase_end`.

### Where the data is

| Path | Contents |
|---|---|
| `~/.planifest/preserved-2026-08-03-unreplayable-wal/` | `telemetry.db` (Jun-14 checkpoint, 1 row) + `telemetry.db.wal` (the stranded events) + a README describing the failure |
| `~/.planifest/backup-2026-08-03-0210/` | Byte-identical second copy, checksum-verified |

Both copies are intact. There is no other backup: the product has no backup mechanism, Time Machine is
not configured on this machine, and there are no APFS local snapshots.

### What is known about feasibility

- The event data **is present as readable strings** in the WAL — VARCHAR column vectors survive as
  plain text. It is not encrypted or compressed away.
- Opening the pair fails deterministically, reproduced on copies, so this is a property of the data and
  not of the environment.
- Read-only mode does not help: DuckDB attempts WAL replay before honouring `access_mode`.

## Suggested Action

Attempt in ascending order of effort; stop at the first that works.

1. **Try a newer or older DuckDB build.** The failure is an internal assertion in `ReplayAlter`; a
   different version may replay it. Cheapest possible test — always on a **copy**.
2. **Truncate the WAL before the poison ALTER entry.** If the offending entry can be located, replaying
   only the prefix may recover events written before it. Partial, but cheap.
3. **Write a scavenger.** Parse the WAL binary for row records and emit NDJSON, then re-insert via
   `POST /emit` or a direct insert. The format is undocumented, so expect partial recovery and validate
   aggressively — reject anything that does not satisfy the event schema rather than importing
   plausible-looking garbage into the telemetry record.

**Merging is straightforward once extracted:**

- `events.id` is `VARCHAR DEFAULT gen_random_uuid()` — a **UUID, not a sequence**. There is no ID range
  to reserve and collisions are not a practical concern.
- Ordering comes from `timestamp TIMESTAMPTZ`, not from `id`. Recovered rows carry their original
  timestamps and sort into place regardless of insertion order.
- So the merge is a plain `INSERT` into the live `events` table, with no ID coordination and no
  downtime.

Guard rails: work only on copies; never place the old `.wal` next to a live `telemetry.db` (the daemon
will crash-loop again); do not delete the preserved files until recovered events are verified.

## Why Deferred

Service was restored immediately on a fresh database, so this is not blocking. Recovery is exploratory
work against an undocumented binary format with an uncertain success rate, and the data is historical
`context_pressure` telemetry rather than anything operationally required — worth attempting, not worth
blocking on. Fix [[00008-daemon-durability-unreplayable-wal]] first so the problem cannot recur while
this sits in the backlog.
