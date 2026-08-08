---
title: "Discovery - 0000019-loopback-daemon-hardening"
summary: "Raw P0 discovery-pass findings — what the orchestrator knew before coaching began."
---
# Discovery - 0000019-loopback-daemon-hardening

> Created at the start of P0, before the first coaching question, in every adoption mode.
> Raw findings only — decisions belong in `design.md`, the Q&A audit trail in `build-log.md`.
> Unreadable signal: say so; coaching proceeds.

## Header (all modes)

| Field | Value |
|-------|-------|
| Adoption mode detected | `standard-iterative` |
| Detection signal | `plan/_archive/` populated (12 prior features); no `planifest-overrides/instructions/external-versioning.md` |
| Git pre-flight | `main` clean and level with `origin/main`; no stray local branches (three merged feature branches deleted this session); `feat/0000019-loopback-daemon-hardening` created from `main` at 9d26ae8 |
| Skills inbox | empty |

## Mode Findings

### Standard Iterative

- **Current version (`docs/about.md`):** `0.14.0` — set by `0000018-telemetry-data-integrity`, updated 08 Aug 2026.
  `product.yml` agrees (`version: 0.14.0`, `versionPolicy: max-component-version`, single component
  `structured-telemetry-mcp` at `0.14.0`). Declared product id present: `planifest-telemetry-mcp`.

- **Prior features (`plan/_archive/`):** 12 archived runs.

  | Feature | Date | One-liner |
  |---|---|---|
  | 0000008-mcp-server-foundation | 2026-04-19 | Initial MCP server, DuckDB store, stdio transport |
  | 0000008c-bug-fixes-schema-and-query-extensions | 2026-04-19 | Schema fixes, fourth query family |
  | 0000009-additional-event-types | 2026-04-19 | Ship phase enum, event type expansion |
  | 0000010-macos-launchd-service | 2026-07-19 | launchd/systemd service supervision, emit_event fix |
  | 0000011-defects-and-query-telemetry-fix | 2026-07-19 | query_telemetry argument schema |
  | 0000012-test-harness-and-sdk-audit | 2026-07-20 | Test harness, SDK audit |
  | 0000013-group-by-validation-fix | 2026-07-26 | group-by validation |
  | 0000014-zero-result-scope-hint | 2026-07-27 | Zero-result UX hint |
  | 0000015-telemetry-log-viewer-ui | 2026-08-01 | In-process vanilla-JS log viewer, product_id |
  | 0000016-e2e-playwright-test-suites | 2026-08-02 | Playwright E2E, product.yml introduced |
  | 0000017-log-viewer-enhancements | 2026-08-03 | Per-column sort, distinct-values, polling auto-refresh |
  | 0000018-telemetry-data-integrity | 2026-08-08 | Durability, verified backups, supervision circuit-breaker |

- **Constraining ADRs (unless superseded):** 31 accepted ADRs; next number is **ADR-032**.
  Directly binding on this feature's surface:

  | ADR | Constraint | Bearing on 0000019 |
  |---|---|---|
  | ADR-002 | DuckDB as storage engine | Error strings from the engine are the leak vector in 00011 |
  | ADR-003 / ADR-008 / ADR-009 | stdio transport; HTTP+SSE; stdio-proxy-over-HTTP backend | The daemon serves MCP clients *and* the UI — any auth scheme must not break the stdio proxy |
  | ADR-016 | event-log bounding via limit/offset | Precedent for how 00014's unbounded modes should be bounded |
  | ADR-018 | static vanilla-JS UI served in-process | `/ui` shares the daemon's origin — same-origin, so Origin/Host checks do not affect it |
  | ADR-024 | shared column allow-list for SQL safety | Existing validation precedent that 00010 should extend rather than duplicate |

- **Component / data-ownership map (`docs/`):** single component, `structured-telemetry-mcp`
  (`src/structured-telemetry-mcp/component.yml`), sole owner of `~/.planifest/telemetry.db`.
  Source surfaces in scope for this feature:

  | Path | Role | Entries touching it |
  |---|---|---|
  | `src/server-http.ts` (272 lines) | Loopback HTTP daemon: `/emit`, `/query`, `/ui` | 00011, 00012, 00013 |
  | `src/server-factory.ts` | Shared handler/dispatch construction | 00010 |
  | `src/query/failures.ts`, `src/query/tokens.ts` | Query modes with no `LIMIT` | 00014 |
  | `src/validation/` | Existing zod/JSON-schema gates | 00010, 00020 |

  Verified by inspection at P0: `src/server-http.ts` contains **zero** occurrences of `Origin`,
  `Host`, or `Authorization`, and no request-body byte cap. The MCP path has a `QueryShape` zod
  gate that the HTTP path bypasses.

## Signals That Could Not Be Determined

None — every signal above was read successfully.
