---
title: "Requirement: REQ-007 - setup-cli"
summary: "Setup, doctor, postinstall scripts and build pipeline modelled on context-mode-mcp."
status: "active"
version: "0.1.0"
feature: "0000008-structured-telemetry-mcp-server"
stories: ["S1", "S2", "S3"]
---

# REQ-007 — Setup CLI and Build Pipeline

## Description

The server must be installable and runnable with minimal friction. The setup experience is modelled on context-mode-mcp. A CLI (`src/cli.ts`) provides `setup` and `doctor` commands. Scripts handle build, bundle, and postinstall. The package is npm-publishable (scaffolded but not published this pipeline run).

## CLI Commands

### `npm run setup` / `npx structured-telemetry-mcp setup`

Registers the MCP server in the agent tool configuration for the detected tool (Claude Code, Cursor, etc.). Modelled on context-mode-mcp's setup flow.

Steps:
1. Detect the active agentic tool (from environment or prompt).
2. Write the MCP server entry to the tool's config file (`.claude/settings.json`, `.cursor/mcp.json`, etc.).
3. Confirm the DuckDB data path (default: `~/.planifest/telemetry.db`, configurable via `PLANIFEST_TELEMETRY_DB` env var).
4. Print confirmation with next steps.

### `npm run doctor`

Diagnoses the installation:
1. Checks the MCP server entry exists in the tool config.
2. Checks the DuckDB file is accessible (or can be created).
3. Emits a test `phase_start` event and verifies it is stored.
4. Reports pass/fail for each check.

## Scripts

| File | Purpose |
|------|---------|
| `scripts/postinstall.mjs` | Runs on `npm install`; prints setup instructions |
| `scripts/build.ps1` | PowerShell build script for Windows |
| `scripts/build.sh` | Bash build script for macOS/Linux |
| `scripts/setup.ps1` | Planifest framework setup integration (called by `planifest/setup.ps1 --structured-telemetry-mcp`) |
| `scripts/setup.sh` | Bash equivalent |
| `scripts/version-sync.mjs` | Syncs version across package.json and any plugin manifests |

## Build Pipeline

```
tsc → esbuild src/server.ts → server.bundle.mjs   (MCP server bundle)
tsc → esbuild src/cli.ts   → cli.bundle.mjs       (CLI bundle)
```

The `server.bundle.mjs` is the file referenced in agent tool configs. It runs without any npm install.

## npm Package

- `bin.structured-telemetry-mcp`: `./cli.bundle.mjs`
- `files`: `build`, `server.bundle.mjs`, `cli.bundle.mjs`, `schemas`, `scripts/postinstall.mjs`, `README.md`, `LICENSE`
- `prepublishOnly`: `npm run build`
- npm publish: scaffolded, not executed this pipeline run

## Acceptance Criteria

- [ ] `npm run setup` successfully registers the server in at least Claude Code config.
- [ ] `npm run doctor` reports pass for a fresh install with no prior events.
- [ ] `npm run build` produces `server.bundle.mjs` and `cli.bundle.mjs`.
- [ ] `npm run dev` starts the MCP server via stdio transport.
- [ ] `scripts/postinstall.mjs` prints setup instructions without error.
- [ ] `scripts/setup.sh` and `scripts/setup.ps1` are executable and accept the `--structured-telemetry-mcp` flag.
- [ ] `package.json` is valid for npm publish (no private: true, correct files array, bin entry).
