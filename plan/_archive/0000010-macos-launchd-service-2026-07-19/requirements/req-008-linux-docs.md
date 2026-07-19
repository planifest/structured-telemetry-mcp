---
title: "Requirement: req-008 - Linux Service Setup Docs"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-008 - Linux Service Setup Docs

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000010-macos-launchd-service
**Source:** US-008
**Priority:** should-have

---

## User Story

As a developer following `getting-started.md` / `mac-setup.md`, I see the Linux service option documented next to the existing Windows and macOS instructions.

---

## Functional Requirements
- `getting-started.md` and/or `mac-setup.md` gain a Linux service section documenting `service:install` / `uninstall` / `status` / `restart`, matching the format of the Windows and macOS sections.
- Documentation includes the lingering fallback path (req-007) and the "systemd not found" failure mode (req-005).

## Acceptance Criteria
- [ ] `getting-started.md` / `mac-setup.md` documents the Linux service option alongside the existing Windows and macOS instructions
- [ ] Documentation matches the actual script command names and flags exactly

## Dependencies
- req-005, req-006, req-007 — documents their actual behaviour.
