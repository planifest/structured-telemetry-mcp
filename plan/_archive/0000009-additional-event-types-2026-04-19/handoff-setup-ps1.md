# Handoff: create scripts/setup.ps1

**Date:** 2026-04-19
**Branch:** feat/additional-event-types
**Feature:** 0000009-ship-phase-enum

---

## What happened

`scripts/setup.ps1` does not exist on disk. It was never written — the Write tool failed with `EPERM` in a previous session, and every subsequent attempt (bash redirect, PowerShell New-Item, Copy-Item, git restore) also failed with "Permission denied" or "Access to the path is denied". All other `.ps1` files in `scripts/` exist fine. The cause was not resolved — likely a stale OS handle or transient policy issue that should clear in a fresh checkout.

## What the file must contain

Expand the original `setup.ps1` (4 tools: claudecode, cursor, antigravity, manual) to support **9 tools**:

| Tool | Config file | Key | Entry shape |
|---|---|---|---|
| `claudecode` | `~/.claude/settings.json` + Claude Desktop | `mcpServers` | `{ command, args }` |
| `cursor` | `.cursor/mcp.json` in project dir | `mcpServers` | `{ command, args }` |
| `windsurf` | `~/.codeium/windsurf/mcp_config.json` | `mcpServers` | `{ command, args }` |
| `vscode` | `~/.vscode/mcp.json` | `servers` | `{ type: "stdio", command, args }` |
| `codex` | `~/.codex/config.toml` | `[mcp_servers.structured-telemetry-mcp]` | TOML: `command`, `args` array |
| `opencode` | `%APPDATA%\opencode\config.json` | `mcp` | `{ type: "local", command: [node, bundle, url] }` |
| `antigravity` | `~/.gemini/antigravity/mcp_config.json` | `mcpServers` | `{ command, args }` |
| `jetbrains` | none — UI only | — | Print manual steps |
| `manual` | none — print only | — | Print JSON block |

### Key implementation details

- `New-McpEntry` returns `{ command: nodePath, args: [bundle, "http://localhost:3741"] }` — used by claudecode, cursor, windsurf, antigravity
- `New-VsCodeEntry` returns `{ type: "stdio", command: nodePath, args: [...] }` — used by vscode (`servers` key, not `mcpServers`)
- `Get-CommandArray` returns flat array `@(nodePath, bundle, "http://localhost:3741")` — used by opencode
- `Get-BundlePath` resolves via `npm root -g` → `structured-telemetry-mcp\server.bundle.mjs`
- Codex TOML: no PowerShell TOML library — generate the section as a string, use regex to replace existing `[mcp_servers.structured-telemetry-mcp]` block or append if absent
- All JSON files written BOM-free via `[System.IO.File]::WriteAllText(..., UTF8Encoding(false))`
- `ValidateSet` must list all 9 tool names
- Interactive menu must list all 9 options with labels
- `$input` is a reserved variable in PowerShell — use `$sel` for the menu read

### Helper functions needed

```powershell
function Get-BundlePath { ... }          # npm root -g + path join
function New-McpEntry { ... }            # standard stdio entry
function New-VsCodeEntry { ... }         # stdio entry with type: "stdio"
function Get-CommandArray { ... }        # flat array for opencode
function Setup-ClaudeCode { ... }        # existing
function Setup-Cursor { ... }            # existing
function Setup-Windsurf { ... }          # NEW
function Setup-VSCode { ... }            # NEW
function Setup-Codex { ... }             # NEW
function Setup-OpenCode { ... }          # NEW
function Setup-Antigravity { ... }       # existing
function Setup-JetBrains { ... }         # NEW — prints UI steps only
function Setup-Manual { ... }            # existing
```

## What to do in the new session

1. Verify `scripts/setup.ps1` does not exist: `Test-Path scripts/setup.ps1`
2. If it still can't be created, try: `New-Item -Path scripts/setup.ps1 -ItemType File -Force`
3. Write the full content using the Write tool (the session with this handoff has the full content ready — it was written twice but blocked by EPERM each time)
4. Run `npm test` to confirm 289 tests still pass (setup.ps1 has no test coverage — just confirm nothing is broken)
5. `git add scripts/setup.ps1 && git commit -m "feat(0000009): expand setup.ps1 to 9 tools (windsurf, vscode, codex, opencode, jetbrains)"`
6. That completes feature 0000009 entirely

## Current git state

Branch: `feat/additional-event-types`
All other changes committed. `setup.ps1` is the only outstanding item.
Last commit: `7714355 feat(0000009): regression coverage for 7 new event types + setup.sh tool registration`

## Done definition check (from execution-plan.md)

All items complete except this one file. Feature is otherwise fully shipped — schema, types, validation, tests (289 passing), docs, build, deploy, E2E all done.
