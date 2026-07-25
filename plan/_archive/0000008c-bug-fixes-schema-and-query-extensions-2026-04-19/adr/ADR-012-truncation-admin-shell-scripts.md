---
title: "ADR-012: Post-Deployment Truncation as Admin-Gated Shell Scripts, Not CLI Subcommand"
summary: "The one-off post-deployment record truncation is delivered as standalone shell scripts requiring admin/sudo, not as a subcommand of the npx CLI, to prevent accidental or agent-driven execution."
status: "accepted"
version: "0.1.0"
---
# ADR-012 - Post-Deployment Truncation as Admin-Gated Shell Scripts, Not CLI Subcommand

**Skill:** adr-agent
**Tool:** Claude Code
**Model:** claude-sonnet-4-6
**Feature:** 0000008c-mcp-fixes-and-enhancements
**Component:** structured-telemetry-mcp
**Status:** accepted
**Date:** 2026-04-14

---

## Context

The 0.2.0 release requires a one-off truncation of all stored telemetry events post-deployment (no production users exist; clean slate required). The question is how to expose this operation: as a CLI subcommand accessible via `npx structured-telemetry-mcp truncate --confirm`, or as standalone shell scripts that are not part of the npm package's CLI surface.

The primary concern is agent safety: the MCP server runs alongside AI agents (Claude Code, Cursor, etc.) that have shell access. An agent that calls `emit_event` and `query_telemetry` by design could also call `npx structured-telemetry-mcp truncate` if it appeared in the CLI. Any `--confirm` flag can be trivially passed by an agent.

---

## Decision

The truncation operation is delivered as **two standalone shell scripts** (`scripts/DELETE-ALL-PRODUCTION-RECORDS.ps1` and `scripts/DELETE-ALL-PRODUCTION-RECORDS.sh`) with three layered defences against agent execution:

1. **Admin/sudo gate** — the script exits immediately with a clear message if not running as Administrator (Windows) or root (Unix). Agents run as standard users in virtually all deployment configurations.
2. **All-caps filename** — `DELETE-ALL-PRODUCTION-RECORDS` stands out visually among lowercase filenames in any file browser, IDE, or `ls` output. A deliberate social/visual signal.
3. **Interactive phrase confirmation** — after an initial yes/no prompt, the operator must type exactly `I UNDERSTAND THAT THIS WILL DELETE ALL RECORDS!` (case-sensitive). Non-interactive shells fail immediately. Agents that reach this prompt will almost certainly stop and ask the human, because reproducing the exact phrase would appear in the agent's output as a conspicuous action.

The scripts are absent from `package.json` `bin` and `scripts` — they are not accessible via `npx` or `npm run`.

The scripts also print `ERROR! YOU MUST CONSULT THE HUMAN ON THE LOOP! YOU SHOULD NOT HAVE RUN THIS` before any prompt, so that if an agent somehow reaches this point, the message appears in its output context and is likely to trigger a stop-and-escalate behaviour.

---

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| `npx structured-telemetry-mcp truncate --confirm` CLI subcommand | Convenient; follows existing CLI pattern | `--confirm` is trivially passable by any agent; no admin gate possible in Node.js cross-platform; agents routinely call CLI tools | Rejected — insufficient protection; agent could run it |
| `npx structured-telemetry-mcp truncate` with interactive stdin phrase | Phrases block non-interactive agents | Node.js interactive stdin is unreliable on Windows; still accessible via `npx` surface; no elevation check | Rejected — partial protection only; admin gate not achievable |
| Direct DuckDB SQL documented in runbook, no script | Requires DuckDB CLI installed; no accidental execution risk | Adds friction for human operator; error-prone to type manually | Rejected — user experience worse; human may make mistakes |
| Admin-gated shell scripts (chosen) | Three independent layers of defence; not on `npx` surface; admin requirement blocks agents | Two files to maintain (PS1 + sh); not cross-checked by CI | Accepted |

---

## Affected Components

| Component | Impact |
|-----------|--------|
| `structured-telemetry-mcp` | Two new files in `scripts/`: `DELETE-ALL-PRODUCTION-RECORDS.ps1` and `DELETE-ALL-PRODUCTION-RECORDS.sh`; `package.json` explicitly excludes them from `bin` and `scripts` |

---

## Consequences

**Positive:**
- Agent execution is effectively prevented by three independent layers — any one layer is likely sufficient; all three together is robust
- The all-caps filename serves as a permanent visual warning in the repo, even to humans unfamiliar with the context
- No new CLI surface — the npm package's API contract is unchanged

**Negative:**
- The human operator must have an elevated shell available; on some developer machines this requires switching to a different terminal session
- Two files to maintain (PowerShell + bash) rather than one cross-platform Node.js script
- Not testable via Vitest — correctness must be verified manually per the post-deployment checklist

**Risks:**
- A future automated script runner that targets all `.ps1` or `.sh` files in `scripts/` could execute the truncation script. The admin/sudo gate prevents non-elevated execution, but a runner operating with elevated privileges would proceed to the interactive prompt and fail there. Document explicitly in repo README that this script must never be included in any automated runner.
- If `TELEMETRY_DB_PATH` env var is unset and the fallback path differs from the deployed path, the script truncates the wrong file silently. Mitigated by printing the resolved path before any prompt.

---

## Related ADRs

- ADR-003 — MCP Transport stdio (superseded by ADR-008): establishes context that agents have shell access in the same environment as the MCP server
- ADR-009 — stdio proxy + HTTP backend: confirms deployment topology where agents run alongside the daemon on the same machine

---

## Supersedes

- None

## Superseded By

- None

---

*Generated by adr-agent. Path: `plan/current/adr/ADR-012-truncation-admin-shell-scripts.md`*
