---
title: "Feature Brief - E2E Playwright Test Suites"
summary: "Two Playwright-based end-to-end test suites: backend HTTP layer and the log-viewer UI."
status: "approved"
version: "0.1.0"
---
# Feature Brief - E2E Playwright Test Suites

**Feature ID:** 0000016-e2e-playwright-test-suites

## Business Goal

The MCP server's HTTP surface (`/emit`, `/query`, `/health`) and the log-viewer UI (`GET /ui`, shipped in `0000015`) are currently covered only by unit/integration tests that exercise handlers directly or check served content — not true black-box, browser/HTTP-level regression coverage. Add two Playwright E2E suites so a regression in real request/response behavior or real browser rendering/interaction is caught before merge, not discovered manually.

## Features

| Feature | User Stories | Priority | Wave |
|---------|-------------|----------|------|
| Backend E2E suite | As a maintainer, I run the backend E2E suite against a real running server-http.ts instance, so that I know `/emit`, `/query`, and `/health` behave correctly over real HTTP, not just at the handler level. | should-have | 1 |
| UI E2E suite | As a maintainer, I run the UI E2E suite against a real browser driving the served `/ui` page, so that I know filtering, pagination, and the detail view actually work for a user, not just that the right HTML/JS is served. | should-have | 1 |

Single wave — both suites are small, share the same ephemeral-server test harness pattern, and ship together.

## Target Architecture

### Components

| Component | Type | New or Existing | Responsibility |
|-----------|------|-----------------|---------------|
| structured-telemetry-mcp | microservice | existing | Test additions only — no new component. Both E2E suites live under `tests/e2e/` in this existing component. |

### Data Ownership

| Data Store | Owner Component | Shared With |
|------------|----------------|-------------|
| Ephemeral per-test-run DuckDB (temp file, deleted after) | structured-telemetry-mcp (test harness) | None — isolated per test run, not the dev/prod DB |

### Integration Points

| From | To | Method | Contract |
|------|-----|--------|----------|
| Backend E2E suite | server-http.ts (real process, ephemeral port) | HTTP | POST /emit, POST /query, GET /health |
| UI E2E suite | server-http.ts (real process, ephemeral port) | HTTP + browser (Chromium) | GET /ui, POST /query (via page's own fetch calls) |

## Stack

| Concern | Decision |
|---------|----------|
| Language | TypeScript |
| Runtime | Node (>=20.19, already the project floor) |
| Framework | @playwright/test (new devDependency) |
| Frontend | none (testing existing vanilla-JS `/ui` page, ADR-018 from 0000015 unchanged) |
| Database | Ephemeral DuckDB temp file per test run |
| ORM | none |
| Testing | @playwright/test (E2E); Vitest unchanged for existing unit/integration tests |
| IaC | none |
| Cloud | none |
| Compute | local / CI runner |
| CI | GitHub Actions — extend `.github/workflows/planifest.yml` |
| Build target | ci-only for the E2E job (also runnable locally via npm scripts) |

**Test authoring aid (not a runtime dependency of the shipped suites):** the Playwright MCP server (`@playwright/mcp`) is used interactively during P3 codegen to explore `/ui` and the backend endpoints while writing the `.spec.ts` files — confirming selectors and flows work before committing them. It plays no role in CI execution; `npx playwright test` (via `@playwright/test`) is the sole CI-executed runner. Captured as its own ADR at P2.

## Scope Boundaries

### In Scope
- Backend E2E suite: `/emit` (valid envelope → queryable back; schema-invalid envelope → rejected), `/query` event_log mode (filtering by phase/agent/product_id/from/to, pagination via limit/offset/total_count, sort), `/health`.
- UI E2E suite: `/ui` page load/render, each filter narrows results and updates URL state, pagination controls, zero-result state, row-click → full pretty-printed JSON detail with no new network request.
- Both suites: real server process per run against an ephemeral temp DuckDB, Chromium-only, wired into CI as a blocking check on every PR.

### Out of Scope
- The MCP stdio tool interface (only the HTTP surface is covered).
- Visual/screenshot regression testing.
- Load/performance testing.
- Auth flows (none exist on this server — 127.0.0.1-only, no-auth is an existing, unchanged NFR).
- Multi-browser matrix (Firefox/WebKit) — Chromium-only for this feature.

### Deferred
- Nothing deferred — scope above is the complete feature.

## Non-Functional Requirements

| NFR | Target | Measurement |
|-----|--------|-------------|
| CI runtime | p95 < 5 min for both suites combined | Measured in GitHub Actions job duration at P4 |
| Flakiness tolerance | 1 retry in CI, 0 retries locally | `@playwright/test` `retries` config, verified at P4 |
| Isolation | Each test run uses a fresh ephemeral DuckDB + ephemeral port | No shared state between runs; verified at P4 by running suites in parallel without collision |

## Constraints and Assumptions

### Constraints
- Server remains 127.0.0.1-only, no auth added (unchanged from 0000015 NFR-002) — E2E harness must respect this, not introduce new network exposure.
- No visual regression / screenshot-diffing tooling — out of scope per above.

### Assumptions
- Chromium-only coverage is sufficient since the UI is deliberately minimal vanilla JS (ADR-018) with no browser-specific behavior expected.
- `npx playwright install chromium --with-deps` in CI is an acceptable one-time build-step cost within the 5-minute NFR budget.

## Scenario Paths

**Happy path:** A maintainer runs `npm run test:e2e` (or CI runs it on a PR). Both suites spin up their own real server-http.ts instance against a fresh ephemeral DuckDB. The backend suite POSTs valid/invalid `/emit` payloads and queries `/query`/`/health` over real HTTP, asserting on responses. The UI suite launches Chromium, navigates to `/ui`, exercises filters/pagination/detail-view against the same live server, and asserts on rendered DOM state. All assertions pass; the CI check goes green.

**First-run path:** No prior state exists — this is the first time these suites exist in the repo. First local run requires `npx playwright install chromium --with-deps` (one-time browser binary install, documented in a new `docs/testing-e2e.md` or the existing `docs/usage-guide.md`). First CI run installs Chromium as a workflow step before the E2E job.

**Error / sad path:** A test assertion fails (real regression, e.g. `/query` pagination broken) — the suite reports the failure with Playwright's HTML/trace reporter, CI job fails, PR is blocked. A flaky timing failure gets one retry in CI before being reported as a real failure — never silently swallowed.

**Cross-session continuity:** Each test run's ephemeral server process and temp DuckDB file are scoped to that run only — nothing persists between runs, nothing to recover. An interrupted CI run simply reports as failed/cancelled; no partial-write state exists to clean up since the temp DB is deleted (or left orphaned in the CI runner's ephemeral filesystem, which is itself discarded after the job).

## Acceptance Criteria

- [ ] Backend suite: `POST /emit` with a valid envelope returns success and the event is retrievable via `POST /query`
- [ ] Backend suite: `POST /emit` with a schema-invalid envelope is rejected (400)
- [ ] Backend suite: `POST /query` (`event_log` mode) correctly filters by phase, agent, product_id, from/to date range
- [ ] Backend suite: `POST /query` (`event_log` mode) correctly paginates (limit/offset/total_count) and sorts
- [ ] Backend suite: `GET /health` returns ok
- [ ] UI suite: `GET /ui` loads and renders the event table
- [ ] UI suite: each filter (phase/agent/product_id/date range) narrows displayed results and updates URL state
- [ ] UI suite: pagination controls move between pages correctly
- [ ] UI suite: zero-result state renders when a filter matches nothing
- [ ] UI suite: clicking a row expands full pretty-printed JSON detail with no new network request
- [ ] Both suites run Chromium-only, wired into CI as a blocking check on every PR
- [ ] Both suites complete in under 5 minutes (p95) in CI
