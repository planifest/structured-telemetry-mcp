---
title: "Requirement: req-002 - macOS Service Lifecycle Commands"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-002 - macOS Service Lifecycle Commands

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000010-macos-launchd-service
**Source:** US-002
**Priority:** must-have

---

## User Story

As a developer, I can run `service:uninstall` / `service:status` / `service:restart` equivalents on macOS, so that I can manage the service the same way I already can on Windows.

---

## Functional Requirements
- `scripts/service-macos.sh uninstall` runs `launchctl bootout gui/$(id -u)/com.planifest.telemetry-mcp` then removes the plist file.
- `scripts/service-macos.sh status` reports whether the service is loaded (`launchctl list | grep`) and whether `/health` responds.
- `scripts/service-macos.sh restart` performs `bootout` then `bootstrap` + `enable`, matching the same load sequence as install.
- All three commands mirror the existing `scripts/service.ps1` command surface (`service:uninstall`, `service:status`, `service:restart` npm scripts) so the developer-facing command names are identical across platforms.

## Acceptance Criteria
- [ ] `service:uninstall` / `status` / `restart` work and mirror the Windows `service:*` npm scripts
- [ ] `status` correctly reports "not installed" when the plist doesn't exist, distinct from "installed but not running"
- [ ] `restart` recovers a service that was left in a partially-loaded state (plist exists, not bootstrapped)

## Dependencies
- req-001 (install) — shares the plist path and load/unload primitives.
