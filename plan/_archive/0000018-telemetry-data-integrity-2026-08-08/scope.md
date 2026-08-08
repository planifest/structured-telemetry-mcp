---
title: "Scope - Telemetry Data Integrity"
summary: "Defines explicit boundaries of what is in scope and out of scope."
status: "active"
version: "0.14.0"
---
# Scope - Telemetry Data Integrity

**Skill:** [spec-agent](../skills/spec-agent-SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Wave:** 1 of 1 (no wave split — 4 features, below the 5–6 threshold)
**Version:** 0.14.0

## In Scope

- Graceful shutdown: `SIGTERM`/`SIGINT` handler that checkpoints DuckDB and closes the connection cleanly before exit (US-002/00008)
- Periodic checkpoint every 60 seconds or 100 events, whichever comes first, bounding the data-at-risk window on an unclean kill (US-002/00008)
- WAL-safe `ADD COLUMN` migrations — no function-valued column default may serialise into a WAL entry that DuckDB cannot replay (US-002/00008)
- Startup self-check: on an unopenable database, the daemon refuses to start, stays stopped (no restart loop), and prints one message naming the database file, the conflicting PID where applicable, and the recovery procedure — the WAL is never deleted, truncated, or modified (US-002/00008, decision D)
- Supervision configuration changes on macOS (launchd plist) and Linux (systemd unit) so a refuse-to-start daemon does not get bounced by `KeepAlive` into a restart loop — this amends ADR-014's surface (US-002/00008, decision C)
- Daemon `uncaughtException` failure posture, distinguishing "refuse to start" (unusable store) from "runtime error while serving" (everything else degrades and keeps serving) (US-002/00008)
- Scheduled daily backup via `EXPORT DATABASE`, ordered strictly **verify → promote → prune**: write under a temporary name, restore into a scratch location, assert the row count pinned at export time, promote by rename only on success, then prune to 7 daily + 4 weekly (US-003/00024)
- `doctor` reports the age of the most recent *verified* backup, or "no verified backup" when none exists yet (US-003/00024)
- Documented restore procedure, linked directly from the startup self-check message as the recovery path (US-003/00024)
- Deploy build-identity assertion: compares the running daemon's build fingerprint (bundle hash or mtime), not merely its reported version string, so a same-version redeploy is still caught (US-001/00019, decision A)
- The build-identity assertion enforced across all three platform paths — macOS, Linux, Windows — preferably lifted into `scripts/service-manager.mjs` rather than duplicated per platform script (US-001/00019, decision B)
- Deploy detects a foreign/orphaned port holder and refuses to report success, naming the orphan PID and the command to stop it, without killing the foreign process itself (US-001/00019)
- Unique tiebreaker on every event-log `ORDER BY`, so no sortable field can produce a non-deterministic page boundary (US-004/00009)
- Regression test asserting pagination completeness (0 dropped, 0 duplicated rows across a full page-through) for every sortable field and both sort directions (US-004/00009)

## Out of Scope

- HTTP boundary hardening — request validation gaps, error-message leakage, missing auth/Origin/Host checks, unbounded request bodies, unbounded result sets, and unbacked security-test claims (backlog 00010–00014, 00020). Needs its own ADR and P5 security review as a separate feature.
- Log viewer correctness defects — async races, tail-mode state loss, filter/sort/page state sync (backlog 00015–00018)
- Log viewer improvements — event-detail column, severity, aggregate/dashboard views (backlog 00021–00022)
- Client-side buffering or retry for events emitted while the daemon is down — an outage still loses those events, just loudly instead of silently
- Migrating from limit/offset to keyset pagination — would supersede ADR-016; the tiebreaker fix works within it, not instead of it

## Deferred

- **Recovery of the ~4,100 events already stranded in the pre-existing unreplayable WAL (backlog 00023).** Exploratory work against an undocumented DuckDB WAL binary format with an uncertain success rate. Blocked until: someone picks up 00023 in a future pipeline run. Not blocking this feature — the data is safe in two checksum-verified copies (`~/.planifest/preserved-2026-08-03-unreplayable-wal/`, `~/.planifest/backup-2026-08-03-0210/`) and nothing here depends on it being recovered.
