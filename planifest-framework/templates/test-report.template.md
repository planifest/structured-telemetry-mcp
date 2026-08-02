# Test Report — {{feature-id}} — {{YYYY-MM-DD}}

**Feature:** {{feature-name}}
**Plan date:** {{YYYY-MM-DD}}

## 1. Tests Run This Plan (P4 Results)

Every functional requirement must appear here.

| Test file | Requirement ID(s) | Status |
|-----------|-------------------|--------|
| {{test-file-name}} | {{req-id}} | pass / fail / skipped |

**Summary:** {{n}} tests run — {{n}} passed, {{n}} failed, {{n}} skipped.

> ⚠ If any requirement from `plan/current/requirements/` is absent from this table, the report is incomplete.

## 2. Regression Pack State

**Total promoted tests:** {{n}}
**Passed:** {{n}}
**Failed:** {{n}}

| Test file | Source feature | Promoted by | Promotion date | Status |
|-----------|---------------|-------------|----------------|--------|
| {{regression-test-name}} | {{source-feature-id}} | agent / human | {{YYYY-MM-DD}} | pass / fail |

{{#if regression-failures}}
### Regression Failures

The following regression tests failed. These must be triaged before archiving.

| Test file | Failure summary |
|-----------|----------------|
| {{regression-test-name}} | {{failure-description}} |
{{/if}}

## 3. Newly Promoted Tests (This Feature)

Promoted during Step R of this P7 run.

| Test file | Promoted by | Decision rationale |
|-----------|-------------|-------------------|
| {{test-file-name}} | agent / human | {{rationale}} |

## 4. Summary

**Overall test health:** ✅ Healthy / ⚠ Failures present — see sections above.
