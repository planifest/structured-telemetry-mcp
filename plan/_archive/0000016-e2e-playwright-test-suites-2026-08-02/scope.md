---
title: "Scope - E2E Playwright Test Suites"
summary: "Defines explicit boundaries of what is in scope and out of scope."
status: "active"
version: "0.1.0"
---
# Scope - E2E Playwright Test Suites

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000016-e2e-playwright-test-suites
**Wave:** 1 (single wave)
**Version:** 0.1.0

## In Scope

- Backend E2E suite (`tests/e2e/backend/`): real `server-http.ts` process + ephemeral temp DuckDB per run; `POST /emit` valid + schema-invalid cases; `POST /query` `event_log` filtering (phase/agent/product_id/from/to), pagination (limit/offset/total_count), and sort; `GET /health`.
- UI E2E suite (`tests/e2e/ui/`): real Chromium browser driving the served `GET /ui` page against the same real-server pattern; page load/render, each filter narrows results + updates URL state, pagination controls, zero-result state, row-click JSON detail expansion with no new network request.
- `@playwright/test` as a new devDependency; `playwright.config.ts` with two projects (backend, ui); new npm scripts (`test:e2e`, `test:e2e:backend`, `test:e2e:ui`).
- CI: extend `.github/workflows/ci.yml` (the workflow that actually runs typecheck/test/build) with a new `e2e` job to install Chromium and run both suites as a blocking check on every PR. (Corrected at P3 — `planifest.yml` is doc/code-parity-only, not a test runner.)
- Interactive use of the Playwright MCP server (`@playwright/mcp`) during P3 codegen for authoring/verification — not part of the shipped CI runtime (see ADR to be written at P2).
- Installation of the vendored `playwright` capability skill, permanently, for this and future plans (already completed at P0).

## Out of Scope

- The MCP stdio tool interface (`emit_event`/`query_telemetry` as called by an agentic tool) — only the HTTP surface (`/emit`, `/query`, `/health`, `/ui`) is covered.
- Visual/screenshot regression testing.
- Load/performance testing beyond the existing Vitest performance gate (p95 < 100ms), which is unaffected by this feature.
- Authentication or access-control flows — none exist on this server (127.0.0.1-only, no-auth is an existing, unchanged NFR) and this feature does not add any.
- Multi-browser matrix (Firefox/WebKit) — Chromium-only for this feature.
- Any change to the `/emit`, `/query`, `/health`, `/ui` route behavior itself — this feature adds test coverage only, it does not modify the surface under test.
- Playwright MCP as part of the CI-executed test runtime — it is an authoring/dev-time aid only.

## Deferred

- Multi-browser coverage (Firefox/WebKit) — blocked on: a concrete cross-browser bug being found, or a deliberate decision to broaden coverage (see execution-plan.md A-001).
- A single shared long-lived test server instead of per-file ephemeral processes — blocked on: NFR-001 (5-min CI budget) actually being threatened by per-file startup overhead (see execution-plan.md A-003).
