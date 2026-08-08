---
title: "Requirement: req-004 - Refuse to Start on an Unopenable Database"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-004 - Refuse to Start on an Unopenable Database

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Source:** US-002
**Priority:** must-have

## User Story

As an operator of the telemetry daemon, I want the database to survive an unclean shutdown, so that a crash, reboot, or deploy never strands or destroys collected events.

## Functional Requirements

- At startup, before any migration runs (req-003) and before the HTTP listener opens, attempt to open the database via the existing `openDatabase()` (`src/db/index.ts:30`). If this throws (lock held by another process, or an unreplayable WAL), the daemon must **not** retry-loop internally, must **not** delete, truncate, or otherwise modify the WAL or database file, and must exit with a non-zero code after printing exactly one diagnostic message to stderr.
- The diagnostic message must name: the database file path, the specific failure reason (lock held vs. unreplayable WAL, distinguished from the caught error where possible), the conflicting PID if the failure is a held lock (best-effort — DuckDB's lock error may not always expose the holder's PID; if unavailable, say so rather than guessing), and a pointer to the documented restore procedure (see req-006's restore documentation).
- The message's first line must state plainly that deleting the `.wal` file is irreversible and will destroy any events not yet checkpointed into the main file — directly addressing the accepted residual risk in risk-register.md R-003 (this is the exact mistake made during the 2026-08-03 incident).
- This check must distinguish "the store is unusable" (refuse to start) from any other startup error (e.g. a missing config value, an unrelated exception) — only lock-contention and WAL-replay failures trigger this refuse-to-start path; other startup errors keep their existing behaviour.

## Acceptance Criteria

- [ ] A database in the poisoned-WAL state (reproducible by supplying a WAL file containing an unreplayable `ALTER` entry) causes the daemon to exit non-zero immediately, without opening the HTTP listener
- [ ] The WAL file's contents and mtime are byte-identical before and after the failed start attempt
- [ ] The printed message names the database file path
- [ ] The printed message's first line warns that deleting the WAL is irreversible
- [ ] The printed message points at the restore procedure
- [ ] A database locked by another running instance of the daemon produces the same refuse-to-start behaviour, naming the conflicting PID when DuckDB's error exposes it
- [ ] The daemon does not enter an internal retry loop — exactly one attempt to open, one message, one exit

## Dependencies

- Must run before req-003's migration step (see req-003 Dependencies) — never attempt a migration against a database that failed to open.
- Its exit code and the "stay stopped" guarantee depend on req-005's supervision configuration changes — this requirement alone only guarantees a clean single exit; without req-005, launchd/systemd `KeepAlive`/`Restart=on-failure` will still relaunch the daemon into the same immediate failure, reproducing a crash loop from the outside even though this requirement's own logic never loops.
