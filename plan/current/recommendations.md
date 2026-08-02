# Recommendations - E2E Playwright Test Suites

**Skill:** [docs-agent](../skills/planifest-docs-agent/SKILL.md)
**Feature:** 0000016-e2e-playwright-test-suites
**Version:** 0.12.0

> These are not blockers - they are opportunities for future work.

## Recommendations

| ID | Category | Priority | Component | Recommendation | Rationale | Effort |
|----|----------|----------|-----------|---------------|-----------|--------|
| REC-001 | testing | low | structured-telemetry-mcp | If the E2E suites grow meaningfully beyond their current 17 tests and CI runtime starts approaching NFR-001's 5-min budget, switch from per-file ephemeral server startup to a single shared server + per-test DB reset (per execution-plan.md A-003 / risk-register R-001) | Per-file startup is simple and perfectly isolated by construction today (2 files, ~3s combined), but won't scale indefinitely — worth a periodic runtime check rather than waiting for a real CI slowdown to notice | small |
| REC-002 | maintainability | low | structured-telemetry-mcp | Add a Firefox and/or WebKit project to `playwright.config.ts`'s `ui` suite only if a real cross-browser bug is ever found in the vanilla-JS `/ui` page (ADR-023, A-001) | Chromium-only was a deliberate, reasoned trade-off (framework-free page, low cross-browser risk) — revisit on evidence, not preemptively | small |
| REC-003 | observability | low | structured-telemetry-mcp | If `server-http.ts` is ever bundled differently (e.g. a new build target), extend the E2E harness to optionally run against `server-http.bundle.mjs` instead of `tsx src/server-http.ts`, to close the gap noted in quirks.md between "what's E2E-tested" and "what's actually shipped" | Current gap is low-risk (the existing CI `build`/`Verify bundles exist` steps already catch bundling breakage independently), but worth closing if bundling logic ever grows more complex than a straight esbuild pass | medium |
| REC-004 | testing | low | structured-telemetry-mcp | Consider adding a `test:e2e:backend`/`test:e2e:ui` split into the CI `e2e` job's reporting (currently one combined `npm run test:e2e` step) so a backend-only or UI-only regression is immediately obvious from the CI job name, not just the Playwright report | Minor CI ergonomics improvement, not required for correctness — current combined step already reports which suite failed within its output | small |

## Deferred Items

| Scope Item | Recommendation | When to Address |
|-----------|---------------|-----------------|
| Multi-browser (Firefox/WebKit) E2E coverage | Add as new Playwright projects when needed | When a concrete cross-browser bug is found, or a deliberate decision to broaden coverage (ADR-023) |
| Shared long-lived E2E test server instead of per-file ephemeral processes | Switch to a shared-server + per-test-reset pattern | Only if NFR-001 (5-min CI budget) is actually threatened by per-file startup overhead as the suites grow (ADR-022) |
| E2E coverage of the MCP stdio tool interface (`emit_event`/`query_telemetry` as called by an agentic tool, not the HTTP surface) | Would need a different harness (spawn an MCP client, not just HTTP requests) | If a regression specific to the stdio transport layer (distinct from the HTTP layer already covered) is ever suspected or found |

## Tech Debt

No new tech debt was introduced by this feature. The one item it resolves — `server-http.ts` having no HTTP-level test coverage — was pre-existing tech debt from `0000015` (and implicitly since `0000008`), now closed. See `src/structured-telemetry-mcp/docs/tech-debt.md` for the component's remaining (unrelated, pre-existing) entries.
