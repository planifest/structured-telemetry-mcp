# Restore Procedure — structured-telemetry-mcp

> Referenced directly from the daemon's refuse-to-start diagnostic message (`src/db/refuse-to-start.ts`'s `RESTORE_PROCEDURE_PATH`, req-004) and from the scheduled backup routine (`src/backup/`, req-006). If you're reading this because the daemon printed a message pointing here, start with the section matching what it told you.

## Before anything else

**Do not delete `telemetry.db.wal`.** If the daemon refused to start, the WAL may contain events that haven't been checkpointed into the main database file yet — deleting it destroys them permanently and irreversibly. This is the exact mistake that destroyed seven weeks of events on 2026-08-03, the incident this feature exists to prevent a repeat of. The daemon itself never touches the WAL on a failed start (req-004, decision D) — only a human, by hand, can make this mistake, and the fix is simply: don't.

## Case 1: "locked by another running process"

The database file is already open by another process — almost always a second copy of the daemon (e.g. a manual `npm run dev`/`npm start` left running alongside the supervised service).

1. The startup message names the conflicting PID when DuckDB's error exposes it. Confirm what it is: `ps -p <pid>`.
2. If it's an unmanaged/stray daemon process, stop it: `kill <pid>`.
3. If it's the supervised service itself somehow holding a stale lock (rare — e.g. an unclean kill that didn't release the lock cleanly), stop the service via the normal command for your platform (`npm run service:restart` / `launchctl kickstart` / `systemctl --user restart`) and try again.
4. Re-run the daemon (or let supervision retry it). No file was modified — this is purely a process-conflict resolution.

## Case 2: "poisoned WAL — the write-ahead log contains an entry DuckDB cannot replay"

The database's WAL contains an `ALTER TABLE` entry (or similar) that this DuckDB version's `ReplayAlter` cannot process. As of req-003, new installs checkpoint immediately after every schema migration specifically so this can't recur going forward — but a database created before that fix may already be in this state.

1. **Do not delete or truncate `telemetry.db.wal`.** Copy it aside first, read-only, before attempting anything: `cp telemetry.db telemetry.db.wal /somewhere/safe/`.
2. **Restore from the most recent verified backup** (see below) — this is the normal, expected recovery path. The events lost are only those written since that backup (bounded by the daily backup cadence, req-006) plus whatever wasn't checkpointed before the WAL was poisoned.
3. If no verified backup exists yet (a machine that was poisoned before its first backup ever ran), the stranded events in the old WAL may still be recoverable through exploratory means — see `plan/backlog/00023-recover-stranded-wal-events/entry.md` for the documented approach (not automated, not guaranteed, deliberately out of scope for this feature per design.md's Deferred section). Do not attempt this against the live `telemetry.db` path — always work on the copy made in step 1.

## Restoring from a verified backup

Backups live at `PLANIFEST_TELEMETRY_BACKUP_DIR` (default `~/.planifest-backups`, ADR-029) — a sibling of, not nested inside, `~/.planifest/`, so a mistaken wipe of one doesn't take out the other. Check `npm run doctor` for the age and location of the most recent verified backup before starting; it reads a small sidecar file (`latest-verified-backup.json`) rather than opening the (possibly still-unopenable) live database.

Each backup artifact is a `EXPORT DATABASE` directory (Parquet + `schema.sql`, ADR-028 — chosen specifically because this format is DuckDB-version-independent, unlike a raw file copy) named by its UTC timestamp.

1. Stop the daemon if it's running (it shouldn't be, if you're here because of case 2 above).
2. Move the poisoned `telemetry.db`/`telemetry.db.wal` pair aside (do not delete — keep them until the restore is confirmed good).
3. Pick the backup to restore: the most recent verified one is usually right (`latest-verified-backup.json`'s `artifactPath`), unless you have a specific reason to go further back.
4. From a DuckDB shell or a short script against a **fresh** database file at the normal `telemetry.db` path:
   ```sql
   IMPORT DATABASE '<artifactPath>';
   ```
5. Start the daemon normally. It will re-run its startup open check against the newly-restored file.
6. Once you've confirmed the daemon is healthy and serving (`GET /health`, `npm run doctor`), delete the moved-aside poisoned files — or keep them a while longer if you intend to attempt the exploratory recovery from backlog #00023.

## What you lose, and what you don't

- **Data since the last checkpoint** (req-001/002): at most 60 seconds or 100 events, whichever is smaller, is ever at risk from an unclean shutdown alone — this is unrelated to the poisoned-WAL/lock scenarios above and self-heals on the next clean reopen.
- **Data since the last verified backup** (req-006): if you had to restore from backup, this is the real window of loss — bounded by the daily backup cadence. `npm run doctor`'s reported backup age tells you the upper bound before you start.
- **Nothing, if this is case 1**: a lock conflict doesn't touch the database at all — resolving it and restarting recovers everything with no data loss.
