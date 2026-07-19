---
title: "Backlog Entry: 00001 - Linux Service Hardware Verification"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
---
# Backlog Entry: 00001 - Linux Service Hardware Verification

**Source feature:** 0000010-macos-launchd-service
**Source phase:** P4 (risk-register R-002)
**Date filed:** 2026-07-19

---

## Problem

`scripts/service-linux.sh` (the `systemd --user` install/uninstall/status/restart script) was written entirely from `plan/_archive/0000010-macos-launchd-service-2026-07-19/linux-systemd-reference.md`'s speculative design — no Linux machine was available during implementation or since. It has never been run against real systemd hardware. Unknown whether the unit file syntax, the `loginctl enable-linger` detection, or the `command -v systemctl` fallback actually behave as designed on a real distro (Ubuntu/Debian/Fedora).

## Suggested Action

Run `npm run service:install` on at least one real systemd-based Linux machine (or a VM/container with a real systemd PID 1, not a minimal container without systemd). Confirm: unit installs, `/health` responds, `systemctl --user status` reports correctly, lingering detection/warning fires correctly when lingering is off. Fix whatever doesn't match. Not a code-writing task for an agent — requires a human with real hardware access.

## Why Deferred

Out of scope for the query_telemetry/defects release (2026-07-19) — this isn't a code fix an agent pipeline run can produce; it's a manual verification task requiring hardware access. File separately when Linux hardware becomes available.
