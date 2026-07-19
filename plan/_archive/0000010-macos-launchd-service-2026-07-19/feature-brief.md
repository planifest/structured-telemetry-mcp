---
title: "Feature Brief - macOS + Linux Background Service"
summary: "Give structured-telemetry-mcp's backend a persistent, boot-surviving way to run on macOS (launchd) and Linux (systemd), matching the existing Windows service scripts."
status: "draft"
version: "0.2.0"
---
# Feature Brief - macOS + Linux Background Service

**Feature ID:** 0000010-macos-launchd-service

> Written by a human. This is the input document that kicks off the confirmed design Agentic Iteration Loop. The orchestrator reads this and coaches you through any gaps before passing it to the spec-agent.
>
> Feature ID / folder name kept as `macos-launchd-service` (already referenced by `macos-launchd-reference.md`) even though scope has grown to include Linux as Phase 2 — renaming mid-flight would break that cross-reference. Phase 2 covers Linux.

---

## Business Goal

The telemetry backend (`server-http.bundle.mjs`) must run continuously in the background for `structured-telemetry-mcp` and any Planifest project's telemetry hooks to work. Today the only documented setup (mac-setup.md, package.json `service:*` scripts) is Windows-only (PowerShell + `scripts/service.ps1`). On macOS and Linux, engineers are currently left to run `npm start` in a foreground terminal or a manually-managed background shell, which does not survive logout/reboot and is easy to forget to restart. This feature adds first-class macOS (Phase 1, launchd) and Linux (Phase 2, systemd) equivalents so the backend behaves like a real background service on every platform, not just Windows.

---

## Features

| Feature | User Stories | Priority | Phase |
|---------|-------------|----------|-------|
| launchd service install script | As a developer, I can run `npm run service:install` (or an equivalent `scripts/service-macos.sh`) on macOS, so that the telemetry backend starts automatically on login and restarts if it crashes | must-have | 1 |
| launchd service uninstall/status scripts | As a developer, I can run `service:uninstall` / `service:status` / `service:restart` equivalents on macOS, so that I can manage the service the same way I already can on Windows | must-have | 1 |
| Locked-down `~/Library/LaunchAgents` handling | As a developer whose Mac has `~/Library/LaunchAgents` locked to root ownership (seen on at least one dev machine — likely MDM/endpoint-security policy), I get a clear error and a `sudo`-based fallback path, so that setup doesn't fail silently or require me to debug macOS permissions myself | must-have | 1 |
| Setup docs (macOS) | As a developer following `getting-started.md` / `mac-setup.md`, I see the macOS service option documented next to the existing Windows instructions, so that I don't have to reverse-engineer it from a shell history | should-have | 1 |
| systemd user-service install script | As a developer, I can run `npm run service:install` (or an equivalent `scripts/service-linux.sh`) on Linux, so that the telemetry backend starts automatically on login and restarts if it crashes, the same way it does on macOS/Windows | must-have | 2 |
| systemd uninstall/status scripts | As a developer, I can run `service:uninstall` / `service:status` / `service:restart` equivalents on Linux, so that I can manage the service the same way I already can on macOS/Windows | must-have | 2 |
| Headless / no-`systemd --user` lingering handling | As a developer running on a headless server or a minimal container/WSL-adjacent distro where `systemd --user` sessions don't linger past logout, I get a clear explanation and an `loginctl enable-linger` fallback, so that the service doesn't silently stop working after I disconnect | must-have | 2 |
| Setup docs (Linux) | As a developer following `getting-started.md` / `mac-setup.md`, I see the Linux service option documented next to the existing Windows and macOS instructions | should-have | 2 |

---

## Target Architecture

### Components

| Component | Type | New or Existing | Responsibility |
|-----------|------|-----------------|---------------|
| structured-telemetry-mcp | microservice | existing | Owns the launchd plist template and install/uninstall scripts for its own backend process |

### Integration Points

| From | To | Method | Contract |
|------|-----|--------|----------|
| macOS launchd (`gui/<uid>` domain) | `server-http.bundle.mjs` | process spawn (`ProgramArguments`) | Same CLI entrypoint the Windows service and `npm start` already use; no protocol change |
| Linux systemd (`--user` instance) | `server-http.bundle.mjs` | process spawn (`ExecStart`) | Same CLI entrypoint; no protocol change |

---

## Stack

| Concern | Decision |
|---------|----------|
| Language | Bash (install scripts) + XML plist (macOS) + systemd unit file (Linux) |
| Runtime | Node (already required by the project) |
| Framework | macOS `launchd` (user LaunchAgent, `gui/$(id -u)` domain) / Linux `systemd --user` (user unit, not a system-wide daemon — no root unit in `/etc/systemd/system/`) |
| Testing | Manual: macOS — `launchctl list`, `curl /health`, reboot/logout survival check. Linux — `systemctl --user status`, `curl /health`, logout/reboot survival check (requires lingering, see Constraints) |
| Build target | local (developer machine) |

---

## Scope Boundaries

### In Scope
- A `.plist` template for a **user** LaunchAgent (`~/Library/LaunchAgents/com.planifest.telemetry-mcp.plist`), `RunAtLoad` + `KeepAlive.SuccessfulExit: false` (restart on crash, not on clean stop). [Phase 1]
- A systemd **user** unit (`~/.config/systemd/user/planifest-telemetry-mcp.service`), `Restart=on-failure` (restart on crash, not on clean `systemctl --user stop`). [Phase 2]
- Install/uninstall/status/restart scripts mirroring the existing `scripts/service.ps1` command surface, for macOS (Phase 1) and Linux (Phase 2).
- Detection + clear error path for the case where `~/Library/LaunchAgents` is not user-writable (see Constraints) — this was hit on a real dev machine during initial manual setup. [Phase 1]
- Detection + clear guidance for the case where the Linux user session doesn't linger past logout (`loginctl show-user $USER | grep Linger`), so the service silently stops on disconnect otherwise. [Phase 2]
- Log file locations under `~/Library/Logs/` (macOS) / `journalctl --user -u planifest-telemetry-mcp` + optional log file (Linux).

### Out of Scope
- A system-level (root) launchd daemon or root-level systemd unit in `/etc/systemd/system/` — the backend is per-user, so a user-scoped service is correct on both platforms; do not build a system daemon variant.
- Changing the backend's default port (`3741`) or DB location (`~/.planifest/telemetry.db`) — both stay as-is.
- Distro-specific packaging (`.deb`/`.rpm`) — out of scope; the systemd unit is installed by a plain shell script, matching how the macOS/Windows scripts work.

### Deferred
- Auto-detecting and fixing a root-owned `~/Library/LaunchAgents` directory automatically. That's a machine-level security posture (possibly MDM-managed) that scripts should not silently override — deferred to "surface a clear error + manual `sudo` remediation" for now.
- Auto-enabling lingering (`loginctl enable-linger`) without asking — enabling linger has a system-wide effect (keeps the user's systemd instance running even with no active session) and typically requires privileges the developer's own account may not have on a shared/managed Linux box. Deferred to "explain + print the exact command" rather than running it automatically.

---

## Constraints and Assumptions

### Constraints
- Must not require `sudo`/root for the common case on either platform. `sudo` is only acceptable on macOS as a fallback when the target directory is not user-writable (confirmed to happen on at least one real machine in this fleet: `~/Library/LaunchAgents` was `drwxr-xr-x root:staff` instead of the normal user-owned directory). On Linux, root is never required for `systemctl --user` itself — only `loginctl enable-linger` touches anything privileged, and even that just needs the user's own polkit permission on most distros, not `sudo`.
- macOS: must use the `gui/$(id -u)` launchd domain (modern `launchctl bootstrap`/`bootout`), not the deprecated `launchctl load -w`.
- Linux: must use `systemctl --user` (a per-user systemd instance), not a system-wide unit under `/etc/systemd/system/`. Must not assume `systemd` is present at all — some distros/containers use other init systems; script should detect `systemctl`'s absence and fail with a clear "not supported on this system" message rather than a confusing error.
- Node path is not guaranteed on either platform — must resolve via `command -v node` / `which node` (Homebrew Intel `/usr/local/bin/node` vs Apple Silicon `/opt/homebrew/bin/node` on macOS; whatever's on `$PATH`, nvm, or a distro package on Linux) rather than hardcoding one path, matching how `mac-setup.md` §3 already handles this distinction for the npm global root.
- Linux lingering: without `loginctl enable-linger $USER`, the user's systemd instance (and anything running under it) is killed when the last session for that user logs out — meaning the backend would stop on SSH disconnect from a headless dev box. The install script must check `loginctl show-user $USER --property=Linger` and warn (not silently enable) if it's off.

### Assumptions
- The backend continues to read its port from `PLANIFEST_MCP_PORT` (default 3741) and its DB from `PLANIFEST_TELEMETRY_DB` (default `~/.planifest/telemetry.db`) — no unit/plist-level env override is required unless a developer wants a non-default port.
- Phase 2 (Linux) assumes a `systemd`-based distro (Ubuntu, Fedora, Debian, Arch, etc.) accessible as the primary Linux dev target; no testing has been done against non-systemd init systems (e.g. Alpine/OpenRC, some minimal containers) — flagged in Scenario Paths below.

---

## Scenario Paths

**Happy path (macOS, Phase 1):** Developer runs the install script once. It writes the plist to `~/Library/LaunchAgents/`, bootstraps it into the `gui/<uid>` domain, and the backend is immediately reachable at `http://localhost:3741/health`. It comes back up automatically after logout/reboot with no further action.

**Happy path (Linux, Phase 2):** Developer runs the install script once. It writes the unit file to `~/.config/systemd/user/planifest-telemetry-mcp.service`, runs `systemctl --user daemon-reload && systemctl --user enable --now planifest-telemetry-mcp`, and the backend is immediately reachable at `http://localhost:3741/health`. If lingering is already enabled, it also survives logout; if not, the script warns and explains `loginctl enable-linger`.

**First-run path (macOS):** `~/Library/LaunchAgents/` doesn't yet contain the plist (fresh machine). Script creates `~/Library/Logs/` if missing, writes the plist, bootstraps, verifies via `launchctl list` + a health-check curl with a short retry loop (cold start isn't instant).

**First-run path (Linux):** `~/.config/systemd/user/` doesn't exist yet (fresh machine). Script creates it, writes the unit, `daemon-reload`s, enables + starts it, verifies via `systemctl --user is-active` + a health-check curl with a short retry loop.

**Error / sad path (macOS):** `~/Library/LaunchAgents` is not writable by the current user (root-owned, as found in production use on 2026-07-04). The script must detect this via a pre-flight write test, print a clear explanation (this may be an intentional MDM/security control — don't silently `sudo` around it), and either (a) prompt for confirmation before using `sudo`, or (b) print the exact `sudo`-prefixed commands for the developer to run themselves and exit non-zero. Do not fail with a bare "permission denied" and no explanation.

**Error / sad path (Linux):** Two distinct failure modes to handle separately:
1. No `systemd` at all (e.g. some containers, Alpine/OpenRC): detect via `command -v systemctl` missing, print a clear "not supported on this init system" message, exit non-zero. Do not attempt a fallback init system in this feature.
2. `systemd` present but lingering disabled: service installs and runs fine in the current session, but would silently die on logout/SSH disconnect. Script must check this *after* successful install and print a clear warning + the exact `loginctl enable-linger $USER` command, rather than letting the developer discover it only after being surprised the backend went down.

**Cross-session continuity:** N/A for this feature — launchd/systemd themselves own the process lifecycle once installed; there's no mid-run state to recover across coding sessions.

---

## Non-Functional Requirements

| NFR | Target | Measurement |
|-----|--------|-------------|
| Reliability | Backend auto-restarts on crash, does not restart-loop on a clean/intentional stop | macOS: `KeepAlive.SuccessfulExit: false` verified manually. Linux: `Restart=on-failure` (not `always`) verified manually |
| Idempotency | Running the install script twice does not create duplicate services or error | macOS: `launchctl bootout` before `bootstrap` on re-install. Linux: `systemctl --user disable --now` before re-enabling on re-install |
| Survivability (Linux only) | Backend stays up after the developer's SSH session or GUI logout ends | `loginctl show-user $USER --property=Linger` is `yes`, or the install script has clearly warned that it isn't |

---

## Acceptance Criteria

### Phase 1 (macOS)
- [ ] `scripts/service-macos.sh install` (or equivalent) writes a valid user LaunchAgent plist and the backend is reachable at `/health` within a few seconds
- [ ] `scripts/service-macos.sh uninstall` / `status` / `restart` work, mirroring the Windows `service:*` npm scripts
- [ ] Script detects a non-writable `~/Library/LaunchAgents`, explains why (possible MDM/security lockdown), and offers a `sudo` fallback rather than failing opaquely
- [ ] `getting-started.md` / `mac-setup.md` documents the macOS service option alongside the existing Windows instructions
- [ ] Verified on both Intel (`/usr/local/bin/node`) and Apple Silicon (`/opt/homebrew/bin/node`) Homebrew layouts, or the script resolves the node path dynamically instead of assuming one

### Phase 2 (Linux)
- [ ] `scripts/service-linux.sh install` (or equivalent) writes a valid `systemd --user` unit and the backend is reachable at `/health` within a few seconds
- [ ] `scripts/service-linux.sh uninstall` / `status` / `restart` work, mirroring the Windows/macOS `service:*` scripts
- [ ] Script detects a missing `systemctl` and fails with a clear "not supported" message rather than a raw command-not-found error
- [ ] Script checks lingering after install and clearly warns (with the exact remediation command) if the service won't survive logout
- [ ] `getting-started.md` / `mac-setup.md` documents the Linux service option alongside the existing Windows and macOS instructions
- [ ] Verified on at least one systemd-based distro (e.g. Ubuntu); node path resolved dynamically rather than hardcoded

---

*This brief will be read by the orchestrator skill. See [planifest-framework/skills/planifest-orchestrator/SKILL.md](../../planifest-framework/skills/planifest-orchestrator/SKILL.md)*
