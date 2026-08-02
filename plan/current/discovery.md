---
title: "Discovery - 0000017-log-viewer-enhancements"
summary: "Raw P0 discovery-pass findings — what the orchestrator knew before coaching began."
---
# Discovery - 0000017-log-viewer-enhancements

> Created at the start of P0, before the first coaching question.
> Raw findings only — decisions belong in `design.md`, the Q&A audit trail in `build-log.md`.

## Header (all modes)

| Field | Value |
|-------|-------|
| Adoption mode detected | `Standard Iterative` |
| Detection signal | `plan/_archive/` contains 9 prior feature directories (0000008 → 0000016); `docs/about.md` exists |
| Git pre-flight | branch `main`, clean working tree, confirmed up to date with `origin/main` earlier this session (GUTD) |
| Skills inbox | `planifest-framework/skills-inbox/` empty — nothing to process |

## Mode Findings

### Standard Iterative

- Current version (`docs/about.md`): `0.12.0` (also mirrored in `product.yml`, `versionPolicy: max-component-version`)
- Prior features (`plan/_archive/`):
  - `0000008-mcp-server-foundation` (2026-04-19)
  - `0000008c-bug-fixes-schema-and-query-extensions` (2026-04-19)
  - `0000009-additional-event-types` (2026-04-19)
  - `0000010-macos-launchd-service` (2026-07-19)
  - `0000011-defects-and-query-telemetry-fix` (2026-07-19)
  - `0000012-test-harness-and-sdk-audit` (2026-07-20)
  - `0000013-group-by-validation-fix` (2026-07-26)
  - `0000014-zero-result-scope-hint` (2026-07-27)
  - `0000015-telemetry-log-viewer-ui` (2026-08-01) — direct predecessor of this feature
  - `0000016-e2e-playwright-test-suites` (2026-08-02)
- Constraining ADRs (unless superseded):
  - `ADR-018-static-vanilla-js-ui-in-process` (0000015) — the log viewer UI is deliberately framework-free vanilla JS/DOM, in-process with the HTTP backend. Its own recommendations.md (REC-003) flags this decision for revisiting if UI scope grows meaningfully beyond the original 4 views — directly relevant to this feature's aggregation/dashboard item.
  - `ADR-016-event-log-bounding-limit-offset` (0000015) — offset pagination, accepted on the assumption of small local event volumes (REC-004 flags periodic re-check).
  - `ADR-017-product-id-additive-no-backfill` / `ADR-019-product-id-emission-cross-product-dependency` (0000015) — `product_id` filter values will still show "unknown" until backlog #00002 lands in the framework's own pipeline; affects the combobox-suggestion item if `product_id` is one of the filters getting suggestions.
- Component / data-ownership map (`docs/component-registry.md`, `docs/architecture-overview.md`): single component, `structured-telemetry-mcp`, owns the DuckDB event store and both the HTTP API and the `/ui` static page in-process (`server-http.ts`).
