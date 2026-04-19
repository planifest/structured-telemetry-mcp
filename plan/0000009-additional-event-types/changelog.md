# Changelog — 0000009-additional-event-types

## Shipped commits (branch: feat/additional-event-types)

| Commit | Description |
|---|---|
| `7714355` | feat(0000009): regression coverage for 7 new event types + setup.sh tool registration |
| `ccc5de2` | feat(0000009): expand setup.ps1 to 9 tools + deploy.ps1 admin guard |
| `49fbf11` | fix(deploy): update all nssm paths on redeploy (AppDirectory, AppStdout, AppStderr) |
| `26bbf88` | chore: remove plan/current (archived to plan/0000009-additional-event-types) |
| `bbb0a10` | docs: add usage-guide covering MCP tools, REST API, event schemas, query reference |

## Post-ship fixes included in this feature

### deploy.ps1 — admin guard
Fail-fast with a clear message if not running as Administrator, rather than
proceeding and producing confusing nssm access-denied errors midway through.

### deploy.ps1 — full nssm path update on redeploy
Previously only `Application` and `AppParameters` were updated on redeploy.
Now also updates `AppDirectory`, `AppStdout`, `AppStderr`, and creates the
`logs/` directory if absent. Prevents stale paths when the repo is moved.

### deploy.ps1 — em-dash encoding fix
`Write-Step` string contained a UTF-8 em dash (`—`) which PowerShell 5.1
misread as a curly close-quote (Windows-1252 byte `0x94`), breaking the
parser for the rest of the file. Replaced with a plain hyphen.

### docs/usage-guide.md
Full usage guide covering:
- MCP tool usage (`emit_event`, `query_telemetry`)
- REST API (`POST /emit`, `POST /query`, `GET /health`)
- Complete event envelope schema
- All 21 event types with data payload schemas
- Full query reference (bottlenecks, failures, token efficiency, event log)

## Scope note

Originally scoped as `0000009-ship-phase-enum` (adding `ship` to the phase enum).
Expanded to include 7 additional event types (REQ-022 through REQ-028), setup.ps1
expansion to 9 tools, and the usage guide. Renamed to `additional-event-types`
to reflect actual scope.
