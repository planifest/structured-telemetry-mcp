---
title: "ADR 020: @playwright/test as the E2E Test Framework"
summary: "Adopt @playwright/test as the E2E stack for both the backend and UI suites, extending — not replacing — the existing Vitest unit/integration setup."
status: "accepted"
version: "0.1.0"
---
# ADR-020 - @playwright/test as the E2E Test Framework

**Skill:** [adr-agent](../skills/planifest-adr-agent/SKILL.md)
**Feature:** 0000016-e2e-playwright-test-suites
**Component:** structured-telemetry-mcp
**Date:** 2026-08-02

## Context

The project has unit and integration tests (Vitest, 362 tests as of `0000015`) but no black-box E2E coverage — `server-http.ts` has no HTTP-level test coverage anywhere in the project (routes are tested indirectly via `server-factory.ts`'s exported handlers; see `component.yml` quirks), and the `GET /ui` route was verified manually in-browser, not via an automated live-server test. This feature adds two E2E suites: one exercising the HTTP surface (`/emit`, `/query`, `/health`) as a real client would, one driving a real Chromium browser against the served `/ui` page. A test framework capable of both real-HTTP-client assertions and real-browser automation, with CI-blocking pass/fail semantics, is needed.

## Decision

Adopt `@playwright/test` as a new devDependency and the sole framework for both E2E suites. It provides one consistent API for both suite types (an HTTP `request` fixture for the backend suite, a full browser context for the UI suite), a built-in test runner with assertions/retries/reporters suited to CI gating, and is already represented in this repo's tooling ecosystem via the vendored `playwright` capability skill (installed permanently at P0). Vitest remains unchanged and continues to own all existing unit/integration tests — this is an addition, not a replacement.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Cypress | Mature, good DX for browser testing | No first-class HTTP-only API-testing mode as clean as Playwright's `request` fixture; would need a second tool for the backend suite | Rejected — would require two different frameworks for two suites in the same feature |
| Extend Vitest with `supertest`-style HTTP assertions + a separate browser tool (e.g. `puppeteer`) for the UI suite | Reuses the existing test runner for the backend suite | Two different tools/APIs to maintain for what is conceptually one E2E capability; no unified reporter/trace story | Rejected — fragments E2E tooling instead of consolidating it |
| Playwright MCP server as the actual test execution mechanism | Already the tool being requested for authoring | No CI harness, no assertions/exit-code/reporter model — cannot itself gate a PR (see ADR-021) | Rejected as the CI runtime; retained as an authoring aid only |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | New devDependency `@playwright/test`; new `playwright.config.ts`; new `tests/e2e/backend/` and `tests/e2e/ui/` directories; new npm scripts (`test:e2e`, `test:e2e:backend`, `test:e2e:ui`); `.github/workflows/ci.yml` gains a new `e2e` job (Chromium install + `npm run test:e2e`) — corrected at P3 from the P1/P2 assumption of `planifest.yml`, which turned out to be doc/code-parity-only; the real test-running workflow is `ci.yml` |

## Consequences

**Positive:**
- Closes a known, documented gap (component.yml quirks: "server-http.ts has no HTTP-level test coverage anywhere in this project") with a single, consistent framework for both HTTP and browser assertions
- CI-blocking regression coverage on every PR going forward, catching real request/response and rendering regressions before merge

**Negative:**
- A new devDependency and a new test runner alongside Vitest — two test invocation paths (`npm test` vs `npm run test:e2e`) to keep documented and understood
- Chromium browser binary install adds a CI step and local first-run setup cost

**Risks:**
- CI runtime growth as the suites expand — mitigated by NFR-001 (p95 < 5 min) and R-001/R-004 in `risk-register.md`

## Related ADRs

- ADR-021 - depends-on (defines the boundary between this framework's CI role and Playwright MCP's authoring role)
- ADR-022 - related-to (the harness pattern these suites run against)
- ADR-023 - related-to (browser scope within this framework)

## Supersedes

- None

## Superseded By

- None
