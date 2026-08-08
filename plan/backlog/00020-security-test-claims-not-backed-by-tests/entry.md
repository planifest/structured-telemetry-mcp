---
title: "Backlog Entry: 00020 - Documented security test coverage is not backed by the tests"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "high"
---
# Backlog Entry: 00020 - Documented security test coverage is not backed by the tests

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

The suite is green — 405 vitest tests across 16 files, plus a clean `typecheck` — and the counts in
`src/structured-telemetry-mcp/docs/test-coverage.md` are accurate. The problem is that two documented
**security** claims are not tested at all, so the documentation asserts a guarantee the suite does not
provide.

**1. "Injection-shaped input rejected" — no test uses injection-shaped input.**
`tests/unit/column-allow-list.test.ts` asserts only that the allow-list constants contain the values
they literally contain; its last two tests cannot fail while TypeScript compiles, since
`SORTABLE_FIELDS` is typed `AllowedEventColumnKey[]`. The actual rejection tests use benign
identifiers: `'not_a_real_field'`, `'timestamp'`
(`tests/integration/distinct-values.test.ts:105,111`) and `'data'`
(`tests/integration/query-telemetry.test.ts:398`). **Nothing anywhere passes a quote, semicolon,
comment marker, or `UNION`**, and nothing asserts the database is intact afterwards.

Both `sortField` and `field` are interpolated raw into SQL (`event-log.ts:62`,
`distinct-values.ts:51,53,55`). A regression such as adding a fallback
(`ALLOWED_EVENT_COLUMNS[f] ?? f`) or inverting a guard would open the exact vector ADR-024 exists to
close **and keep every test green**.

The claim appears in `docs/test-coverage.md`, `src/structured-telemetry-mcp/docs/risk.md` (R-001), and
`component.yml:172`.

**2. HTML escaping is asserted nowhere.** `escapeHtml` (`src/ui/index-html.ts:243-245`) guards six
`innerHTML` interpolations plus the `title="..."` attribute. No test feeds a hostile value
(`<img onerror=...>`, `"><script>`) through any of them; e2e fixtures use only benign data.
`tests/unit/ui.test.ts:37` asserts the literal string `'<span title="'` is present — which still passes
with `escapeHtml` deleted. Dropping escaping from one column would ship stored XSS from any value
written via `POST /emit`, with the suite green.

(To be clear: the current implementation **is** correct — escaping is applied consistently on every
path, and two independent reviews found no XSS. The defect is the absence of a test that would notice
if it stopped being correct.)

**3. Systemic: the frontend is tested by string-matching a template.** All 42 tests in
`tests/unit/ui.test.ts` operate on `INDEX_HTML` as a string, with `environment: 'node'` and no
jsdom/happy-dom. They prove the markup shipped, not that anything executes, and they are brittle in the
wrong direction — assertions like `expect(readMatch![0]).toContain("params.set('sortField', ...)")`
break on harmless renames while passing through genuine behavioural breakage. The 13 Playwright UI
tests are the only real execution coverage and are happy-path only.

Weak/tautological examples: `ui.test.ts:190` is titled "the change handler writes the URL and
starts/stops the interval" but asserts only that `addEventListener('change'` appears somewhere in the
string; `:285` asserts `▲`/`▼` appear somewhere; `:220`/`:226` are unanchored global substring checks.

## Suggested Action

- Add genuine injection tests: quotes, semicolons, `--`, `/* */`, `UNION SELECT`, and prototype keys
  (`constructor`, `__proto__`) against **both** `sortField` and `distinct_values.field`; assert a
  structured rejection and that the events table is unchanged afterwards.
- Add escaping tests: emit an event carrying `<img src=x onerror=...>` in each rendered field, load the
  page under Playwright, and assert no script executes and the text renders literally — including via
  the `title` attribute, where quote-escaping prevents attribute breakout.
- Import `SORTABLE_FIELDS` / `SUGGESTIBLE_FIELDS` into `ui.test.ts` and assert the template matches,
  instead of restating the literals — there are currently **four** hand-maintained copies of these
  lists (`column-allow-list.ts:22`, the template's JS literal at `index-html.ts:137` annotated "kept in
  sync manually", the `<option>`/`<th data-field>` markup, and `ui.test.ts:240-256`) with no drift test.
- Correct `docs/test-coverage.md`, `docs/risk.md` R-001 and `component.yml` to describe what is
  actually verified, and distinguish "markup shipped" from "behaviour verified".
- Reopen the 0000015 quirk note about `server-http.ts` lacking HTTP-level coverage — `/query` error
  handling is still untested.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. Should be picked up with (or
immediately after) the security fixes in [[00010-query-parameter-validation-gaps]],
[[00011-query-errors-leak-sql-and-data]] and [[00012-http-daemon-no-auth-or-origin-check]], since those
changes need exactly these tests to prove they work.
