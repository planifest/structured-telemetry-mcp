---
title: "Backlog Entry: 00003 - MCP SDK Transitive Dependency Advisories"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
---
# Backlog Entry: 00003 - MCP SDK Transitive Dependency Advisories

**Source feature:** 0000010-macos-launchd-service
**Source phase:** P5 (security-report.md dependency audit)
**Date filed:** 2026-07-19

---

## Problem

`npm audit --omit=dev` reports 5 advisories (3 moderate, 2 high) against `hono`, `qs`, and `ip-address` — all transitive dependencies of `@modelcontextprotocol/sdk` (via `@hono/node-server`) rather than of any code this repo directly maintains. Not exploitable through this repo's own usage (no HTTP framework routes, no untrusted `qs`-parsed input in this codebase), but they show up in any `npm audit` scan and would need addressing if this repo's supply-chain posture is ever formally reviewed.

## Suggested Action

Check whether a newer `@modelcontextprotocol/sdk` release has picked up patched versions of these transitive deps (`npm ls hono qs ip-address` after bumping, compare against advisory-fixed version ranges). If yes, bump the SDK version as its own scoped change (SDK version bumps can carry their own breaking changes worth reviewing independently — see ADR-007's "always latest stable" policy, which should apply here too). If no upstream fix exists yet, document the accepted-risk rationale and revisit periodically.

## Why Deferred

Not this repo's own code defect — inherited via a dependency. An SDK version bump deserves its own review pass (breaking-change check, full test suite re-run) rather than being silently bundled into an unrelated defect-fix release.
