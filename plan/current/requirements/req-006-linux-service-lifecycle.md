---
title: "Requirement: req-006 - Linux Service Lifecycle Commands"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-006 - Linux Service Lifecycle Commands

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000010-macos-launchd-service
**Source:** US-006
**Priority:** must-have

---

## User Story

As a developer, I can run `service:uninstall` / `service:status` / `service:restart` equivalents on Linux, so that I can manage the service the same way I already can on macOS/Windows.

---

## Functional Requirements
- `scripts/service-linux.sh uninstall` runs `systemctl --user disable --now planifest-telemetry-mcp`, removes the unit file, then `systemctl --user daemon-reload`.
- `scripts/service-linux.sh status` reports `systemctl --user status planifest-telemetry-mcp` plus a `/health` check.
- `scripts/service-linux.sh restart` runs `systemctl --user restart planifest-telemetry-mcp` (or disable/re-enable if the unit file itself changed).
- All three commands mirror the macOS/Windows `service:*` npm script surface so command names are identical across platforms.

## Acceptance Criteria
- [ ] `service:uninstall` / `status` / `restart` work, mirroring the Windows/macOS `service:*` scripts
- [ ] `status` distinguishes "unit not installed" from "installed but inactive/failed"
- [ ] `uninstall` leaves no stale unit file or systemd registration behind

## Dependencies
- req-005 (install) — shares the unit file path and enable/disable primitives.
