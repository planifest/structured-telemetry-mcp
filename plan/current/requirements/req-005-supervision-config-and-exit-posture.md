---
title: "Requirement: req-005 - Supervision Configuration and Exit Posture"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-005 - Supervision Configuration and Exit Posture

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Source:** US-002
**Priority:** must-have

## User Story

As an operator of the telemetry daemon, I want the database to survive an unclean shutdown, so that a crash, reboot, or deploy never strands or destroys collected events.

## Functional Requirements

- **Finding, confirmed against source:** the macOS plist (`scripts/service-macos.sh:177-180`) sets `KeepAlive.SuccessfulExit: false` with no `ThrottleInterval` key present — launchd's undocumented default throttle (historically ~10s) is the only thing standing between req-004's refuse-to-start exit and a tight respawn loop. The Linux unit (`scripts/service-linux.sh:117-118`) sets `Restart=on-failure` and `RestartSec=2` with no `StartLimitIntervalSec`/`StartLimitBurst` — systemd will restart indefinitely, 2 seconds apart, with no circuit breaker at all.
- Add an explicit `ThrottleInterval` key to the macOS plist (`scripts/service-macos.sh`'s plist-generation function) — a value long enough that a human notices the daemon is failing (e.g. tens of seconds to minutes) rather than launchd silently retrying forever in the background.
- Add `StartLimitIntervalSec` and `StartLimitBurst` to the systemd unit's `[Unit]` section (`scripts/service-linux.sh`) so that after N failures within a window, systemd stops restarting the service entirely rather than retrying every 2 seconds indefinitely.
- **Resolved by ADR-030 (P2):** the daemon exits **zero** on refuse-to-start. Both `KeepAlive.SuccessfulExit: false` (macOS) and `Restart=on-failure` (Linux) already restart only on a non-zero exit — a clean `exit(0)` is correctly treated as an intentional stop by both platforms' *existing* configs, with no plist/unit change required for that specific mechanism. This requirement's `ThrottleInterval`/`StartLimitBurst` additions are therefore **defense-in-depth** (ADR-031), not the primary stop-the-loop mechanism — they bound retry frequency for any *other* crash-loop cause, not specifically the refuse-to-start path.
- The combination of {req-004's `exit(0)` on refuse-to-start} + {this requirement's supervision config as a secondary safety net} must guarantee the daemon does **not** enter a rapid restart loop when the store is genuinely unusable — that is the acceptance bar.

## Acceptance Criteria

- [ ] A daemon that refuses to start (req-004) exits 0 and is not respawned at all under the existing `SuccessfulExit: false` (macOS) / `Restart=on-failure` (Linux) configs — verified under a real supervised install on both platforms, not just a unit test of the exit code in isolation
- [ ] Separately, a daemon that genuinely crashes (non-zero exit, unrelated to refuse-to-start) does not respawn more than a small, bounded number of times within the configured throttle window before supervision stops attempting further restarts
- [ ] The macOS plist change is present in the generated plist output and does not regress the existing install/uninstall/status/restart command surface
- [ ] The systemd unit change is present in the generated unit file and does not regress the existing install/uninstall/status/restart command surface
- [ ] A daemon that exits due to a genuine runtime error (not a refuse-to-start condition) still restarts normally — this requirement narrows the specific "unusable store" failure mode without weakening ordinary crash recovery

## Dependencies

- Directly follows from req-004 — the exit behaviour these supervision changes are shaped around is req-004's refuse-to-start path.
- No longer blocked — ADR-030 and ADR-031 resolved the exit-code posture and the role of this requirement's supervision config. Both req-004 and req-005 may proceed to P3 together.
