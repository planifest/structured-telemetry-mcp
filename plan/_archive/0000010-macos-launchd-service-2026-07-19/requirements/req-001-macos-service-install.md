---
title: "Requirement: req-001 - macOS launchd Service Install"
summary: "Detailed requirements for this specific functional feature."
status: "active"
version: "0.1.0"
---
# Requirement: req-001 - macOS launchd Service Install

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000010-macos-launchd-service
**Source:** US-001
**Priority:** must-have

---

## User Story

As a developer, I can run `npm run service:install` (or `scripts/service-macos.sh install`) on macOS, so that the telemetry backend starts automatically on login and restarts if it crashes.

---

## Functional Requirements
- `scripts/service-macos.sh install` writes a user LaunchAgent plist to `~/Library/LaunchAgents/com.planifest.telemetry-mcp.plist` with `RunAtLoad: true` and `KeepAlive.SuccessfulExit: false`.
- The plist's `ProgramArguments` resolves the node binary dynamically (`command -v node`, falling back to checking both `/opt/homebrew/bin/node` and `/usr/local/bin/node`) — never hardcoded.
- The plist's paths (`WorkingDirectory`, entrypoint, log paths) are derived from `$HOME` and the repo's actual clone location at install time, not assumed.
- Loading uses the modern `launchctl bootstrap gui/$(id -u)` / `launchctl enable` calls, never the deprecated `launchctl load -w`.
- Each stage (write plist → load → verify) fails loudly and distinctly — a partial failure (e.g. plist written but not loaded) must never be mistaken for success.
- `npm run service:install` is wired to this script, matching the existing Windows `service:*` npm script surface exactly.

## Acceptance Criteria
- [ ] `scripts/service-macos.sh install` writes a valid plist and the backend is reachable at `http://localhost:3741/health` within a few seconds (retry-looped health check, not a single immediate curl)
- [ ] Verified on both Intel (`/usr/local/bin/node`) and Apple Silicon (`/opt/homebrew/bin/node`) Homebrew layouts, or the script resolves the node path dynamically instead of assuming one
- [ ] Re-running install (idempotency) does not create a duplicate service — `launchctl bootout` runs before `bootstrap` on re-install

## Dependencies
- req-003 (locked-`LaunchAgents` handling) — install must call the pre-flight write-test before attempting the plist write.
