# Dependencies — structured-telemetry-mcp

## What this component consumes

Single-component repo — no dependencies on other components in this codebase.

**External (npm):**
- `@modelcontextprotocol/sdk` — MCP tool registration, stdio transport (ADR-001)
- `@duckdb/node-api` — storage engine (ADR-002)
- `ajv` / `ajv-formats` — JSON Schema wire validation (ADR-005)
- `zod` — `emit_event` tool-argument shape gate only (ADR-013); NOT used for wire-schema validation
- `@clack/prompts`, `picocolors` — setup/doctor CLI UX

**External (OS service supervisors, not npm):**
- macOS `launchd` (user-scoped LaunchAgent)
- Linux `systemd --user`
- Windows `nssm` (via `scripts/service.ps1`, predates this feature)

## What depends on this component

- **`planifest-framework`** (sibling repo, not a code dependency) — calls `emit_event`/`query_telemetry` from its own skills (`planifest-loop-runner`, phase-reversal protocol, and every phase agent's `phase_start`/`phase_end` emission). As of `0000010`, also emits the 4 new event types this feature added. As of `0000015`, this component expects (but does not require) `planifest-framework`'s hooks to eventually populate `product_id` on outgoing events — tracked as a cross-product backlog item (`plan/backlog/00002-framework-product-id-emission`), not a dependency this component enforces.
- **Any Planifest-compliant agent tool** (Claude Code, Cursor, etc.) — connects via MCP stdio to call the two tools directly.
- **A human's web browser** (0000015) — loads `GET /ui` and calls `POST /query` same-origin. Not a code dependency; no new package or protocol, just another HTTP client of the existing daemon.

No new npm dependencies were added by 0000015 — the Log Viewer UI is plain HTML/CSS/vanilla JS with zero new packages (ADR-018).

No new npm dependencies were added by 0000017 either — the new `sortField` param, `distinct_values` query mode, and UI auto-refresh/suggestions/sortable-headers work are all built from the existing DuckDB query layer and vanilla JS, zero new packages (ADR-024–027).

No other component in this repo, and no other repo with a code-level import, depends on `structured-telemetry-mcp`.
