# Change Summary

**Feature:** 0000011-defects-and-query-telemetry-fix
**Route:** Change Pipeline (precedent: 0000009-ship-phase-enum)

Change request: "Next release should fix the outstanding emit bug [query_telemetry's R-009-class argument bug] and any other known defects." Human confirmed a 5-item scope during P0 coaching (3 further items deferred to `plan/backlog/`).

Interpretation: five targeted, independent fixes to the single existing component. No new components, no new stack choices, no new target users. Narrowest-interpretation approach per each item below.

Components affected: `structured-telemetry-mcp` (only component in this repo)

Contract changed: yes, for item 1 only — `query_telemetry`'s tool argument gains a real (permissive) Zod object schema in place of `z.unknown()`. **Non-breaking**: the new schema is `.passthrough()` with every known field optional, so every previously-valid call shape still validates; it only rejects the previously-broken non-object cases (string/null/array/undefined) that were never actually usable anyway. Unlike `emit_event`'s fix (ADR-013), no argument rename is needed — `query` has no name-collision problem, so this stays additive.

Schema changed: no (no DuckDB/data-contract schema change — item 1 is a tool-argument shape gate only, same category as ADR-013's; item 3 is docs-only, no schema).

Migration proposed: no.

Consumers affected: none known outside this repo. `planifest-framework` (sibling repo) calls `query_telemetry` the same way regardless of this fix — a well-formed call that worked before still works; a previously-broken call (string-serialized query) now works instead of failing, which is a strict improvement for any caller, not a break.

Blast radius: single component, no dependency graph fan-out (`docs/dependency-graph.md` confirms this repo has one component with no internal dependents).

## The 5 items

1. `query_telemetry` tool-argument schema fix (the core "outstanding emit bug" ask) — same root-cause pattern as R-009/ADR-013, confirmed broken by direct testing in the prior session.
2. XML/shell-escaping hardening in `scripts/service-macos.sh`'s `_generate_plist()` and `scripts/service-linux.sh`'s `ExecStart` line (Low severity, flagged in `0000010`'s security report).
3. Docs backfill: 12 event types from `0000009-ship-phase-enum` missing from `README.md` and `data-contract.md` (already fully documented in `docs/usage-guide.md`, used as the reference source).
4. Remove the stale `express`-dependency risk item from `component.yml` (confirmed unused, dead cruft).
5. Cross-platform deploy auto-restart — Windows' `deploy.ps1` already detects an installed service and restarts it; macOS/Linux have no equivalent, which is exactly the gotcha hit live in the prior session (had to manually `npm run service:restart` after shipping `0000010` for the fix to take effect). New `deploy` action added to `scripts/service-manager.mjs` giving macOS/Linux the same behavior.

Deferred to `plan/backlog/`: Linux real-hardware verification (00001), shell-script test harness (00002), `@modelcontextprotocol/sdk` transitive dependency advisories (00003).
