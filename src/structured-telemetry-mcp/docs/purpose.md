# Purpose — structured-telemetry-mcp

MCP server that ingests and queries structured telemetry events from Planifest pipeline runs.

## Why this component exists

Planifest-compliant agents (Claude Code, Cursor, etc., running Planifest skills) need somewhere to record structured facts about a pipeline run — phase timings, validation failures, context pressure, loop iterations, phase reversals — so a human or another agent can later analyse bottlenecks, retry loops, and token efficiency across sessions. Without this, that information exists only as unstructured transcript text, if at all.

`structured-telemetry-mcp` is that sink. It:
- Runs as a local MCP server alongside the developer's agent tool, exposing `emit_event` (write) and `query_telemetry` (read) as MCP tools.
- Persists every valid event to a local DuckDB store (`~/.planifest/telemetry.db`).
- Runs as a boot-surviving background service — Windows (`nssm`), macOS (`launchd`, user-scoped), Linux (`systemd --user`) — so it doesn't need a foreground terminal (`0000010-macos-launchd-service`).
- Serves a read-only browser UI (`GET /ui`) for browsing, filtering, and paging events without hand-writing a query (`0000015-telemetry-log-viewer-ui`) — its first human-facing surface beyond MCP tools and the CLI.

## Who uses it

- **Planifest agents**, via the `emit_event` MCP tool, at defined points in the pipeline (phase boundaries, validation failures, loop iterations, etc. — see `planifest-framework/standards/telemetry-standards.md`).
- **The human on the loop**, via the `query_telemetry` MCP tool or the `GET /ui` browser page, to analyse pipeline health across sessions.
- **`planifest-framework`** (a sibling repo, not a code dependency) is the primary framework-level consumer of the event contract.

## What it is not

See `component.yml`'s `exceptions` list and this component's `scope.md` (`src/structured-telemetry-mcp/docs/scope.md`) for the authoritative boundary. In short: it does not emit telemetry itself (sink, not source), does not detect loops server-side (query-side only, ADR-006), does not run in the cloud, does not authenticate callers (bound to `127.0.0.1`, no auth model), and its UI (0000015) does not provide aggregation/dashboard views, editing, or multi-user access — read-only raw event browsing only.
