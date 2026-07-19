---
title: "Backlog Entry: 00002 - Shell Script Test Harness"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
---
# Backlog Entry: 00002 - Shell Script Test Harness

**Source feature:** 0000010-macos-launchd-service
**Source phase:** P6 (recommendations.md item 4)
**Date filed:** 2026-07-19

---

## Problem

`scripts/service-macos.sh` and `scripts/service-linux.sh` have no automated test coverage — verification is manual only (per `plan/_archive/0000010-macos-launchd-service-2026-07-19/design.md`'s declared testing strategy, since no shell-script test convention exists in this repo). As the service-script surface grows, manual-only verification will miss regressions the current checklist doesn't happen to exercise.

## Suggested Action

Introduce a shell-script test framework (`bats` or `shunit2` are the common choices) and write tests for both service scripts' pure-logic paths (argument parsing, path resolution, error-message formatting) — the parts that don't require an actual `launchctl`/`systemctl` environment to exercise. Full end-to-end install/uninstall would still need manual or CI-matrix verification (GitHub Actions runners do have `systemctl --user` and `launchctl` available on their respective OS images, so some of this could plausibly run in CI too — worth investigating at pickup time).

## Why Deferred

This is a standalone tooling investment (new test framework, new CI wiring), not a "known defect" fix — deserves its own scoped design decision (which framework, how much of the install/uninstall flow to actually exercise vs. mock) rather than being bundled into a defect-fix release.
