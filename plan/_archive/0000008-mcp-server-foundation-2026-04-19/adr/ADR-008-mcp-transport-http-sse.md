---
title: "ADR 008: MCP Transport — HTTP/SSE daemon"
summary: "Replaces stdio transport with a persistent HTTP/SSE daemon so all Claude Code sessions share one DuckDB writer. Superseded by ADR-009 when Claude Desktop rejected SSE config formats."
status: "superseded"
version: "0.1.0"
---
# ADR-008 - MCP Transport — HTTP/SSE Daemon

**Skill:** planifest-adr-agent
**Tool:** claude-code
**Model:** claude-sonnet-4-6
**Feature:** 0000008-structured-telemetry-mcp-server
**Component:** structured-telemetry-mcp
**Status:** superseded
**Date:** 2026-04-13

---

## Context

ADR-003 chose stdio transport on the assumption that one agent session = one server process = one DuckDB writer. This assumption failed in practice.

DuckDB enforces a **single-writer lock** at the OS file level. When multiple Claude Code windows are open (a normal workflow), each session spawned its own `server.bundle.mjs` process. The first process acquired the DB lock; subsequent processes crashed on `openDatabase()`. The crash was silently swallowed by the `uncaughtException` handler (which did not call `process.exit(1)`), leaving zombie server processes alive. Claude Code interpreted "process still running" as "connected", but the server had never completed the MCP handshake, so zero tools were registered in those sessions.

The root cause is **architectural**: stdio transport is incompatible with multi-session local development when the backing store enforces a single writer.

---

## Decision

Replace stdio transport with an **HTTP/SSE daemon**:

- `server.bundle.mjs` runs as a **persistent background process** — started once, shared by all sessions.
- Transport: `SSEServerTransport` from `@modelcontextprotocol/sdk/server/sse.js` via Express on `http://127.0.0.1:3741`.
- Each Claude Code session connects to `GET /sse`; each gets its own `SSEServerTransport` instance (and its own `McpServer`) but they all share the single `DuckDbEventRepository` / `DuckDbQueryService` backed by one open DuckDB connection.
- `.mcp.json` changes from `type: stdio` to `type: sse, url: http://localhost:3741/sse`.
- The daemon must be started manually before opening Claude Code: `npm start` (or `node server.bundle.mjs`).

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Keep stdio, switch to WAL mode | No daemon required | DuckDB WAL mode does not solve the single-writer limit; concurrent writers still fail | Does not fix the problem |
| Keep stdio, mutex on DB open | Predictable failure mode | One session gets the DB; all others silently have no tools — still broken | Same user-visible outcome |
| stdio + IPC gateway proxy | Sessions connect to a sidecar that owns the DB | High complexity, no standard pattern | Over-engineered |
| **HTTP/SSE daemon (chosen)** | One process, one DB connection, N sessions | Daemon must be started separately | Clean, standard MCP pattern |
| WebSocket | Same DB sharing benefit | Not yet standard in MCP ecosystem | Deferred |

---

## Affected Components

| Component | Change |
|-----------|--------|
| `src/server.ts` | Rewritten: Express app + `SSEServerTransport`; `GET /sse`, `POST /messages`, `GET /health` |
| `src/cli.ts` | `buildMcpEntry()` now emits `{ type: 'sse', url: 'http://localhost:PORT/sse' }`; doctor check pings `/health` instead of checking bundle path |
| `.mcp.json` | `type: "sse"`, `url: "http://localhost:3741/sse"` |
| `package.json` | `express` added to `dependencies`; `@types/express` to `devDependencies`; `start` script added; `--external:express` and `--banner:js` added to esbuild server bundle command |
| `plan/…/adr/ADR-003-mcp-transport-stdio.md` | Status set to `superseded` |

---

## Consequences

**Positive:**
- Any number of Claude Code sessions can be open simultaneously — all connect to the same daemon, all get tools registered correctly.
- Single DB connection eliminates lock contention entirely.
- `/health` endpoint makes daemon liveness trivially observable.
- `process.exit(1)` now in both `uncaughtException` and `unhandledRejection` handlers — daemon fails fast and visibly instead of silently zombying.

**Negative:**
- Developer must start the daemon before opening Claude Code. If the daemon is not running, `type: sse` sessions will fail to connect (clear error vs. silent stdio failure).
- Port 3741 must be free. Configurable via `PLANIFEST_MCP_PORT` env var.
- Daemon is not auto-restarted on crash — use `pm2` or a terminal session for persistence.

**Risks:**
- Port collision on shared dev machines (low probability on a personal port like 3741).
- Daemon left running with stale DB after schema migrations — mitigated by `npm run doctor` health check.

---

## Related ADRs

- ADR-001 — depends-on (Node.js + MCP SDK provide SSEServerTransport)
- ADR-002 — depends-on (DuckDB single-writer constraint is the forcing function)

## Supersedes

- ADR-003 — MCP Transport — stdio

## Superseded By

- ADR-009 — MCP Transport — stdio proxy + HTTP REST backend (Claude Desktop rejected both `type: sse` and `url`-only SSE config formats; `command + args` is universally supported)

---

*Generated by planifest-adr-agent. Path: `plan/current/adr/ADR-008-mcp-transport-http-sse.md`*
