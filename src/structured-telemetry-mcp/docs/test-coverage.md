# Test Coverage Summary — structured-telemetry-mcp

Snapshot at 0.10.0 (`0000010-macos-launchd-service`).

## Totals

| Category | Count |
|----------|-------|
| Unit (`tests/unit/`) | 122 |
| Integration (`tests/integration/`) | 60 |
| Regression (`tests/regression/`) | 135 |
| Performance (`tests/performance.test.ts`) | 1 |
| **Total** | **318** |

Baseline before this feature: 289 (as of the April 2026 / `0000009` commit). Growth this feature: +29 (test strengthening for req-009–012's error-message and old-shape-rejection coverage, plus new-event-type cases across the regression suite).

Performance gate: p95 < 100ms (CI-tolerant; Windows GH runners measured ~28ms p95) — unaffected by this feature's changes (Zod validation adds negligible in-process overhead).

## What's covered by automated tests (this feature)

- `emit_event` tool-argument schema shape (`EmitEventEnvelope` introspection via `z.toJSONSchema`) — `tests/unit/server-factory.test.ts`
- All 6 RCA reproduction cases (A–F) + old-argument-shape rejection — `tests/regression/emit-handler.test.ts`
- 4 new event types: valid-payload acceptance, missing-required-field rejection — `tests/regression/event-types.test.ts`, `tests/regression/cross-field-validation.test.ts`
- All 25 event types round-tripping through the real MCP handler — `tests/integration/emit-event.test.ts`

## What's covered by manual verification only (documented deviation, see `quirks.md`)

- `scripts/service-macos.sh` — `launchctl list`, `curl /health`, reboot/logout survival (per `plan/current/design.md`'s declared testing strategy; no shell-script test harness exists in this repo).
- `scripts/service-linux.sh` — same manual strategy, **and additionally untested against any real systemd hardware** (risk-register R-002) — the highest-priority open item from this feature.
