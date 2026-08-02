# Changelog — 0000016-e2e-playwright-test-suites — 02 Aug 2026

**Feature:** E2E Playwright Test Suites
**Pipeline run:** P0–P9 complete, no phases skipped
**PR:** {pending — updated after PR is raised}

## What Was Built

Two `@playwright/test` E2E suites give the MCP server's HTTP/browser surface its first true black-box test coverage:

- **Backend suite** (`tests/e2e/backend/`, 9 tests) — real HTTP requests against `/emit`, `/query`, `/health`, run against a real `server-http.ts` process on an OS-assigned ephemeral port and a fresh temp-file DuckDB per run.
- **UI suite** (`tests/e2e/ui/`, 8 tests) — a real Chromium browser driving the served `GET /ui` log-viewer page: load/render, every filter, pagination, zero-result state, and the row-click JSON detail view (confirmed to fire no extra network request).

Both suites run as a new blocking `e2e` job in CI (`.github/workflows/ci.yml`) on every PR, Chromium-only, combined runtime well under the 5-minute budget (measured ~3s). A vendored `playwright` capability skill was installed permanently for future use. The Playwright MCP server was evaluated for direct use in the suites but has no CI-execution model — it's scoped to interactive test-authoring/verification only (ADR-021), distinct from `@playwright/test`, which is the actual CI-executed framework.

## Artifacts Produced

Feature Brief, confirmed design, discovery pass, execution plan, scope, risk register (6 risks), domain glossary (7 terms), operational model, SLO definitions, cost model, 2 requirements (req-001, req-002), 4 ADRs (ADR-020–023), security report (Low risk, 0 open findings), 5 living-doc updates, 2 per-component doc updates, recommendations (4 items), iteration log.

## Decisions

- **ADR-020:** `@playwright/test` adopted as the E2E framework for both suites; Vitest unchanged for existing tests.
- **ADR-021:** Playwright MCP is an authoring/verification aid only (P3 codegen) — never part of the CI-executed runtime.
- **ADR-022:** Both suites use an ephemeral real-server-process + temp-DuckDB harness per run — genuine black-box coverage, isolated by construction.
- **ADR-023:** UI suite is Chromium-only — the framework-free vanilla-JS `/ui` page carries low cross-browser risk; keeps CI runtime within budget.

## Skipped Phases

None.
