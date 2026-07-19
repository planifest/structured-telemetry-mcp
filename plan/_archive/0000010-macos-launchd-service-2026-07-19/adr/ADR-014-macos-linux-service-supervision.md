---
title: "ADR 014: macOS/Linux Background Service Supervision"
summary: "Use user-scoped launchd (macOS) and systemd --user (Linux) to supervise the telemetry backend, mirroring the existing Windows nssm approach. No root daemon on either platform. Locked-permission and disabled-lingering failure modes are detected and explained, never silently auto-fixed."
status: "accepted"
version: "0.1.0"
---
# ADR-014 - macOS/Linux Background Service Supervision

**Skill:** planifest-adr-agent
**Tool:** claude-code
**Model:** claude-sonnet-5
**Feature:** 0000010-macos-launchd-service
**Component:** structured-telemetry-mcp
**Status:** accepted
**Date:** 2026-07-12

---

## Context

The telemetry backend (`server-http.bundle.mjs`) has only ever had a boot-surviving background-service option on Windows (`scripts/service.ps1`, using `nssm`). On macOS and Linux, developers run `npm start` in a foreground terminal or an unmanaged background shell — it does not survive logout/reboot, and there's no restart-on-crash behaviour.

A decision was needed on the supervision mechanism for each platform, and specifically on the privilege model: whether the install scripts should ever escalate privileges automatically, given a real failure mode was already observed on one development machine (`~/Library/LaunchAgents` locked to root ownership, likely by MDM/endpoint-security policy).

---

## Decision

Use **user-scoped** service supervision on both platforms, deploying the same CLI entrypoint the Windows service and `npm start` already use (no protocol or process change):
- **macOS:** a user LaunchAgent (`~/Library/LaunchAgents/com.planifest.telemetry-mcp.plist`), loaded via the modern `launchctl bootstrap gui/$(id -u)` / `launchctl enable` (not the deprecated `launchctl load -w`). `KeepAlive.SuccessfulExit: false` restarts on crash, not on a clean stop.
- **Linux:** a `systemd --user` unit (`~/.config/systemd/user/planifest-telemetry-mcp.service`), `Restart=on-failure`. Never a system-wide unit under `/etc/systemd/system/`.

Neither platform requires root/sudo for the common case. Where a privilege obstacle is detected — a root-owned `~/Library/LaunchAgents` on macOS, or disabled session lingering on Linux — the install script **explains the obstacle and prints the exact remediation command**, but never silently escalates or auto-fixes. On macOS, if the developer confirms, the script may print (or, with explicit confirmation, run) the `sudo`-prefixed commands; on Linux, `loginctl enable-linger` is only ever printed, never run automatically, since it is a persistent, account-wide setting change.

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| System-level daemon (root LaunchDaemon / `/etc/systemd/system/` unit) | Survives without any per-user login; conceptually simpler lifecycle | Requires root for install and every future update; wrong trust boundary for a per-developer local tool; inconsistent with the existing per-user Windows service model | Backend is inherently per-user (reads from the developer's own `$HOME`, binds to `127.0.0.1` for that user's own agent tool) — a system daemon is the wrong shape |
| Auto-`sudo` around a locked `~/Library/LaunchAgents` without asking | Removes a manual step for the common failure case | The lock may be an intentional MDM/endpoint-security control; silently overriding it could violate the machine's security policy without the developer's informed consent | Consent matters more than convenience for a security-relevant override; deferred to explicit human action (`plan/current/scope.md` › Deferred) |
| Auto-run `loginctl enable-linger` on Linux without asking | One fewer manual step; solves the "why did my service die on logout" surprise proactively | Lingering is a persistent, account-wide setting with effects beyond this one service (keeps the user's entire systemd instance running post-logout); may not be desired or permitted on a shared/managed box | Same consent principle — explain and print the command, let the human decide |
| `launchctl load -w` (legacy macOS API) | Simpler, widely documented in older tutorials | Deprecated by Apple; `bootstrap`/`bootout` is the supported modern API and behaves more predictably with `gui/<uid>` domain semantics | Building on a deprecated API creates avoidable future migration debt |

---

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | New `scripts/service-macos.sh` and `scripts/service-linux.sh`, wired to the existing `npm run service:*` command surface alongside `scripts/service.ps1` (Windows, unchanged) |

---

## Consequences

**Positive:**
- Consistent, low-friction background-service experience across all three platforms using the same `service:install/uninstall/status/restart` command surface.
- No privilege escalation happens without the developer's informed action — matches the conservative stance already implicit in the Windows script's design (nssm also runs without requiring the developer to grant it standing elevated rights beyond the initial install).
- Detected failure modes (locked directory, disabled lingering) fail with actionable guidance instead of silent or confusing breakage.

**Negative:**
- Two additional platform-specific script implementations (Bash + plist / Bash + systemd unit) to maintain alongside the existing PowerShell script — three total service-install code paths instead of one cross-platform abstraction.
- The Linux systemd unit design (`plan/current/linux-systemd-reference.md`) is untested on real hardware as of this ADR — verification is a req-005 acceptance criterion, not yet closed.
- A developer on a locked-down or non-lingering machine still needs one manual follow-up step (running the printed command themselves) rather than a fully zero-touch install.

**Risks:**
- If a future macOS/Linux security policy tightens further (e.g. blocking `launchctl`/`systemctl --user` entirely in some managed-device configurations), this supervision model would need re-evaluation — out of scope to anticipate now, tracked as risk-register R-001/R-002.

---

## Related ADRs

- none — this is the first service-supervision-related ADR in this repo; the Windows `nssm` approach that this mirrors predates the Planifest pipeline (never itself went through a P2 ADR pass).

---

## Supersedes

- none

## Superseded By

- none

---

*Generated by adr-agent. Path: `plan/current/adr/ADR-014-macos-linux-service-supervision.md`*
