---
title: "Discovery - 0000018-telemetry-data-integrity"
summary: "Raw P0 discovery-pass findings — what the orchestrator knew before coaching began."
---
# Discovery - 0000018-telemetry-data-integrity

> Created at the start of P0, before the first coaching question, in every adoption mode.
> Raw findings only — decisions belong in `design.md`, the Q&A audit trail in `build-log.md`.
> Unreadable signal: say so; coaching proceeds.

## Header (all modes)

| Field | Value |
|-------|-------|
| Adoption mode detected | `standard-iterative` |
| Detection signal | `plan/_archive/` contains 11 prior feature dirs AND `docs/about.md` exists (priority 2). `planifest-overrides/instructions/external-versioning.md` absent, so priority 1 does not apply. |
| Git pre-flight | Branch `feat/0000018-telemetry-data-integrity`, created from `main` and pushed to origin. `main` confirmed up to date earlier this session (fast-forwarded to `b3c5e10`, PR #12 merged). No uncommitted product changes; working tree clean. |
| Skills inbox | `planifest-framework/skills-inbox/` — empty |

## Mode Findings

### Standard Iterative

- **Current version (`docs/about.md`):** `0.13.0`. `product.yml` agrees (`version: 0.13.0`,
  `versionPolicy: max-component-version`, single component `structured-telemetry-mcp` at `0.13.0`),
  and takes precedence as the last-known version per ADR-002.

- **Prior features (`plan/_archive/`):** 11 archived runs —
  `0000008` mcp-server-foundation (2026-04-19), `0000008c` bug-fixes-schema-and-query-extensions,
  `0000009` additional-event-types, `0000010` macos-launchd-service (2026-07-19),
  `0000011` defects-and-query-telemetry-fix, `0000012` test-harness-and-sdk-audit,
  `0000013` group-by-validation-fix, `0000014` zero-result-scope-hint,
  `0000015` telemetry-log-viewer-ui (2026-08-01), `0000016` e2e-playwright-test-suites,
  `0000017` log-viewer-enhancements (2026-08-03, the release this feature remediates).

- **Constraining ADRs (unless superseded):** 27 ADRs exist. Those that directly bind this feature's
  four entries:

  | ADR | Binds | Note |
  |---|---|---|
  | ADR-002-storage-engine-duckdb | 00008, 00024 | DuckDB is the storage engine; its single-writer lock and WAL semantics are the root of the incident. Backup format choice must respect it. |
  | ADR-005-exit-zero-failure-mode | 00008 | Establishes exit-zero as the failure posture for hooks. The daemon currently does the opposite (`process.exit(1)` on `uncaughtException`), which produced the crash loop. Whether that ADR's principle should extend to the daemon is an open question for P2. |
  | ADR-014-macos-linux-service-supervision | 00019, 00008 | Defines launchd/systemd supervision. The false-success health check and the `KeepAlive` crash loop both sit inside this decision's surface. |
  | ADR-016-event-log-bounding-limit-offset | 00009 | Establishes limit/offset as the event-log bounding strategy. The pagination defect is a gap *within* this decision; a move to keyset pagination would supersede it and needs a new ADR. |
  | ADR-024-shared-column-allow-list-sql-safety | 00009 | The allow-list resolves `sortColumn`; any ORDER BY change must keep the identifier path inside it. |
  | ADR-025-event-log-per-column-sort | 00009 | Shipped per-column sort in 0000017; multiplied the pagination exposure across six sort fields. |
  | ADR-017-product-id-additive-no-backfill | 00008 | The `product_id` ALTER this decision produced is the exact WAL entry that cannot be replayed. |

- **Component / data-ownership map (`docs/`):** single component, `structured-telemetry-mcp`
  (`src/structured-telemetry-mcp/component.yml`). It owns the DuckDB store at
  `~/.planifest/telemetry.db` — sole writer, no shared-write concerns for this feature. Living docs
  present: `about.md`, `architecture-overview.md`, `component-registry.md`, `decisions-index.md`,
  `dependency-graph.md`, `api-index.md`, `usage-guide.md`.

  Source layout relevant to this feature: `src/db/` (schema, repository, connection —
  00008), `src/server-http.ts` (daemon lifecycle, exit handlers — 00008), `src/query/event-log.ts`
  (pagination — 00009), `scripts/service-manager.mjs` + `scripts/service-macos.sh` /
  `service-linux.sh` / `deploy.ps1` (deploy and restart — 00019). No existing backup module —
  00024 is net-new surface.

## Pre-existing state noted at discovery

- **Backlog:** 17 entries under `plan/backlog/`, all filed 2026-08-03 from the post-0.13.0 assessment,
  except `00001` and `00002` which predate it. Four are scoped into this feature (see design.md);
  the rest remain open.
- **Framework working tree:** `planifest-framework/` changes were committed separately at `0e37f04`
  per the Framework Update Policy (vendored dependency, not product code) before P0 began.
- **Live daemon:** healthy at `http://127.0.0.1:3741`, v0.13.0, running on a fresh database created
  2026-08-03T01:19Z after the incident. Serving `/ui` and ingesting events.
- **Signal that could not be determined:** none. All discovery signals were readable.
