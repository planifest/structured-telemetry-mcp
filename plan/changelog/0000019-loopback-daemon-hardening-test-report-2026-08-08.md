# Test Report — 0000019-loopback-daemon-hardening — 08 Aug 2026

## Tests run (P4)

| Check | Result |
|-------|--------|
| Typecheck (`tsc --noEmit`) | clean |
| Build (`tsc && esbuild` ×3 bundles) | clean |
| Vitest (`vitest run`) | **545 pass** / 33 files (baseline 491) |
| Playwright E2E (`playwright test`, Chromium) | **25 pass** / 3 files (baseline 22) |

All checks passed first attempt, zero self-corrections.

## Coverage added this feature (+54 Vitest, +3 E2E)

| Requirement | Test file | Count |
|-------------|-----------|-------|
| req-005 | `tests/unit/validate-query.test.ts` | 26 |
| req-005/006/008 (MCP) | `tests/unit/server-factory-hardening.test.ts` | 6 |
| req-007 | `tests/integration/bounded-result-sets.test.ts` | 4 |
| req-001/002/003/004/006 (HTTP) | `tests/integration/server-http-boundary.test.ts` | 13 |
| req-009 | `tests/integration/injection-identifiers.test.ts` | 4 |
| req-009 | `tests/unit/column-allow-list.test.ts` | +1 net (2 tautological replaced) |
| req-010 | `tests/e2e/ui/xss-escaping.spec.ts` | 3 |

Updated to new contracts: `tests/unit/server-factory.test.ts` (3 tests moved from
the old leaky-error contract to the redacted one, req-006); `tests/unit/ui.test.ts`
(imports the allow-list instead of restating it, req-011).

## RED-before-GREEN verification

Every requirement's test was RED-confirmed before implementation. Two required
an explicit weakening cycle per their acceptance criteria, both performed and
restored:

- **req-009** — adding `'--'` to `SORTABLE_FIELDS` made the injection-exclusion
  and membership tests fail; restored → green.
- **req-010** — replacing `escapeHtml` with an identity function made all three
  XSS tests fail; restored → green.

## Regression pack

No `# REGRESSION-CANDIDATE:` tags were emitted this feature. The new
security-boundary tests live in the standard unit/integration/e2e suites and run
on every CI invocation; no promotion to a separate regression pack was requested.

## Newly promoted tests

None.
