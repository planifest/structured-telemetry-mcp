---
title: "Risk Register - E2E Playwright Test Suites"
summary: "Technical, operational, and security risks with their mitigations."
status: "active"
version: "0.1.0"
---
# Risk Register - E2E Playwright Test Suites

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md) (updated by any agent that identifies a new risk)
**Feature:** 0000016-e2e-playwright-test-suites
**Version:** 0.1.0
**Overall Risk Level:** low

## Risks

| ID | Category | Description | Likelihood | Impact | Mitigation | Status |
|----|----------|------------|------------|--------|-----------|--------|
| R-001 | technical | Per-test-file ephemeral server startup (spawning a real `server-http.ts` process + fresh DuckDB per file) could push combined CI runtime past the 5-min (p95) NFR budget as the suites grow | medium | medium | Measure actual runtime at P4; fall back to a single shared server + per-test DB reset if the budget is threatened (see execution-plan.md A-003) | open |
| R-002 | technical | Ephemeral port allocation collides across parallel test workers if not handled correctly (e.g. hardcoded port instead of OS-assigned port 0) | low | medium | Harness must bind to port 0 (OS-assigned) and read back the actual port, never a hardcoded value | open |
| R-003 | operational | Playwright MCP (authoring aid) gets conflated with `@playwright/test` (CI runtime) by a future contributor, leading to confusion about what actually gates CI or an attempt to run MCP in CI | low | low | Explicit ADR at P2 separating the two roles; documented in `docs/testing-e2e.md` or `docs/usage-guide.md` at P6 | open |
| R-004 | technical | `npx playwright install chromium --with-deps` in CI adds meaningful one-time latency per run if not cached, threatening NFR-001 | medium | low | Cache the Playwright browser binary directory (`~/.cache/ms-playwright` or equivalent) between CI runs via GitHub Actions cache; measure at P4 | open |
| R-005 | security | Test harness accidentally binds the ephemeral server to `0.0.0.0` instead of `127.0.0.1`, introducing new network exposure during test runs | low | medium | Harness must explicitly bind `127.0.0.1`; reviewed at P5 (NFR-004) | open |
| R-006 | technical | Row-click "no new network request" assertion (req-002) is inherently timing-sensitive — a request that fires just after the assertion window could produce a false pass | low | low | Assert over a bounded wait window (e.g. Playwright's network-idle or an explicit listener attached before the click, checked after) rather than an instantaneous snapshot; verified at P4 | open |

## Assumptions Logged as Risks

Documented assumptions from the specification are logged here with likelihood: medium.

| ID | Assumption | Impact if Wrong | Status |
|----|-----------|----------------|--------|
| A-001 | Chromium-only coverage is sufficient given the deliberately minimal vanilla-JS UI (ADR-018) | Cross-browser bugs ship undetected | open |
| A-002 | `npx playwright install chromium --with-deps` fits within the 5-minute CI budget as a one-time step | NFR-001 needs revisiting or the install needs caching (see R-004) | open |
| A-003 | Per-file ephemeral server startup keeps runs isolated without breaching the runtime budget | Revisit to a shared-server pattern if startup overhead threatens NFR-001 (see R-001) | open |
