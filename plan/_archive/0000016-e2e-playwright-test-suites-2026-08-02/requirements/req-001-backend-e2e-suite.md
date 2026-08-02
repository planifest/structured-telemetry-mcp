---
title: "Requirement: req-001 - Backend E2E Suite"
summary: "Black-box HTTP-level E2E coverage for /emit, /query, and /health."
status: "active"
version: "0.1.0"
---
# Requirement: req-001 - Backend E2E Suite

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000016-e2e-playwright-test-suites
**Source:** US-001
**Priority:** should-have

## User Story

As a maintainer, I run the backend E2E suite against a real running server-http.ts instance, so that I know `/emit`, `/query`, and `/health` behave correctly over real HTTP, not just at the handler level.

## Functional Requirements

- A Playwright (`@playwright/test`) suite at `tests/e2e/backend/` starts a real `server-http.ts` process (via `child_process`, not an in-process handler call) bound to `127.0.0.1` on an ephemeral port, pointed at a fresh temp-file DuckDB, before its tests run, and tears both down after.
- Test: `POST /emit` with a schema-valid envelope returns a success response, and the emitted event is subsequently retrievable via `POST /query` (`event_log` mode) filtered to that event's identifying fields.
- Test: `POST /emit` with a schema-invalid envelope (e.g. missing a required field) returns an HTTP 400-class error response and the event is not persisted (confirmed absent via a following `/query`).
- Test: `POST /query` (`event_log` mode) filters correctly by `phase`, `agent`, `product_id`, and `from`/`to` timestamp range, individually and combined, against a known seeded fixture set.
- Test: `POST /query` (`event_log` mode) paginates correctly via `limit`/`offset` and reports an accurate `total_count`; default sort order is verified.
- Test: `GET /health` returns a success/ok response while the server is running.
- The suite runs entirely over real HTTP requests (e.g. via Playwright's `request` fixture or an equivalent HTTP client) — no direct import of server-side handler functions.

## Acceptance Criteria

- [ ] `POST /emit` (valid) → success, event retrievable via `POST /query`
- [ ] `POST /emit` (schema-invalid) → rejected (400-class), not persisted
- [ ] `POST /query` `event_log` filters correctly by phase/agent/product_id/from/to
- [ ] `POST /query` `event_log` paginates correctly (limit/offset/total_count) and sorts correctly
- [ ] `GET /health` returns ok
- [ ] Suite starts/stops its own real server process + ephemeral temp DuckDB per run, no shared state with other runs
- [ ] Suite runs in CI (Chromium/Node runtime for the Playwright test runner itself — no browser needed for this suite's own HTTP-only assertions) as a blocking check on every PR
- [ ] Suite completes within its share of the combined 5-minute (p95) CI budget

## Dependencies

- Existing `server-http.ts`, `/emit`, `/query`, `/health` routes (unchanged by this feature — see `src/structured-telemetry-mcp/docs/interface-contract.md`)
- `@playwright/test` devDependency (added by this feature, req-001/req-002 shared)
- Shares its CI workflow step and NFR budget with req-002 (UI E2E suite) — both run in the same GitHub Actions job
