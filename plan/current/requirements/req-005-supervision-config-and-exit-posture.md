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
- **Pending P2 ADR (design.md Risks; risk-register.md R-005):** whether the daemon's own exit code on refuse-to-start should be non-zero (signalling failure to supervision, relying on the throttle/circuit-breaker above to stop the loop) or exit-zero (per ADR-005's hooks precedent, signalling "intentionally stopped" so supervision does not treat it as a failure at all). This requirement implements whichever posture the P2 ADR settles on for req-004's exit code — do not resolve it independently in codegen.
- Whichever posture is chosen, the combination of {req-004's exit behaviour} + {this requirement's supervision config} must guarantee the daemon does **not** enter a rapid restart loop when the store is genuinely unusable — that is the acceptance bar, independent of which specific exit-code mechanism achieves it.

## Acceptance Criteria

- [ ] A daemon that refuses to start (req-004) does not respawn more than a small, bounded number of times within a short window (exact threshold set by the P2 ADR) before supervision stops attempting further restarts
- [ ] The macOS plist change is present in the generated plist output and does not regress the existing install/uninstall/status/restart command surface
- [ ] The systemd unit change is present in the generated unit file and does not regress the existing install/uninstall/status/restart command surface
- [ ] A daemon that exits due to a genuine runtime error (not a refuse-to-start condition) still restarts normally — this requirement narrows the specific "unusable store" failure mode without weakening ordinary crash recovery

## Dependencies

- Directly follows from req-004 — the exit behaviour these supervision changes are shaped around is req-004's refuse-to-start path.
- Blocked on the P2 ADR resolving the exit-zero-vs-non-zero question (design.md: "requires an ADR at P2 resolving whether ADR-005's exit-zero principle extends from hooks to a supervised daemon"). Codegen for the exit-code portion of req-004 cannot proceed until this ADR is confirmed; the throttle/circuit-breaker config in this requirement is independent of that decision and can proceed in parallel.
