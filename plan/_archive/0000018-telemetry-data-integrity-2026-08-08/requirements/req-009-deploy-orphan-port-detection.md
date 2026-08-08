---
title: "Requirement: req-009 - Deploy Detects an Orphaned Port Holder"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-009 - Deploy Detects an Orphaned Port Holder

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Source:** US-001
**Priority:** must-have

## User Story

As an engineer deploying a fix, I want the deploy to fail loudly when the running daemon is not the build I just made, so that I never test against stale code believing it is current.

## Functional Requirements

- **Finding, confirmed against source:** `scripts/service-manager.mjs`'s `isServiceActive()` (lines 27-33) checks only `launchctl list com.planifest.telemetry-mcp` / `systemctl --user is-active planifest-telemetry-mcp` — it never inspects whether anything is actually bound to port 3741 (`PLANIFEST_MCP_PORT`, `src/server-http.ts:58`). There is no `lsof`/port-check logic anywhere in this codebase today. A daemon started manually (e.g. a leftover `npm start` from local development, not registered with launchd/systemd) would make `isServiceActive()` return `false`, causing `deploy` to conclude "No active service detected — build complete, nothing to restart" (`scripts/service-manager.mjs` line 68-70) while a stale, unmanaged process silently keeps answering on the port.
- Add a port-occupancy check to the `deploy` action, run regardless of `isServiceActive()`'s result: determine whether anything is listening on `PLANIFEST_MCP_PORT` (default 3741) and, if so, whether it is the process launchd/systemd is managing (cross-reference the service's own PID, obtainable from `launchctl list`'s output / `systemctl --user show ... --property=MainPID`) or a different, unmanaged process.
- If the port is held by a process launchd/systemd does not own: `deploy` prints a message naming the orphan process's PID and the command to stop it (e.g. `kill <pid>`), then exits non-zero. `deploy` must **not** kill the foreign process itself — only name it and the remedy.
- This check applies on top of, not instead of, req-008's build-identity comparison — a port held by *the managed* daemon still goes through the build-identity check; only an *unmanaged* holder short-circuits into this orphan-detection failure instead.

## Acceptance Criteria

- [ ] Running `deploy` while an unmanaged process (not registered with launchd/systemd) is bound to port 3741 causes `deploy` to exit non-zero, naming that process's PID and the command to stop it
- [ ] `deploy` does not attempt to kill or otherwise terminate the foreign process
- [ ] Running `deploy` when the port is free, or held only by the launchd/systemd-managed daemon, proceeds to the normal build-identity check (req-008) unaffected
- [ ] The orphan-port check does not produce a false positive against the daemon's own managed process during a normal restart cycle (i.e. the brief window where the old managed instance is still bound to the port during restart is not mistaken for an orphan)

## Dependencies

- Shares `scripts/service-manager.mjs`'s `deploy` action with req-008 — implement together, in the order: orphan-port check first, then (if the port is either free or held by the managed process) req-008's build-identity check.
