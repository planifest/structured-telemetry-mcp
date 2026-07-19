# Quirks — structured-telemetry-mcp

## 0000010-macos-launchd-service

- **No automated TDD for the macOS/Linux service scripts.** `plan/current/design.md`'s declared testing strategy for Scope A is manual (`launchctl list`/`systemctl --user status`, `curl /health`, reboot/logout survival check) — there is no shell-script test harness in this repo. `req-001`–`req-008` were implemented directly (dispatched to parallel sub-agents) rather than through the mandatory TDD red→green→refactor sub-agent loop that `req-009`–`req-012` (TypeScript) went through. Documented deviation, not an oversight.
- **`getting-started.md`/`mac-setup.md` don't exist.** `req-004`/`req-008` assumed these files already documented the Windows service alongside which macOS/Linux would be added — they don't exist anywhere in this repo, and the Windows `service.ps1` was entirely undocumented before this feature. Resolved by adding a new "Background Service" section to `README.md` covering all three platforms instead of inventing new top-level files.
- **`scripts/service-linux.sh` is untested against real systemd hardware.** No Linux machine was available during this feature's implementation (see `linux-systemd-reference.md`). Tracked as risk-register R-002 — must be verified on at least one real systemd distro before this is considered done.

## Pre-existing (surfaced by P4's library audit, not introduced by 0000010)

- **`ajv` (direct) is used for wire-schema validation**, which `planifest-framework/standards/library-standards/typescript/prefer-avoid.md` lists as avoided in favour of `zod`. This is a deliberate, documented exception: ADR-005 (`plan/0000008-mcp-server-foundation/adr/`) chose JSON Schema/`ajv` specifically because the schema must be shareable with the sibling `planifest-framework` repo without a TypeScript dependency — Zod schemas are TypeScript code and cannot be introspected by non-TypeScript tooling. ADR-013 (this feature) builds on and reaffirms that boundary rather than reopening it — Zod is used only as an MCP tool-argument gate, not as a wire-schema replacement.
