---
title: "Requirement: req-001 - Graceful Shutdown Checkpoint"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-001 - Graceful Shutdown Checkpoint

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Source:** US-002
**Priority:** must-have

## User Story

As an operator of the telemetry daemon, I want the database to survive an unclean shutdown, so that a crash, reboot, or deploy never strands or destroys collected events.

## Functional Requirements

- `src/server-http.ts` currently registers `process.on('unhandledRejection', ...)` (line 47) and `process.on('uncaughtException', ...)` (line 51) but no `SIGTERM` or `SIGINT` handler. Add both.
- On `SIGTERM` or `SIGINT`: stop accepting new HTTP connections (`server.close()`), run a DuckDB `CHECKPOINT` against the open connection, then call the existing `closeDatabase()` (`src/db/index.ts:60`), then exit with code 0.
- The shutdown handler must complete the checkpoint before the process exits — do not call `process.exit()` from inside the signal handler until the checkpoint and close have both resolved.
- If the checkpoint itself throws (e.g. disk full during the final flush), log the error to stderr and still proceed to close the connection and exit — a failed final checkpoint must not hang the process past a bounded timeout (see Dependencies).
- launchd's `KeepAlive.SuccessfulExit: false` (`scripts/service-macos.sh:177-180`) and systemd's `Restart=on-failure` (`scripts/service-linux.sh:117`) both treat exit code 0 as a stop request, not a crash — confirm the graceful-shutdown exit path returns 0 so a deliberate `SIGTERM` (e.g. from `deploy`) does not trigger an unwanted respawn race with the new instance being started.

## Acceptance Criteria

- [ ] Sending `SIGTERM` to a running daemon under active write load results in `telemetry.db`'s WAL being flushed (checkpointed) before the process exits
- [ ] Sending `SIGINT` produces the same behaviour as `SIGTERM`
- [ ] The process exits with code 0 on a clean `SIGTERM`/`SIGINT` shutdown
- [ ] No in-flight HTTP request is abruptly severed — `server.close()` is called before the process exits, allowing in-flight requests to complete or fail cleanly
- [ ] Reopening the database immediately after a graceful shutdown requires no WAL replay (the WAL is empty or absent)

## Dependencies

- Shares the daemon lifecycle module (`src/server-http.ts`) with req-002 (periodic checkpoint) and req-004 (refuse-to-start) — the periodic checkpoint timer started by req-002 must be cleared in this same shutdown handler to avoid a dangling timer keeping the process alive past `server.close()`.
- Depends on a bounded shutdown timeout (e.g. 5s) as a safety net for a hung checkpoint — coordinate the exact value with req-002 so both use the same constant rather than two independently-chosen numbers.
