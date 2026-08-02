---
title: "ADR 023: Chromium-Only Browser Coverage"
summary: "The UI E2E suite runs against Chromium only, not a multi-browser (Firefox/WebKit) matrix."
status: "accepted"
version: "0.1.0"
---
# ADR-023 - Chromium-Only Browser Coverage

**Skill:** [adr-agent](../skills/planifest-adr-agent/SKILL.md)
**Feature:** 0000016-e2e-playwright-test-suites
**Component:** structured-telemetry-mcp
**Date:** 2026-08-02

## Context

`@playwright/test` (ADR-020) supports running the same suite across Chromium, Firefox, and WebKit "projects" with minimal config. Since this decision directly affects CI runtime (NFR-001, p95 < 5 min for both suites combined) and the maintenance surface of the UI suite, the browser matrix needed an explicit, deliberate choice rather than defaulting to whatever Playwright ships with.

## Decision

The UI E2E suite runs Chromium only. The `/ui` page under test is deliberately minimal vanilla HTML/CSS/JS with no framework (ADR-018, `0000015`) and no framework-specific or known browser-specific behavior — filters, pagination, and the detail view are plain DOM manipulation and `fetch()` calls, not the kind of surface where Chromium/Firefox/WebKit rendering differences are a realistic risk. This is recorded as A-001 in `execution-plan.md` and revisited only if a concrete cross-browser bug is found.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Full matrix (Chromium + Firefox + WebKit) | Maximum browser-compat confidence | Roughly 3x CI runtime and 3x maintenance surface for a 4-view, framework-free page with no known cross-browser risk | Rejected — cost disproportionate to the actual risk given ADR-018's minimal-JS approach |
| Chromium + one additional browser (e.g. + WebKit for Safari-family coverage) | Partial extra confidence at lower cost than full matrix | Still adds meaningful CI time and config for a risk this feature's own scope assessment rates as low | Rejected for this feature; revisit if Safari-specific bugs are ever reported |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | `playwright.config.ts`'s `ui` project is configured for the `chromium` device/browser only |

## Consequences

**Positive:**
- Keeps CI runtime within the 5-min (p95) budget (NFR-001) with margin for the suites to grow
- One browser to install/cache/debug in CI, simplest possible harness

**Negative:**
- No automated signal if a genuine Firefox- or WebKit-specific rendering bug is introduced — would only surface via manual testing or a user report

**Risks:**
- Accepted per A-001: likelihood assessed as low given the vanilla-JS, framework-free nature of the page under test (ADR-018)

## Related ADRs

- ADR-018 (`0000015`) - depends-on (the minimal vanilla-JS UI is the reason this risk is assessed as low)
- ADR-020 - depends-on (Chromium-only is a config choice within the `@playwright/test` framework)

## Supersedes

- None

## Superseded By

- None
