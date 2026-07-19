---
title: "Requirement: req-003 - Locked-Down ~/Library/LaunchAgents Handling"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-003 - Locked-Down ~/Library/LaunchAgents Handling

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000010-macos-launchd-service
**Source:** US-003
**Priority:** must-have

---

## User Story

As a developer whose Mac has `~/Library/LaunchAgents` locked to root ownership (seen on at least one dev machine — likely MDM/endpoint-security policy), I get a clear error and a sudo-based fallback path, so that setup doesn't fail silently or require me to debug macOS permissions myself.

---

## Functional Requirements
- Before writing the plist, `scripts/service-macos.sh install` performs a pre-flight write test on `~/Library/LaunchAgents` (e.g. `touch` a temp file and remove it).
- If the directory is not user-writable, the script prints a clear explanation (this may be an intentional MDM/security control) — it does not fail with a bare "permission denied."
- The script does not silently `sudo` around the restriction. It either (a) prompts for confirmation before using `sudo`, or (b) prints the exact `sudo`-prefixed commands for the developer to run themselves, and exits non-zero.
- Auto-fixing the directory ownership automatically is explicitly out of scope (see `plan/current/scope.md` › Deferred) — this requirement covers detection and guided remediation only, never silent override.

## Acceptance Criteria
- [ ] Script detects a non-writable `~/Library/LaunchAgents`, explains why (possible MDM/security lockdown), and offers a sudo fallback rather than failing opaquely
- [ ] The printed sudo fallback commands, when run manually by a human, successfully complete the install (matches the manually-verified sequence in `plan/current/macos-launchd-reference.md`)
- [ ] A normal (user-writable) `LaunchAgents` directory is unaffected — the pre-flight check adds no friction to the common case

## Dependencies
- None — this is a pre-flight check consumed by req-001.
