---
title: "Requirement: req-007 - doctor Reports Verified-Backup Staleness"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-007 - doctor Reports Verified-Backup Staleness

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Source:** US-003
**Priority:** must-have

## User Story

As an operator, I want verified, retained backups taken automatically, so that any future failure — predicted or not — has a restore path.

## Functional Requirements

- **Finding, confirmed against source (not assumed):** `src/cli.ts`'s `runDoctor()` (line 132 onward) already opens a *second*, independent connection to `telemetry.db` via `openDatabase(dbPath)` (line 158) to run its existing write-test check. Because DuckDB is single-writer, this second connection can itself fail or block while the daemon holds the lock — confirmed by reading the existing implementation, not merely theorized (risk-register.md R-002). Backup-staleness reporting must not inherit this failure mode.
- Add a new check to `runDoctor()`'s existing `checks` array: read the sidecar JSON metadata file written by req-006's backup routine (never open `telemetry.db` directly for this check). Report one of three states: (a) a verified backup exists — show its age (time since the recorded timestamp) and row count; (b) the metadata file is absent — report "no verified backup" as a distinct, named state, not an error and not an infinite/undefined age; (c) the metadata file exists but is malformed or unreadable — report this as its own distinct warning state, distinguishable from (b).
- This check must succeed (or report state b/c) regardless of whether the daemon is currently running and holding the DuckDB lock, since it never opens the database file itself.

## Acceptance Criteria

- [ ] `npm run doctor` reports the age of the most recent verified backup when one exists, sourced from the sidecar metadata file, not from opening `telemetry.db`
- [ ] `npm run doctor` reports "no verified backup" (not an error, not a blank/undefined value) when no backup has ever completed verification
- [ ] Running `npm run doctor` while the daemon is actively running and holding the database lock does not fail or hang on the new backup-staleness check
- [ ] A malformed or corrupted sidecar metadata file produces a distinct warning, not a crash of the `doctor` command and not a false "no verified backup" report
- [ ] The existing `doctor` checks (server bundle exists, DB directory writable, DuckDB write test) are unaffected by this addition

## Dependencies

- Depends on req-006's sidecar metadata file format being finalized first — this requirement is a pure consumer of that file.
