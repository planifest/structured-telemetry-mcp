# Feature: 0000011 — Defects and query_telemetry Fix

**Version:** 0.10.1
**Date:** 2026-07-19
**Route:** Change Pipeline (precedent: `0000009-ship-phase-enum`)
**Branch:** feat/0000011-defects-and-query-telemetry-fix

Five targeted fixes to `structured-telemetry-mcp`, scoped from an 8-item known-defects inventory compiled after shipping `0000010`. Three items deferred to `plan/backlog/` (00001–00003).

---

## What Changed

### `query_telemetry` tool-argument schema fix (ADR-015)

Confirmed by direct testing after `0000010` shipped: `query_telemetry` had the identical root cause as R-009 (`emit_event`'s pre-fix bug) — its `query` MCP tool argument was `z.unknown()`, and well-formed queries (`{"mode":"event_log",...}`, `{"group_by":"phase"}`) failed with `dispatchQuery`'s generic `"Unrecognised query shape"` error.

Fixed with `QueryShape`, a permissive `.passthrough()` Zod object — deliberately looser than `emit_event`'s `EmitEventEnvelope` (no `.strict()`, no `z.enum()` for `mode`/`group_by`) because query shapes genuinely vary across four query families and `dispatchQuery` already validates them correctly. **Non-breaking** — no argument rename, every previously-valid call shape still works.

### Escaping hardening

`scripts/service-macos.sh`'s `_generate_plist()` now XML-escapes interpolated paths (node binary, bundle, log paths). `scripts/service-linux.sh`'s `ExecStart` line now quotes its command and argument. Both were flagged Low severity in `0000010`'s security report — not remotely exploitable, but real correctness bugs for paths containing `&`/`<`/`>`/spaces.

### Docs backfill

`README.md` gained all 12 event types added between 0.2.0–0.3.0 (previously stopped documenting at `self_correction`). `data-contract.md` gained the 7 types from `0000009` it was still missing (the 5 from 0.2.0 were already present).

### Stale manifest cleanup

Removed a dead `express` risk item from `component.yml`'s risk list, and fixed `stack.framework` (also stale `"express"` — the backend was rewritten to Node's raw `http.createServer` at some point, but the manifest field was never updated to match).

### `npm run deploy` (cross-platform auto-restart)

The exact gotcha hit while shipping `0000010`: the running backend daemon caches its compiled Zod/ajv validators at process start, so a code fix on disk does nothing until the process reloads. Windows' `scripts/deploy.ps1` already detected an installed service and restarted it automatically; macOS/Linux had no equivalent — `npm run build` and `npm run service:restart` were two separate manual steps. `npm run deploy` (new `deploy` action on `scripts/service-manager.mjs`) now builds, then restarts the service if one is currently active — tested live end-to-end this session (build → detect-active → restart → health check, all confirmed working).

---

## Files Changed

| File | Change |
|---|---|
| `src/server-factory.ts` | `QueryShape` Zod schema (exported); `query_telemetry` argument gains a shape gate before `dispatchQuery` |
| `tests/unit/server-factory.test.ts` | `QueryShape` introspection test + malformed-shape rejection tests (req-0000011-01) |
| `scripts/service-macos.sh` | `xml_escape()` helper; applied to `_generate_plist()`'s interpolated paths |
| `scripts/service-linux.sh` | `ExecStart` command+args quoted |
| `README.md` | 12 event types backfilled; `npm run deploy` documented |
| `src/structured-telemetry-mcp/docs/data-contract.md` | 7 event types backfilled (0000009 batch) |
| `src/structured-telemetry-mcp/docs/tech-debt.md` | Resolved items marked |
| `src/structured-telemetry-mcp/component.yml` | `express` risk item + stale `stack.framework` removed/fixed; version 0.10.0 → 0.10.1; scope/contract/responsibilities updated |
| `scripts/service-manager.mjs` | New `deploy` action (build + conditional restart) |
| `package.json` | New `deploy` script; version bump |
| `product.yml` | Version bump, feature field |
| `plan/current/adr/ADR-015-query-telemetry-tool-argument-schema.md` | New — extends ADR-013 |
| `plan/backlog/00001–00003/` | 3 deferred items filed |

---

## Deferred (see `plan/backlog/`)

- **00001** — Linux service verification on real systemd hardware (needs physical/VM access, not a code fix).
- **00002** — Shell-script test harness (`bats`/`shunit2`) for the service scripts.
- **00003** — `@modelcontextprotocol/sdk` transitive dependency advisories (`hono`, `qs`, `ip-address`) — inherited, not this repo's own code.

---

## Security Note

No new attack surface. `QueryShape` and the escaping fixes are both strictly-defensive changes (tightening validation / fixing a Low-severity correctness gap already documented in `0000010`'s `security-report.md`). `npm run deploy`'s `spawnSync` calls use array arguments without `shell: true`, matching the already-reviewed pattern in `service-manager.mjs`'s existing actions — no injection risk. Full STRIDE re-assessment not repeated for this Change Pipeline run (see `0000010`'s security report for the baseline; nothing in this change alters that posture).
