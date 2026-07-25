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

## Update — 2026-07-23: Multipass attempt, descoped for now

Tried standing up a local Ubuntu VM via Multipass (`brew install --cask multipass`) on the macOS host specifically to unblock this. The VM (`telemetry-linux-test`) never became network-reachable — stuck in `Starting`/`Restarting` across many attempts (fresh launch, graceful restart, force-stop+start, delete+recreate, install reinstall) over several days, each attempt failing slightly differently.

Diagnostics run, for whoever picks this up next:
- No blocked system-extension banner in System Settings → Privacy & Security.
- Multipass doesn't appear in the Local Network permission list at all (Docker does) — inconclusive, may just mean multipassd's vmnet usage doesn't go through that particular gate.
- Console.app filtered to `multipassd`, "Errors and Faults" tab: **zero actual errors/faults logged**, ever — the daemon isn't failing loudly, it's just not progressing.
- `/Library/Logs/Multipassd/multipassd.log` (world-readable, `tail`-able without sudo) shows multipassd successfully making its own outbound HTTPS connections every ~15 min (image-manifest/update checks) — **host-level internet connectivity for multipassd is confirmed fine**.
- Console.app filtered to `vmnet` (broadened from `multipassd`, "All Messages" not just errors): **zero messages, ever** — not even benign ones. This is the most useful negative result: it suggests multipassd isn't reaching the network-bridge setup stage at all, i.e. the hang is earlier, likely in the VM/hypervisor boot itself (this is Apple Silicon, so Apple's Virtualization.framework) rather than in networking specifically.

Root cause not found. Human decided to descope Linux verification again rather than keep debugging — VM left in `Stopped` state (not deleted) at `telemetry-linux-test`, can be restarted to continue diagnosis, or deleted and a fresh approach (cloud VM was the other option on the table) tried instead.

**Suggested next diagnostic step, if picked up again:** check for `Virtualization`/`hvf`/`Hypervisor` in Console.app (we only checked `multipassd` and `vmnet`, never the hypervisor layer itself), or just skip Multipass entirely and use a small short-lived cloud VM (DigitalOcean/EC2/etc.) instead — sidesteps whatever is wrong with this host's local hypervisor setup rather than continuing to debug it.
