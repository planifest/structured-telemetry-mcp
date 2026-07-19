# Changelog — 0000011-defects-and-query-telemetry-fix — 19 Jul 2026

**Feature:** Defects and query_telemetry Fix
**Pipeline run:** Change Pipeline (precedent: `0000009-ship-phase-enum`) — Phase 1 Domain Context → Phase 2 Targeted Change → Phase 3 Validate → Phase 4 ADR Check → Phase 5 Documentation
**PR:** https://github.com/planifest/structured-telemetry-mcp/pull/6

## What Was Built

Five targeted fixes to `structured-telemetry-mcp`, scoped from an 8-item known-defects inventory compiled live during the prior session (after shipping `0000010`):

1. **`query_telemetry` tool-argument schema fix** — the core ask ("the outstanding emit bug"). Same root cause as R-009: `z.unknown()` gave calling models no structural schema. Fixed with `QueryShape`, a permissive Zod object (non-breaking, no argument rename — see ADR-015).
2. **Escaping hardening** in `service-macos.sh`'s plist generator and `service-linux.sh`'s `ExecStart` line (Low-severity, flagged in `0000010`'s security report).
3. **Docs backfill** — 12 event types in `README.md`, 7 in `data-contract.md` (the gap flagged in `0000010`'s tech-debt.md).
4. **Stale manifest cleanup** — dead `express` risk item and stale `stack.framework` field in `component.yml`.
5. **`npm run deploy`** — cross-platform build + auto-restart-if-active, closing the exact daemon-staleness gotcha hit while shipping `0000010`.

Three items deferred to `plan/backlog/` (00001 Linux hardware verification, 00002 shell-script test harness, 00003 SDK dependency advisories) — none of them fixable by a code-writing pipeline run.

## Artifacts Produced

- `plan/current/change-summary.md` (blast radius: single component, no dependents)
- `plan/current/adr/ADR-015-query-telemetry-tool-argument-schema.md`
- `docs/0000011--feature--defects-and-query-telemetry-fix.md`
- `plan/backlog/00001-linux-service-hardware-verification/entry.md`
- `plan/backlog/00002-shell-script-test-harness/entry.md`
- `plan/backlog/00003-mcp-sdk-transitive-dependency-advisories/entry.md`
- Updated: `docs/api-index.md`, `docs/decisions-index.md`, `docs/architecture-overview.md`, `docs/component-registry.md`, `docs/dependency-graph.md`, `component.yml`, `product.yml`, `package.json`

## Decisions

- **ADR-015:** `query_telemetry` gets the same argument-shape-gate treatment ADR-013 gave `emit_event`, but deliberately looser (`.passthrough()`, no `z.enum()`, no rename) — `dispatchQuery`'s existing validation remains the semantic source of truth.

## Validation

324/324 tests passing (up from 318), typecheck clean, build succeeds. `npm run deploy` tested live end-to-end (build → detect-active-service → restart → health check all confirmed working against the real running daemon).

## Skipped Phases

None. (Full P0–P9 Feature Pipeline phases — P1 Spec, P2 ADRs as a full artifact set, P5 Security as a standalone report, P7 Archive to `plan/_archive/` — do not apply to Change Pipeline runs; see routing rationale in `plan/0000011-defects-and-query-telemetry-fix/build-log.md`'s P0 entry.)
