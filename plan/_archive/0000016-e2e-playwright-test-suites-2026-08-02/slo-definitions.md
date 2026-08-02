# SLO Definitions - E2E Playwright Test Suites

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000016-e2e-playwright-test-suites
**Version:** 0.1.0

> Do not produce aspirational targets - base them on the design requirements's NFRs.

## Service Level Objectives

| SLO ID | Service / Component | SLI (what is measured) | Target | Window | Error Budget |
|--------|-------------------|----------------------|--------|--------|-------------|
| SLO-001 | E2E test suites (CI job) | Proportion of CI runs where combined E2E suite runtime is under 5 minutes | 95% (p95 < 5 min, per NFR-001) | Rolling, per-PR (no time window — evaluated per run) | 5% of runs may exceed 5 min before A-003's shared-server fallback is revisited |

## SLI Definitions

| SLI ID | Name | Measurement Method | Data Source | Good Event Definition | Valid Event Definition |
|--------|------|-------------------|-------------|----------------------|----------------------|
| SLI-001 | E2E CI runtime | GitHub Actions job duration for the E2E test step | GitHub Actions job logs | Job completes in < 5 min | Any completed (pass or fail) E2E job run |

## Error Budget Policy

This feature is test infrastructure, not a running service — the standard error-budget-driven freeze policy below does not apply operationally. Retained for template consistency; not enforced.

| Condition | Action |
|-----------|--------|
| Budget remaining > 50% | Normal development velocity |
| Budget remaining 25-50% | Prioritize reliability work |
| Budget remaining < 25% | Freeze non-critical changes, focus on reliability |
| Budget exhausted | All engineering effort goes to reliability until budget recovers |

## Burn Rate Alerts

Not applicable — no alerting pipeline exists for this CI-gated test infrastructure (see `operational-model.md`).
