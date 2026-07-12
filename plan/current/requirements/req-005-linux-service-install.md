---
title: "Requirement: req-005 - Linux systemd Service Install"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-005 - Linux systemd Service Install

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000010-macos-launchd-service
**Source:** US-005
**Priority:** must-have

---

## User Story

As a developer, I can run `npm run service:install` (or `scripts/service-linux.sh install`) on Linux, so that the telemetry backend starts automatically on login and restarts if it crashes, the same way it does on macOS/Windows.

---

## Functional Requirements
- `scripts/service-linux.sh install` first checks `command -v systemctl`; if absent, prints a clear "not supported on this init system" message and exits non-zero (no fallback init system attempted).
- Writes a `systemd --user` unit to `~/.config/systemd/user/planifest-telemetry-mcp.service` with `Type=simple`, `Restart=on-failure`, `RestartSec=2`.
- `ExecStart`'s node path is resolved at install time via `command -v node` and substituted into the unit file — systemd unit files do not support shell expansion, so this must happen in the install script, not the unit file itself.
- `WorkingDirectory` and the entrypoint path are derived from the actual repo clone location (e.g. resolved relative to the install script's own path), never hardcoded to a specific developer's home directory layout.
- Runs `systemctl --user daemon-reload && systemctl --user enable --now planifest-telemetry-mcp` and verifies via `systemctl --user is-active` plus a retry-looped `/health` curl.
- `npm run service:install` is wired to this script on Linux, matching the macOS/Windows `service:*` command surface.

## Acceptance Criteria
- [ ] `scripts/service-linux.sh install` writes a valid `systemd --user` unit and the backend is reachable at `/health` within a few seconds
- [ ] Script detects a missing `systemctl` and fails with a clear "not supported" message rather than a raw command-not-found error
- [ ] Verified on at least one systemd-based distro (e.g. Ubuntu); node path resolved dynamically rather than hardcoded

## Dependencies
- req-007 (lingering detection) — install must run the post-install lingering check after a successful start.
