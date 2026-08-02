---
title: "ADR 021: Playwright MCP for Authoring Only — @playwright/test Remains the Sole CI Runtime"
summary: "The Playwright MCP server is used interactively during P3 codegen to author and verify the E2E suites; it plays no role in CI execution, which @playwright/test alone owns."
status: "accepted"
version: "0.1.0"
---
# ADR-021 - Playwright MCP for Authoring Only — @playwright/test Remains the Sole CI Runtime

**Skill:** [adr-agent](../skills/planifest-adr-agent/SKILL.md)
**Feature:** 0000016-e2e-playwright-test-suites
**Component:** structured-telemetry-mcp
**Date:** 2026-08-02

## Context

During P0 coaching, the human requested installing the Playwright MCP server (`@playwright/mcp`) and using it "for the E2E tests." Playwright MCP is an agent-driven browser-automation server (accessibility-tree based tools: navigate, click, snapshot, etc.) designed for an AI agent to interactively drive a browser — it has no CI runner, no assertion/exit-code model, and no headless unattended-execution story. This directly conflicts with the confirmed design's requirement that both E2E suites run as a **blocking check on every PR** (see `design.md`, `execution-plan.md` NFR-001) — something only `@playwright/test` (ADR-020) can provide. The two tools needed to be reconciled rather than treated as interchangeable, since building the suites around the wrong one would fail to deliver the CI-gating goal the feature exists for.

## Decision

Playwright MCP is used **exclusively as an interactive authoring/verification aid during P3 codegen** — the implementing agent uses it to explore `/ui` and the backend endpoints, confirm selectors and flows actually work, and iterate before committing. The artifact that ships is always a standard `.spec.ts` file written against `@playwright/test`. Playwright MCP is never invoked by CI, never referenced by `playwright.config.ts`, and has no runtime role in either suite. This distinction is recorded here specifically so it survives past this pipeline run — R-003 in `risk-register.md` flags the risk of a future contributor conflating the two.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Use Playwright MCP as the actual CI test-execution mechanism | Directly matches the literal human request | No CI harness, no assertions, no pass/fail exit code, no reporter — cannot gate a PR the way NFR-001/the confirmed design requires | Rejected — technically cannot deliver the feature's core goal (blocking CI check) |
| Skip Playwright MCP entirely, author suites without any agent-driven browser aid | Simpler toolchain, one fewer moving part | Discards a tool the human explicitly asked for that has real value for authoring/verification — no reason to drop it if its role is scoped correctly | Rejected — the human's request is honored by scoping MCP's role correctly, not by ignoring it |
| Use Playwright MCP for both authoring AND as a documented manual regression-check tool outside CI | Gives a persistent interactive debugging capability | Was considered and offered to the human at P0 as an alternative framing; not the option chosen | Not selected — human confirmed the authoring-only framing tied to P3 codegen specifically |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | No runtime impact — Playwright MCP is a dev-time tool used by the implementing agent during P3, not a dependency of the shipped test suites or CI workflow |

## Consequences

**Positive:**
- Delivers on both the literal request (use Playwright MCP) and the functional requirement (CI-blocking suites) without compromising either
- Interactive exploration during authoring should reduce the number of broken/flaky selectors that would otherwise only surface once CI runs

**Negative:**
- Two Playwright-branded tools in play (`@playwright/test`, `@playwright/mcp`) with different roles is a source of confusion if not clearly documented — mitigated by this ADR plus a note in `docs/testing-e2e.md` or `docs/usage-guide.md` at P6

**Risks:**
- A future contributor adds an MCP-driven step to the CI workflow, misunderstanding its purpose — mitigated by this ADR and R-003's documented mitigation

## Related ADRs

- ADR-020 - depends-on (this ADR only makes sense given `@playwright/test` is the chosen CI framework)

## Supersedes

- None

## Superseded By

- None
