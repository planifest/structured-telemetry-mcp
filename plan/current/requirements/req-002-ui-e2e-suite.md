---
title: "Requirement: req-002 - UI E2E Suite"
summary: "Browser-driven E2E coverage for the log-viewer UI (GET /ui)."
status: "active"
version: "0.1.0"
---
# Requirement: req-002 - UI E2E Suite

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000016-e2e-playwright-test-suites
**Source:** US-002
**Priority:** should-have

## User Story

As a maintainer, I run the UI E2E suite against a real browser driving the served `/ui` page, so that I know filtering, pagination, and the detail view actually work for a user, not just that the right HTML/JS is served.

## Functional Requirements

- A Playwright (`@playwright/test`) suite at `tests/e2e/ui/` starts a real `server-http.ts` process (same pattern as req-001) bound to `127.0.0.1` on an ephemeral port, pointed at a fresh temp-file DuckDB seeded with a known fixture event set, before its tests run, and tears both down after.
- Test: navigating to `GET /ui` in a Chromium browser context loads the page and renders the event table populated from the seeded fixtures.
- Test: applying each filter (phase, agent, product_id, date range) narrows the rendered table to matching rows only, and the URL query string reflects the active filter state (per ADR-016/req-003 of 0000015's URL-state persistence).
- Test: pagination controls move between pages of results, and the rendered rows change accordingly.
- Test: applying a filter combination that matches zero fixture rows renders the documented zero-result state (not a blank table or an error).
- Test: clicking a table row expands the full pretty-printed JSON detail for that event, and no new network request is made when the row is clicked (verified via the page's network activity — the detail data must already be present client-side from the initial `/query` response).
- Suite is Chromium-only (per confirmed design — no Firefox/WebKit projects).

## Acceptance Criteria

- [ ] `GET /ui` loads and renders the event table from seeded fixtures
- [ ] Each filter (phase/agent/product_id/date range) narrows results and updates the URL query string
- [ ] Pagination controls move between pages correctly
- [ ] Zero-result state renders when a filter combination matches nothing
- [ ] Clicking a row expands full pretty-printed JSON detail with no new network request fired
- [ ] Suite starts/stops its own real server process + ephemeral temp DuckDB per run, seeded with known fixtures, no shared state with other runs
- [ ] Suite runs Chromium-only in CI as a blocking check on every PR
- [ ] Suite completes within its share of the combined 5-minute (p95) CI budget

## Dependencies

- Existing `GET /ui` route and static vanilla-JS page (`src/ui/index-html.ts`, unchanged by this feature — ADR-018 from 0000015 stays in force)
- `@playwright/test` devDependency (added by this feature, shared with req-001)
- Chromium browser binary, installed via `npx playwright install chromium --with-deps` (one-time local/CI step)
- Shares its CI workflow step and NFR budget with req-001 (backend E2E suite) — both run in the same GitHub Actions job
