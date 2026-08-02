---
title: "Domain Glossary - E2E Playwright Test Suites"
summary: "Definitions of domain terms used within this feature."
status: "active"
version: "0.1.0"
---
# Domain Glossary - E2E Playwright Test Suites

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md) (updated by any agent that introduces a new domain term)
**Feature:** 0000016-e2e-playwright-test-suites
**Version:** 0.1.0

## Terms

| Term | Definition | Aliases | Used In |
|------|-----------|---------|---------|
| Backend E2E suite | The Playwright test suite at `tests/e2e/backend/` that exercises `/emit`, `/query`, `/health` over real HTTP against a real server process | — | structured-telemetry-mcp |
| UI E2E suite | The Playwright test suite at `tests/e2e/ui/` that drives a real Chromium browser against the served `/ui` page | — | structured-telemetry-mcp |
| Ephemeral server instance | A real `server-http.ts` process started fresh per test run/file, bound to `127.0.0.1` on an OS-assigned (port 0) ephemeral port, torn down after | — | tests/e2e/ |
| Ephemeral test DuckDB | A fresh temp-file DuckDB database created per test run/file, isolated from the dev/prod database, deleted after the run | — | tests/e2e/ |
| Playwright MCP | The `@playwright/mcp` server — an agent-driven browser-automation tool (accessibility-tree based) used interactively during P3 codegen for test authoring/verification; not part of the CI-executed test runtime | Playwright MCP server | plan/current/adr/ (P2), tests/e2e/ authoring workflow |
| `@playwright/test` | The Playwright test framework/runner — the actual CI-executed engine for both E2E suites, distinct from Playwright MCP | Playwright test runner | tests/e2e/, playwright.config.ts, CI |
| Zero-result state | The UI's documented rendering when an applied filter combination matches no rows (distinct from a loading state or an error state) | Empty state | src/ui/index-html.ts (existing, 0000015), req-002 |
