---
title: "ADR 009: MCP Transport — stdio proxy + HTTP REST backend"
summary: "Each agent session spawns a lightweight stdio MCP proxy. All DB operations are forwarded via HTTP to a single persistent REST backend that owns the DuckDB connection."
status: "accepted"
version: "0.1.0"
---
# ADR-009 - MCP Transport — stdio proxy + HTTP REST backend

**Skill:** planifest-adr-agent
**Tool:** claude-code
**Model:** claude-sonnet-4-6
**Feature:** 0000008-structured-telemetry-mcp-server
**Component:** structured-telemetry-mcp
**Status:** accepted
**Date:** 2026-04-13

---

## Context

ADR-008 replaced stdio with a pure HTTP/SSE daemon to solve the DuckDB single-writer lock. That decision introduced a new problem: agent tool compatibility.

Claude Desktop (and Cursor in project config) require a `command + args` MCP entry — they do not support SSE-type entries in their config files. Both `{ "type": "sse", "url": "..." }` and `{ "url": "..." }` were rejected by Claude Desktop as "not valid MCP server configurations". The `command + args` format is the only format that works universally across Claude Code, Claude Desktop, Cursor, and Antigravity.

Reverting to pure stdio (ADR-003) would reintroduce the DuckDB lock contention problem, since each session would again open the DB directly.

The solution is to **separate the two concerns**:
- **MCP transport** (how the agent host talks to the server) → stdio, using `command + args` — universally compatible.
- **DB access** (how the server talks to DuckDB) → HTTP, through a single persistent backend process.

---

## Decision

Adopt a **two-process architecture**:

### Backend service (`server-http.bundle.mjs`)
- Runs as a persistent Windows service (NSSM).
- Owns the single DuckDB connection for its entire lifetime.
- Exposes a plain HTTP REST API (no MCP protocol):
  - `GET  /health` → `{ ok, version }`
  - `POST /emit`   → writes one telemetry event; returns `WriteResult | WriteError`
  - `POST /query`  → dispatches to bottlenecks / failures / token-efficiency; returns `QueryResponse`
- Port configurable via `PLANIFEST_MCP_PORT` (default `3741`).

### MCP stdio proxy (`server.bundle.mjs <backendUrl>`)
- Spawned once per agent session by the agent host (Claude Code, Claude Desktop, Cursor, etc.).
- Implements `StdioServerTransport` — communicates with the host over stdin/stdout.
- Has **no DuckDB dependency**. All `emit_event` and `query_telemetry` tool calls forward to the backend via `fetch()`.
- Backend URL passed as `process.argv[2]` (default `http://localhost:3741`). This makes the URL explicit in the config entry and allows non-default ports without environment variables.
- Registered via `command + args` in every agent tool's config:

```json
{
  "command": "C:\\Program Files\\nodejs\\node.exe",
  "args": [
    "C:\\...\\node_modules\\structured-telemetry-mcp\\server.bundle.mjs",
    "http://localhost:3741"
  ]
}
```

### HTTP implementations of internal interfaces
- `HttpEventRepository` implements `IEventRepository` — `write()` calls `POST /emit`.
- `HttpQueryService` implements `IQueryService` — `bottlenecks()`, `failures()`, `tokenEfficiency()` each call `POST /query`.
- `createServer()` receives these HTTP implementations identically to the DuckDB implementations — no change to the server factory or tool handlers.

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Pure SSE daemon (ADR-008) | Single process | Claude Desktop rejects SSE config; forces users to register via UI Connectors panel | Not universally compatible |
| Pure stdio with DuckDB WAL | Simple config | DuckDB WAL does not resolve single-writer limit | Does not fix the problem |
| Pure stdio with DB mutex / retry | Predictable failure | One session holds DB; all others silently have no tools | Same broken user outcome |
| **stdio proxy + HTTP REST backend (chosen)** | Universal `command+args` config; single DB writer; clean interface separation | Two bundles to deploy; backend must be running before agent tool starts | Best combination of compatibility and correctness |

---

## Affected Components

| Component | Change |
|-----------|--------|
| `src/server.ts` | Thin stdio MCP proxy. Reads backend URL from `process.argv[2]`. No DuckDB imports. |
| `src/server-http.ts` | New. HTTP REST backend. Owns DuckDB. Exposes `/health`, `/emit`, `/query`. |
| `src/http-repo.ts` | New. `HttpEventRepository` — `IEventRepository` over HTTP. |
| `src/http-query-service.ts` | New. `HttpQueryService` — `IQueryService` over HTTP. |
| `src/cli.ts` | `buildMcpEntry()` emits `{ command, args: [bundle, backendUrl] }`. Doctor checks bundle exists, not daemon reachable. |
| `package.json` | `server-http.bundle.mjs` added to bundle script and `files`. `express` removed (backend uses Node's `http` module). `start` script targets `server-http.bundle.mjs`. |
| `scripts/service.ps1` | `$Bundle` updated to `server-http.bundle.mjs`. |
| `scripts/deploy.ps1` | Updates NSSM `AppParameters` to `server-http.bundle.mjs` before restarting existing service. |
| `scripts/setup.ps1` | `New-McpEntry` emits `{ command, args: [bundle, url] }` — no env, no `type: sse`. Works for Claude Code and Claude Desktop. |
| `.mcp.json` | `{ "command": "node", "args": ["server.bundle.mjs", "http://localhost:3741"] }` |

---

## Consequences

**Positive:**
- `command + args` config is accepted by every agent tool without modification.
- Any number of sessions can be open simultaneously — all proxies call one backend, one DB writer.
- The stdio proxy has zero DuckDB dependency — it is small, fast to start, and cannot cause DB lock contention.
- HTTP interface between proxy and backend is independently testable.
- Backend can be upgraded or restarted without reconfiguring any agent tool.

**Negative:**
- Two bundles to build and deploy (`server.bundle.mjs` and `server-http.bundle.mjs`).
- Backend must be running before any agent session can use the tools (`emit_event` returns `backend unreachable` otherwise — clear error, not silent failure).
- An additional network hop (loopback) per tool call — negligible latency in practice.

**Risks:**
- If the backend crashes and the Windows service fails to restart, all sessions lose telemetry until it recovers. Mitigated by NSSM auto-restart.

---

## Related ADRs

- ADR-001 — depends-on (Node.js + MCP SDK provide `StdioServerTransport`)
- ADR-002 — depends-on (DuckDB single-writer constraint is the forcing function)
- ADR-003 — stdio transport reinstated at the agent boundary
- ADR-008 — superseded (pure SSE daemon incompatible with Claude Desktop config format)

## Supersedes

- ADR-008 — MCP Transport — HTTP/SSE daemon

## Superseded By

- none

---

*Generated by planifest-adr-agent. Path: `plan/0000008-structured-telemetry-mcp-server/adr/ADR-009-mcp-transport-stdio-proxy-http-backend.md`*
