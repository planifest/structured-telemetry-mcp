# Operational Model - E2E Playwright Test Suites

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000016-e2e-playwright-test-suites
**Version:** 0.1.0

## Component Ownership

| Component | Owner (team/role) | On-call Rotation | Escalation Path |
|-----------|------------------|-----------------|-----------------|
| structured-telemetry-mcp (E2E test suites) | Repo maintainer(s) | None — CI-gated check, not a running service | A failing CI check blocks the PR; the PR author investigates, no on-call/pager involved |

## Runbook Triggers

| Trigger | Condition | Action | Automated? |
|---------|-----------|--------|-----------|
| E2E suite failure in CI | Either suite reports a failed assertion after retry | CI job fails, PR merge blocked; author inspects Playwright's HTML/trace reporter artifact | yes (blocking), no (investigation is manual) |
| E2E suite exceeds runtime budget | Combined suite runtime approaches/exceeds NFR-001 (5 min p95) | Flagged for review — not an automated CI failure by itself, a signal to revisit A-003 (shared-server pattern) | no |

## Alerting Thresholds

Not applicable — this feature is CI-gated test infrastructure, not a running/monitored service. No metrics pipeline, no alert channel.

## Deployment Model

| Component | Strategy | Rollback Plan | Health Check |
|-----------|----------|--------------|-------------|
| E2E test suites | N/A — not deployed; runs as a CI job and via local npm scripts | Revert the commit that introduced a broken suite (standard git revert) | The suite passing (green CI) is the "health check" for the suite itself |

## Backup and Recovery

Not applicable — the ephemeral per-run temp DuckDB used by both suites is deliberately non-durable (deleted after each run, or discarded with the CI runner's ephemeral filesystem). No backup or recovery is meaningful for test fixture data.
