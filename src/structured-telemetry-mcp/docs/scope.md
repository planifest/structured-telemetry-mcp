# Scope — structured-telemetry-mcp (component-scoped)

Component-scoped mirror of `plan/current/scope.md` (0000010). See that file for the full feature-level scope; this file tracks what the component itself is responsible for, cumulatively across all features it has shipped.

## In scope (cumulative, as of 0.10.0)

- `emit_event` / `query_telemetry` MCP tools, DuckDB storage, JSON Schema validation for all 25 event types (0000008, 0000008c, 0000009, 0000010).
- Setup/doctor CLI, build/bundle pipeline, CI platform matrix (0000008).
- Background service install/uninstall/status/restart — Windows (0000008-era, predates the Planifest pipeline for this repo), macOS + Linux (0000010).
- Human-only post-deployment truncation scripts (0000008c).

## Out of scope (cumulative)

- npm publish, remote hosting, a web dashboard, server-side loop detection, authentication/access control (0000008, restated 0000010).
- A system-level (root) service daemon on any platform (0000010, ADR-014).
- Distro-specific packaging (`.deb`/`.rpm`) for the Linux service (0000010).
- `ratchet_blocked` event type — not yet emitted by any framework skill (0000010, explicitly deferred as speculative).

## Deferred

- npm publish — blocked on a decision to make the package public.
- Plugin marketplace manifests — blocked on a marketplace listing decision.
- Auto-fixing a root-owned `~/Library/LaunchAgents` — blocked on human confirmation it's safe to override a possible MDM control (0000010).
- Auto-enabling `systemd` lingering — blocked on a human decision to accept an account-wide setting change (0000010).
