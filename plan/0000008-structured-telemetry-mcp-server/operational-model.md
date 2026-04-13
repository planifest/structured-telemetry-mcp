---
title: "Operational Model: 0000008-structured-telemetry-mcp-server"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
---

# Operational Model - 0000008-structured-telemetry-mcp-server

## Deployment

This is a local developer tool. There is no production environment, no on-call rotation, and no incident response process.

- **Process**: MCP server runs as a child process of the agent tool (Claude Code, Cursor, etc.) via stdio transport.
- **Lifecycle**: Started automatically when the agent tool launches; terminated when the agent session ends.
- **Data persistence**: DuckDB file at `~/.planifest/telemetry.db` (configurable via `PLANIFEST_TELEMETRY_DB`).
- **Restart**: The agent tool restarts the MCP server automatically on crash; no manual intervention required.

## Runbook Triggers

| Trigger | Action |
|---------|--------|
| `npm run doctor` reports MCP server not registered | Re-run `npm run setup` |
| `npm run doctor` reports DuckDB file unreadable | Check file permissions; delete and recreate if corrupted |
| `emit_event` returns storage errors | Check disk space; check DuckDB file is not locked by another process |
| p95 latency exceeds 5ms in CI | Investigate DuckDB write path; check for file lock contention on Windows |
| DuckDB file size exceeds 1GB | Archive or delete events older than 90 days using the DuckDB CLI: `DELETE FROM events WHERE timestamp < NOW() - INTERVAL 90 DAYS` |

## Alerting

Not applicable — local tool with no monitoring infrastructure.

## On-Call

Not applicable.

## Data Retention

No automated retention policy in v1. Recommended: manually archive or delete events older than 90 days. The `doctor` command reports current file size as an informational check.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PLANIFEST_TELEMETRY_DB` | `~/.planifest/telemetry.db` | Path to the DuckDB file |
