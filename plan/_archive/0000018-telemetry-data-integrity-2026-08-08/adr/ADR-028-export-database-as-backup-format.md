---
title: "ADR 028: EXPORT DATABASE as the Backup Format"
summary: "Backups use DuckDB's native EXPORT DATABASE (Parquet + schema.sql) rather than a raw file copy of telemetry.db, because a raw copy is tied to the exact on-disk WAL/storage format of the DuckDB version that wrote it — precisely the fragility class that caused the 2026-08-03 incident."
status: "accepted"
version: "0.1.0"
---
# ADR-028 - EXPORT DATABASE as the Backup Format

**Skill:** [adr-agent](../skills/adr-agent-SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Component:** structured-telemetry-mcp
**Date:** 2026-08-08

## Context

req-006 needs a backup artifact format for `telemetry.db`. Two options exist: copy the raw database file (and its WAL) byte-for-byte, or use DuckDB's built-in `EXPORT DATABASE` statement, which writes each table's data as Parquet files plus a `schema.sql` DDL script, independent of DuckDB's internal on-disk storage format.

The 2026-08-03 incident was caused by an `ALTER TABLE ADD COLUMN` entry that a specific DuckDB version (`@duckdb/node-api` 1.5.1-r.2) could not replay from its own WAL — a failure entirely internal to that version's on-disk WAL format. A raw file copy backup would have preserved the exact same unreplayable file; restoring it would have reproduced the identical failure. `EXPORT DATABASE`'s Parquet+SQL representation is documented by DuckDB as its supported mechanism for moving data across database versions, and does not depend on WAL replay at all on restore (`IMPORT DATABASE` re-creates the schema from `schema.sql` and bulk-loads Parquet — no WAL involved).

design.md carried this as assumption A-002 ("to be confirmed at P2"); risk-register.md logged it as R-008 (medium likelihood / high impact if wrong).

## Decision

Backups are taken via `EXPORT DATABASE '<path>' (FORMAT PARQUET)`, not a raw copy of `telemetry.db`/`telemetry.db.wal`. Restore uses `IMPORT DATABASE '<path>'` against a fresh DuckDB instance (the scratch-restore step in req-006's verify→promote→prune sequence, and the documented operator restore procedure in req-004's startup message).

This decision cannot be fully verified without running it (empirical confirmation happens naturally at P3/P4: req-006's own acceptance criteria already require every backup to complete a scratch-restore verification, so a version-format problem in `EXPORT`/`IMPORT DATABASE` itself would surface as a verification failure on the very first backup, not silently). If P3/P4 verification reveals `EXPORT DATABASE` has its own unexpected failure mode, that is grounds for a governed reversal of this ADR, not a silent workaround.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Raw file copy (`telemetry.db` + `.wal`) | Simple; fast; trivial restore (just copy back) | Tied to the exact on-disk format of the DuckDB version that wrote it — the same class of failure that caused the incident; copying a live file risks copying an inconsistent snapshot mid-write unless the daemon is paused | Directly reproduces the incident's fragility; the entire point of this feature is to stop trusting exactly this kind of copy |
| `EXPORT DATABASE` (chosen) | Version-independent Parquet+SQL representation; documented DuckDB mechanism for cross-version migration; naturally verifiable via `IMPORT DATABASE` into a fresh instance | Slower than a raw copy for large databases; restore requires a full re-import, not a file swap; requires enough scratch disk for the verification restore | Directly addresses the incident's root cause; the performance cost is acceptable at this project's current scale (~4,100 events over 7 weeks, ~15–20 MB) |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | Owns the export/import logic (req-006) and the documented restore procedure (req-004's startup message points here) |

## Consequences

**Positive:**
- Backups survive a DuckDB version upgrade between the backup and a future restore — the exact property the incident's approach lacked.
- Restore verification is a natural fit: `IMPORT DATABASE` into scratch either succeeds (verifiable row count) or fails loudly — no silent partial-restore state.

**Negative:**
- Backup and restore are slower than a raw file copy, and the export step briefly holds a read on the live table (see ADR-029 for how this interacts with the single-writer lock).
- Restoring in an emergency is a multi-step `IMPORT DATABASE` operation, not "copy the file back" — the documented restore procedure (req-004, req-006) must walk an operator through this explicitly rather than relying on it being obvious.

**Risks:**
- If `EXPORT DATABASE`'s Parquet representation has its own undiscovered version-compatibility issue, this ADR's premise is wrong. Mitigated by req-006's mandatory verify-on-every-backup step making such a failure visible immediately rather than only at restore time, months later.

## Related ADRs

- ADR-002-storage-engine-duckdb - depends-on (DuckDB's `EXPORT`/`IMPORT DATABASE` capability is why this format is viable at all)
- ADR-029-backup-runs-in-process - related-to (the export step's interaction with the daemon's single-writer connection)

## Supersedes

None.

## Superseded By

None.
