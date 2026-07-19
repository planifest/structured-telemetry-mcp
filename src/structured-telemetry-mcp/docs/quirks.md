# Quirks — structured-telemetry-mcp

## 0000010-macos-launchd-service

- **No automated TDD for the macOS/Linux service scripts.** `plan/current/design.md`'s declared testing strategy for Scope A is manual (`launchctl list`/`systemctl --user status`, `curl /health`, reboot/logout survival check) — there is no shell-script test harness in this repo. `req-001`–`req-008` were implemented directly (dispatched to parallel sub-agents) rather than through the mandatory TDD red→green→refactor sub-agent loop that `req-009`–`req-012` (TypeScript) went through. Documented deviation, not an oversight.
- **`getting-started.md`/`mac-setup.md` don't exist.** `req-004`/`req-008` assumed these files already documented the Windows service alongside which macOS/Linux would be added — they don't exist anywhere in this repo, and the Windows `service.ps1` was entirely undocumented before this feature. Resolved by adding a new "Background Service" section to `README.md` covering all three platforms instead of inventing new top-level files.
- **`scripts/service-linux.sh` is untested against real systemd hardware.** No Linux machine was available during this feature's implementation (see `linux-systemd-reference.md`). Tracked as risk-register R-002 — must be verified on at least one real systemd distro before this is considered done.
