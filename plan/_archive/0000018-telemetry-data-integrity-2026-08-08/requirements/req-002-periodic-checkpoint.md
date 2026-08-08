---
title: "Requirement: req-002 - Periodic Checkpoint"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-002 - Periodic Checkpoint

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Source:** US-002
**Priority:** must-have

## User Story

As an operator of the telemetry daemon, I want the database to survive an unclean shutdown, so that a crash, reboot, or deploy never strands or destroys collected events.

## Functional Requirements

- Add a periodic checkpoint mechanism to `src/server-http.ts` (or a new module it imports) that runs a DuckDB `CHECKPOINT` on the open connection whenever **either** of these conditions is first met: 60 seconds have elapsed since the last checkpoint, or 100 events have been written since the last checkpoint.
- Track a write counter, incremented once per successful `emit_event`/`POST /emit` write, reset to 0 whenever a checkpoint runs (scheduled or graceful-shutdown).
- Use a single `setInterval`/`setTimeout`-based timer for the time-based trigger; the event-count trigger is evaluated inline at write time (no separate polling loop needed).
- A checkpoint that fails (e.g. transient lock contention, full disk) logs a warning and does **not** crash the process or stop future writes — per the design's "degrade and keep serving" posture (design.md Risks; risk-register.md R-005 concerns exit posture, not this path). The write counter and timer both continue running normally after a failed checkpoint; the next scheduled attempt will retry.
- The periodic timer must be cleared as part of req-001's shutdown handler so it never keeps the process alive after `server.close()`.

## Acceptance Criteria

- [ ] Under sustained write load, a checkpoint runs automatically once at least 100 events have been written since the previous checkpoint, without waiting the full 60 seconds
- [ ] Under light/no write load, a checkpoint runs automatically after 60 seconds even if fewer than 100 events were written
- [ ] Killing the process with `kill -9` (unclean, no graceful shutdown) immediately after a scheduled checkpoint loses no more than the events written since that checkpoint
- [ ] A `kill -9` under sustained write, timed to land at the worst point in the cycle, loses at most 60 seconds of events / 100 events, whichever bound is smaller at that moment
- [ ] A checkpoint failure (simulated, e.g. by making the DB path temporarily read-only) is logged as a warning and does not stop the daemon from continuing to accept and process new events
- [ ] The database reopens cleanly (no unreplayable WAL) after an unclean kill immediately following a successful checkpoint

## Dependencies

- Shares `src/server-http.ts`'s lifecycle with req-001 (graceful shutdown) — the same timer and write-counter state must be visible to both the periodic trigger and the shutdown handler.
- The write counter increments on the same code path exercised by req-003's migration checkpoint-on-migrate behaviour; do not create two independent counters.
