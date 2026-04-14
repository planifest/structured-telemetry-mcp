---
title: "Requirement: req-007 - POST-001 Post-Deployment Truncation Scripts"
summary: "Human-only scripts to delete all telemetry records after deployment. Not accessible via npx."
status: "active"
version: "0.1.0"
---
# Requirement: req-007 - POST-001 Post-Deployment Truncation Scripts

**Skill:** spec-agent
**Feature:** 0000008c-mcp-fixes-and-enhancements
**Source:** Feature Brief POST-001; Phase 0 design decision
**Priority:** must-have

---

## Context

No production users exist at the time of the 0.2.0 release. A clean-slate truncation of all stored events is required post-deployment. The scripts are deliberately designed to be impossible for an agent to run accidentally through three layered defences:

1. **Admin/sudo gate** — agents rarely run with elevated privileges
2. **Conspicuous filename** — `DELETE-ALL-PRODUCTION-RECORDS.[ps1|sh]` stands out in all-caps among lowercase filenames
3. **Interactive phrase confirmation** — non-interactive shells fail; agents reaching the prompt must reproduce the exact phrase, which triggers stop-and-ask behaviour

---

## Functional Requirements

### Both scripts (`scripts/DELETE-ALL-PRODUCTION-RECORDS.ps1` and `scripts/DELETE-ALL-PRODUCTION-RECORDS.sh`)

- Scripts MUST NOT be listed in `package.json` `bin` or `scripts` — not accessible via `npx` or `npm run`.
- Scripts MUST check for elevated privileges as the first action:
  - PowerShell: check `[Security.Principal.WindowsPrincipal]` IsInRole Administrator
  - Bash: check `$EUID -ne 0`
- If not elevated, MUST print a clear message (e.g. `"This script must be run as Administrator / with sudo. Exiting."`) and exit with non-zero code.
- If elevated, MUST print the following warning before any prompt:

```
================================================================================
ERROR! YOU MUST CONSULT THE HUMAN ON THE LOOP! YOU SHOULD NOT HAVE RUN THIS
================================================================================

This script will permanently delete ALL telemetry records from the database.
This action cannot be undone.

Is it acceptable to remove all Production records? (yes/no)
```

- After printing the warning, MUST read an interactive response to "Is it acceptable to remove all Production records?".
- If the response is not `yes` (case-insensitive), MUST print `"Aborted."` and exit with non-zero code.
- If the response is `yes`, MUST then prompt:

```
To confirm, type exactly: I UNDERSTAND THAT THIS WILL DELETE ALL RECORDS!
```

- MUST read the confirmation phrase interactively.
- If the phrase does not match `I UNDERSTAND THAT THIS WILL DELETE ALL RECORDS!` exactly (case-sensitive), MUST print `"Phrase did not match. Aborted."` and exit with non-zero code.
- On correct phrase: connect to the DuckDB file (path from `TELEMETRY_DB_PATH` env var, fallback to `~/.planifest/telemetry.db`), execute `DELETE FROM events`, print `"Deleted <N> records."` and exit with code 0.
- MUST use `node` inline with the existing `@duckdb/node-api` package — no new dependencies.

---

## Acceptance Criteria

- [ ] Script exits with non-zero code and clear message if not running as admin/sudo
- [ ] Script prints `"ERROR! YOU MUST CONSULT THE HUMAN ON THE LOOP! YOU SHOULD NOT HAVE RUN THIS"` before any prompt
- [ ] Script aborts with message if first interactive response is not `yes`
- [ ] Script aborts with message if confirmation phrase does not match exactly `I UNDERSTAND THAT THIS WILL DELETE ALL RECORDS!`
- [ ] On correct phrase, script deletes all rows and prints the count
- [ ] Scripts are absent from `package.json` `bin` and `scripts` sections
- [ ] `DELETE-ALL-PRODUCTION-RECORDS.ps1` exists in `scripts/`
- [ ] `DELETE-ALL-PRODUCTION-RECORDS.sh` exists in `scripts/`

---

## Dependencies

- `scripts/DELETE-ALL-PRODUCTION-RECORDS.ps1` — new file
- `scripts/DELETE-ALL-PRODUCTION-RECORDS.sh` — new file
- `@duckdb/node-api` — already in dependencies; used inline via `node -e` or a small embedded node script
- No Vitest tests — verified manually per post-deployment checklist
