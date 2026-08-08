---
title: "Backlog Entry: 00026 - Live supervised respawn-count drill for req-005's circuit-breaker"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "low"
---
# Backlog Entry: 00026 - Live supervised respawn-count drill for req-005's circuit-breaker

**Source feature:** 0000018-telemetry-data-integrity
**Source phase:** P6 (docs)

**Date filed:** 2026-08-08

---

## Problem

req-005 (0000018) added `ThrottleInterval` (macOS plist) and `StartLimitIntervalSec`/`StartLimitBurst` (systemd unit) as a defense-in-depth circuit-breaker against repeated daemon crash loops (ADR-031 — this config is explicitly *not* the primary stay-stopped mechanism; that's ADR-030's `exit(0)`, which does have real behavioral test coverage via `tests/integration/server-http-refuse-to-start.test.ts`'s poisoned-WAL/lock-held reproduction).

The circuit-breaker itself only has config-content-level test coverage: `tests/bats/service-macos.bats`/`service-linux.bats` assert the generated plist/unit files contain the right keys with the right values (`ThrottleInterval: 60`, `StartLimitIntervalSec=60`, `StartLimitBurst=5`). No test actually installs the service under real `launchd`/`systemd`, forces repeated failures, and counts respawn attempts over real wall-clock time. This was a deliberate P4 scoping decision — deliberately not run destructively against the live daemon backing the development session's own telemetry (see `plan/current/build-log.md`'s P4 section) — not an oversight, but it leaves a real behavioral gap: a future change to the plist/unit generation logic could silently break the actual respawn-limiting behavior while the bats tests keep passing.

## Suggested Action

On a machine where it's safe to do so (not backing an active development session's own telemetry daemon):
1. Install the service via `npm run service:install`.
2. Force the daemon into a repeated-failure state (e.g. temporarily point `PLANIFEST_TELEMETRY_DB` at a permanently-locked or poisoned-WAL file).
3. Observe actual respawn attempts over a window longer than the configured throttle/burst window and confirm the count is bounded as configured — macOS should throttle to roughly one attempt per `ThrottleInterval` seconds indefinitely (per `launchd.plist(5)`); Linux should stop attempting entirely after `StartLimitBurst` failures within `StartLimitIntervalSec`, requiring `systemctl --user reset-failed` to resume (per `systemd.service(5)`).
4. If this is only practical as a manual, occasional verification rather than an automated CI test (real launchd/systemd install is invasive), document it as a manual verification step in `src/structured-telemetry-mcp/docs/test-coverage.md` rather than leaving it silently untested.

## Why Deferred

Not blocking 0000018 — the primary "stay stopped" guarantee already has real integration-test coverage; this gap is specifically in the secondary defense-in-depth layer. Filed per docs-agent's P6 backlog-filing convention for a Tech Debt item identified during this feature's own build (`plan/current/recommendations.md` REC-001/TD-001).
