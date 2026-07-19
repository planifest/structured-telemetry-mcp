---
title: "Requirement: req-004 - macOS Service Setup Docs"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-004 - macOS Service Setup Docs

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000010-macos-launchd-service
**Source:** US-004
**Priority:** should-have

---

## User Story

As a developer following `getting-started.md` / `mac-setup.md`, I see the macOS service option documented next to the existing Windows instructions, so that I don't have to reverse-engineer it from a shell history.

---

## Functional Requirements
- `getting-started.md` and/or `mac-setup.md` gain a macOS service section documenting `service:install` / `uninstall` / `status` / `restart`, in the same format and location as the existing Windows section.
- Documentation includes the locked-`LaunchAgents` fallback path (req-003) so a developer hitting that error can self-diagnose from the docs alone.

## Acceptance Criteria
- [ ] `getting-started.md` / `mac-setup.md` documents the macOS service option alongside the existing Windows instructions
- [ ] Documentation matches the actual script command names and flags exactly (no drift between docs and implementation)

## Dependencies
- req-001, req-002, req-003 — documents their actual behaviour, written after those requirements are implemented.
