---
title: "Requirement: req-007 - Linux Lingering Detection and Guidance"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-007 - Linux Lingering Detection and Guidance

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000010-macos-launchd-service
**Source:** US-007
**Priority:** must-have

---

## User Story

As a developer running on a headless server or a minimal container/WSL-adjacent distro where `systemd --user` sessions don't linger past logout, I get a clear explanation and an `loginctl enable-linger` fallback, so that the service doesn't silently stop working after I disconnect.

---

## Functional Requirements
- After a successful install, `scripts/service-linux.sh install` checks `loginctl show-user "$USER" --property=Linger`.
- If lingering is not `yes`, the script prints a clear warning explaining that the service will stop on logout/SSH disconnect, plus the exact `loginctl enable-linger $USER` command to fix it.
- The script never runs `loginctl enable-linger` itself — enabling linger is a persistent, user-account-wide setting change and is explicitly deferred to human action (see `plan/current/scope.md` › Deferred).
- `status` also re-checks lingering so a developer can discover the risk later, not just at install time.

## Acceptance Criteria
- [ ] Script checks lingering after install and clearly warns (with the exact remediation command) if the service won't survive logout
- [ ] The warning is printed even when the service installed and started successfully in the current session (the failure is deferred, not immediate — this must not be missed)
- [ ] `status` command also surfaces the current lingering state

## Dependencies
- req-005 (install) — this check runs as the final step of a successful install.
