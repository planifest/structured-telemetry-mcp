---
title: "Operational Model: 0000008-structured-telemetry-mcp-server"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
---

# Operational Model - 0000008-structured-telemetry-mcp-server

## Deployment

This is a local developer tool. There is no production environment, no on-call rotation, and no incident response process.

### Process Architecture

Two processes cooperate:

| Process | Entry point | Role |
|---------|-------------|------|
| **Backend service** | `server-http.bundle.mjs` | Owns the DuckDB connection. Exposes `POST /emit`, `POST /query`, `GET /health` on `http://127.0.0.1:3741`. Runs persistently as a Windows service. |
| **MCP stdio proxy** | `server.bundle.mjs <backendUrl>` | Spawned once per agent session by the agent tool (Claude Code, Claude Desktop, Cursor, etc.). Speaks MCP stdio transport to the host; forwards all emit/query calls to the backend via `fetch()`. No DuckDB dependency. |

This separation ensures exactly one DuckDB writer regardless of how many agent sessions are open.

### Lifecycle (recommended — Windows service via NSSM)

The backend service installs as a Windows service that starts automatically on boot and restarts on crash:

```powershell
.\scripts\deploy.ps1          # build + global install + install/update service (admin)
.\scripts\service.ps1 status  # show Windows service state + health check
.\scripts\service.ps1 restart # after config changes or bundle rebuild
.\scripts\service.ps1 uninstall # remove service
```

The service runs `server-http.bundle.mjs` from the repo root. Environment variables set by the service installer:

| Variable | Value |
|----------|-------|
| `PLANIFEST_TELEMETRY_DB` | Configured at install time (default `~/.planifest/telemetry.db`) |
| `PLANIFEST_MCP_PORT` | Configured at install time (default `3741`) |

### Lifecycle (dev/fallback)

```powershell
npm start   # runs server-http.bundle.mjs in the foreground — Ctrl+C to stop
```

### Agent tool registration

After the backend service is running, register the MCP stdio proxy with each agent tool:

```powershell
.\scripts\setup.ps1 -Tool claudecode    # writes command+args entry to ~/.claude/settings.json
                                        # and claude_desktop_config.json
.\scripts\setup.ps1 -Tool cursor        # writes to .cursor/mcp.json
.\scripts\setup.ps1 -Tool antigravity   # writes to ~/.gemini/antigravity/mcp_config.json
```

The registered entry points to `server.bundle.mjs` with the backend URL as an argument:

```json
{
  "command": "C:\\Program Files\\nodejs\\node.exe",
  "args": [
    "C:\\...\\node_modules\\structured-telemetry-mcp\\server.bundle.mjs",
    "http://localhost:3741"
  ]
}
```

- **Data persistence**: DuckDB file at `~/.planifest/telemetry.db` (configurable via `PLANIFEST_TELEMETRY_DB`). The backend service holds the sole write connection for its entire lifetime.
- **Restart**: On crash the backend exits immediately (`process.exit(1)`). The Windows service auto-restarts it.
- **Logs**: `logs/service.log` and `logs/service-error.log` (rotated daily, max 10 MB).
- **Health check**: `GET http://127.0.0.1:3741/health` → `{"ok":true,"version":"0.1.0"}`.

---

## Runbook Triggers

| Trigger | Action |
|---------|--------|
| `emit_event` returns `backend unreachable` | Backend service not running. Run `.\scripts\service.ps1 status`; if stopped: `.\scripts\service.ps1 restart` |
| `npm run doctor` reports bundle not found | Run `.\scripts\deploy.ps1` to rebuild and reinstall globally |
| Tools not appearing in agent tool | Confirm backend is healthy (`GET /health`); confirm `command+args` entry is in tool config (`setup.ps1`); restart the agent tool |
| `emit_event` returns storage errors | Check disk space; restart backend service to release any file handle |
| DuckDB file size exceeds 1GB | Archive or delete old events: `DELETE FROM events WHERE timestamp < NOW() - INTERVAL 90 DAYS` |
| Service installed but using wrong bundle | Run `.\scripts\deploy.ps1` — it updates NSSM `AppParameters` to `server-http.bundle.mjs` then restarts |

---

## Alerting

Not applicable — local tool with no monitoring infrastructure.

## On-Call

Not applicable.

## Data Retention

No automated retention policy in v1. Recommended: manually archive or delete events older than 90 days. The `doctor` command reports current file size as an informational check.

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PLANIFEST_TELEMETRY_DB` | `~/.planifest/telemetry.db` | Path to the DuckDB file. Read by the backend service only. |
| `PLANIFEST_MCP_PORT` | `3741` | Port the backend REST daemon listens on. |
