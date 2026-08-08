---
title: "Requirement: req-010 - XSS escaping verified in the rendered UI"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-010 - XSS escaping verified in the rendered UI

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000019-loopback-daemon-hardening
**Source:** US-010
**Priority:** must-have

## User Story

As a security reviewer, I want XSS escaping verified in the rendered UI, so that the escaping claim is backed by a test.

## Current state

`src/ui/index-html.ts` defines `escapeHtml` at `:243` and applies it when building rows via the `innerHTML` assignment at `:304-310` (the `productLabel` ternary that feeds it is at `:302`). The escaping exists. What does not exist is any test that renders hostile content in a real browser and asserts nothing executes.

Line `:302` is the case that most warrants a test:

```js
'<span title="' + escapeHtml(event.product_id) + '">' + escapeHtml(String(event.product_id).split(/[\\/]/).pop()) + '</span>'
```

The same value is interpolated into **two different contexts** — an HTML attribute and element text. Attribute context needs quote-escaping to prevent breakout; text context does not. One helper serving both is correct only if it escapes quotes too. That is exactly the kind of property a test should pin rather than a reviewer eyeball.

## Functional Requirements

- Add Playwright tests that emit events carrying hostile payloads, load `GET /ui`, and assert the payload renders as literal text with no script execution.
- The payload corpus must cover, at minimum:
  - `<img src=x onerror=alert(1)>`
  - `<script>alert(1)</script>`
  - `"><script>alert(1)</script>`
  - `' onmouseover='alert(1)`
  - `"><img src=x onerror=alert(1)>` targeted specifically at the `title` attribute via `product_id`
  - a `javascript:` URL
- Every rendered field is covered: `timestamp`, `event`, `session_id`, `phase`, `agent`, and `product_id` — the last both as `title` attribute and as displayed text.
- Assertions are behavioural, not textual: register a page-level dialog handler and a console-error listener, and assert **no dialog fires and no injected script executes**. Asserting only that the DOM contains escaped entities is weaker and does not satisfy this requirement.
- The JSON detail view (`:317`, `pre.textContent`) is covered too — `textContent` is inherently safe, so the test pins that it stays `textContent` and is never switched to `innerHTML`.
- Chromium-only, consistent with ADR-023.

## Acceptance Criteria

- [ ] Every payload in the corpus, placed in each of the six rendered fields in turn, renders as literal text and fires no `alert`/`confirm`/`prompt` — asserted by a registered page dialog handler and a console-error listener, not by DOM inspection
- [ ] The attribute-breakout payload delivered via `product_id` does not escape the `title` attribute at `:302`, and the JSON detail view at `:317` renders hostile content literally
- [ ] Temporarily replacing `escapeHtml` with an identity function makes these tests fail — a real RED-before-GREEN cycle — and the suite runs Chromium-only inside the existing CI time budget

## Dependencies

- ADR-018 — the UI is an embedded template-literal string with no build step; tests exercise it through a real served page, not by importing a component.
- ADR-023 — Chromium-only browser coverage.
- 0000016's E2E harness (`tests/e2e/`, ephemeral port via port 0) is the pattern to follow.
- The `playwright` skill is mapped to this requirement in the design's Skill Map.

## Input Validation

- [ ] Input source: telemetry event field values read from DuckDB and rendered into the log-viewer page
- [ ] Allowed character pattern: none — arbitrary content is legitimate in telemetry payloads and must be *escaped*, never rejected or stripped, since a stripped error string would corrupt the operator's own data
- [ ] Maximum length: not applicable to escaping; display truncation is a separate UI concern
- [ ] Failure behaviour: content always renders as literal text; no execution under any input
- [ ] Logging policy: not applicable — this is a rendering requirement
