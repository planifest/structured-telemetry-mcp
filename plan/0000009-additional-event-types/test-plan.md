# Test Plan — 0000009-ship-phase-enum

**Date:** 2026-04-18
**Feature ID:** 0000009-ship-phase-enum

---

## Automated Tests (run via `npm test`)

All automated tests use isolated temp DBs in `os.tmpdir()`. None touch the live daemon or `~/.planifest/telemetry.db`. Results are stdout-only — no persistent artifact. Run command: `npx vitest run --reporter=verbose`.

### Unit — `tests/unit/validation.test.ts`

Tests `validateEvent()` in isolation (no DB, no server).

**Existing coverage (must continue to pass):**
- Valid events for all 14 existing event types accepted
- Invalid/missing required fields rejected with structured errors
- Cross-field validation: `event` type matched against required `data` fields
- Phase enum: all 8 existing values accepted; unknown values rejected
- `mcp_mode` enum validation
- `schema_version` const validation

**New coverage required by this feature:**
- `phase: "ship"` accepted on a valid `phase_start` event (REQ-021)
- `phase: "change"` still accepted — regression (REQ-021)
- For each of REQ-022–028: one valid payload accepted; one payload with each required field missing rejected

| Req | Event type | Required fields to test missing |
|-----|-----------|--------------------------------|
| REQ-022 | `context_reset` | `phase_name`, `reason` |
| REQ-023 | `approval_requested` | `phase_name`, `subject`, `action_id` |
| REQ-024 | `fast_path_engaged` | `change_type`, `reason` |
| REQ-025 | `test_failure` | `test_name`, `phase_name`, `attempt_number`; also: valid with optional `error_summary` |
| REQ-026 | `performance_regression` | `metric`, `threshold`, `actual`, `phase_name` |
| REQ-027 | `dependency_blocked` | `phase_name`, `dependency`, `reason` |
| REQ-028 | `schema_migration_applied` | `component_id`, `migration_path`, `destructive` |

---

### Unit — `tests/unit/server-factory.test.ts`

Tests `createEmitEventHandler` and `createQueryTelemetryHandler` with mock repo and query service.

**Existing coverage (must continue to pass):**
- `dispatchQuery` routing: all group_by values, all failure/token-efficiency modes, event_log, BUG-002/003 session_id guards
- `createEmitEventHandler`: invalid event → ok:false without repo.write; valid event → ok:true + repo.write called; repo.write error surfaced
- `createQueryTelemetryHandler`: valid query → formatted sections; unrecognised query → ok:false; service throws → ok:false; BigInt serialised

**New coverage required by this feature:**
- At least one new event type (e.g. `context_reset`) submitted through `createEmitEventHandler` with a valid payload → `ok: true`, `repo.write` called once
- At least one new event type submitted with a missing required field → `ok: false`, `repo.write` not called

---

### Unit — `tests/unit/format-results.test.ts`

Markdown/JSON formatting of query results. No changes required by this feature — must continue to pass.

---

### Integration — `tests/integration/emit-event.test.ts`

Tests `validateEvent` → `DuckDbEventRepository.write` against a real DuckDB instance (temp file).

**Existing coverage (must continue to pass):**
- Valid `phase_start` event written and retrievable
- Invalid events rejected before write

**New coverage required by this feature:**
- At least one new event type (e.g. `context_reset`) written successfully and retrieved by `findById`
- Confirm stored row matches the submitted payload

---

### Integration — `tests/integration/query-telemetry.test.ts`

Tests all query families against a seeded temp DuckDB. No changes required by this feature — new event types are stored and visible via `event_log` automatically. Must continue to pass.

---

### Integration — `tests/integration/query-empty.test.ts`

Cold-start safety: all query modes on an empty DB return gracefully. No changes required. Must continue to pass.

---

### Performance — `tests/performance.test.ts`

1000 sequential writes to a temp DuckDB. Gate: p95 < 100ms. No changes required. Must continue to pass.

---

## Manual E2E Tests (against live daemon at `127.0.0.1:3741`)

Run after `build.ps1` + `deploy.ps1`. Daemon must be running (verify with `structured-telemetry-mcp doctor`).

### Setup

```powershell
$base = @{ schema_version = "1.0"; session_id = "e2e-test-ship"; agent = "planifest-test"; tool = "manual"; model = "test"; mcp_mode = "none"; timestamp = (Get-Date -Format "o") }
function Emit($body) { Invoke-RestMethod -Uri http://127.0.0.1:3741/emit -Method Post -ContentType "application/json" -Body ($body | ConvertTo-Json -Depth 5) }
```

### E2E-001 — phase: "ship" accepted (REQ-021)

```powershell
Emit ($base + @{ event = "phase_start"; phase = "ship"; data = @{ phase_name = "ship" } })
# Expected: ok = true
```

### E2E-002 — phase: "change" regression (REQ-021)

```powershell
Emit ($base + @{ event = "phase_start"; phase = "change"; data = @{ phase_name = "change" } })
# Expected: ok = true
```

### E2E-003 — context_reset valid (REQ-022)

```powershell
Emit ($base + @{ event = "context_reset"; phase = "codegen"; data = @{ phase_name = "codegen"; reason = "compaction" } })
# Expected: ok = true
```

### E2E-004 — context_reset missing reason (REQ-022)

```powershell
Emit ($base + @{ event = "context_reset"; phase = "codegen"; data = @{ phase_name = "codegen" } })
# Expected: ok = false, errors present
```

### E2E-005 — approval_requested valid (REQ-023)

```powershell
Emit ($base + @{ event = "approval_requested"; phase = "codegen"; data = @{ phase_name = "codegen"; subject = "drop column users.token"; action_id = "mig-003" } })
# Expected: ok = true
```

### E2E-006 — fast_path_engaged valid (REQ-024)

```powershell
Emit ($base + @{ event = "fast_path_engaged"; phase = "orchestrator"; data = @{ change_type = "bug-fix"; reason = "isolated pure-function fix" } })
# Expected: ok = true
```

### E2E-007 — test_failure valid with optional error_summary (REQ-025)

```powershell
Emit ($base + @{ event = "test_failure"; phase = "validate"; data = @{ test_name = "should return 404 for unknown id"; phase_name = "validate"; attempt_number = 1; error_summary = "expected 404, got 200" } })
# Expected: ok = true
```

### E2E-008 — test_failure valid without optional error_summary (REQ-025)

```powershell
Emit ($base + @{ event = "test_failure"; phase = "validate"; data = @{ test_name = "should return 404 for unknown id"; phase_name = "validate"; attempt_number = 1 } })
# Expected: ok = true
```

### E2E-009 — performance_regression valid (REQ-026)

```powershell
Emit ($base + @{ event = "performance_regression"; phase = "validate"; data = @{ metric = "p95_latency_ms"; threshold = 50; actual = 73.4; phase_name = "validate" } })
# Expected: ok = true
```

### E2E-010 — dependency_blocked valid (REQ-027)

```powershell
Emit ($base + @{ event = "dependency_blocked"; phase = "codegen"; data = @{ phase_name = "codegen"; dependency = "human: approve migration"; reason = "destructive op requires consent" } })
# Expected: ok = true
```

### E2E-011 — schema_migration_applied valid (REQ-028)

```powershell
Emit ($base + @{ event = "schema_migration_applied"; phase = "codegen"; data = @{ component_id = "auth-service"; migration_path = "migrations/0003-add-token.sql"; destructive = $false } })
# Expected: ok = true
```

### E2E-012 — schema_migration_applied destructive: true (REQ-028)

```powershell
Emit ($base + @{ event = "schema_migration_applied"; phase = "codegen"; data = @{ component_id = "auth-service"; migration_path = "migrations/0004-drop-legacy.sql"; destructive = $true } })
# Expected: ok = true
```

### E2E-013 — unknown event type rejected

```powershell
Emit ($base + @{ event = "not_a_real_event"; phase = "codegen"; data = @{} })
# Expected: ok = false, errors present
```

### E2E-014 — event_log query returns ship-phase events

```powershell
# Note: /query takes the query shape directly as the body — no "query" wrapper
Invoke-RestMethod -Uri http://127.0.0.1:3741/query -Method Post -ContentType "application/json" -Body '{"mode":"event_log","session_id":"e2e-test-ship"}'
# Expected: results include the phase_start event with phase = "ship" from E2E-001
```

### E2E-015 — all 14 existing event types still accepted (regression)

Re-run the existing 14-type suite from feature 0008c to confirm no regressions. All must return `ok = true`.

---

## Manual Script Tests (deploy.ps1 / setup.ps1)

### SCRIPT-001 — deploy.ps1 fails cleanly without admin

**Date:** 2026-04-19  
**Result:** PASS

```
PS> .\scripts\deploy.ps1
  ERR This script requires administrator privileges.
      Right-click PowerShell and choose 'Run as Administrator'.
```

### SCRIPT-002 — deploy.ps1 succeeds with admin

**Date:** 2026-04-19  
**Result:** PASS

```
PS (admin)> .\scripts\deploy.ps1
  >> Build artifacts verified
  >> Running npm install -g ...
  OK  structured-telemetry-mcp installed at ...\npm\structured-telemetry-mcp.ps1
  >> Service already installed - updating bundle path and restarting...
  OK  Service updated and restarted.
Done.
  Next: .\scripts\setup.ps1 -Tool <tool>
```

---

## Pass Criteria

| Layer | Gate |
|-------|------|
| Unit (validation) | All existing + new cases pass |
| Unit (server-factory) | All existing + new handler cases pass |
| Unit (format-results) | All existing cases pass (no change) |
| Integration (emit) | All existing + new type write/retrieve cases pass |
| Integration (query) | All existing cases pass (no change) |
| Integration (empty) | All existing cases pass (no change) |
| Performance | p95 < 100ms over 1000 iterations |
| E2E | E2E-001 through E2E-015 all return expected results |
