# Cost Model - E2E Playwright Test Suites

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000016-e2e-playwright-test-suites
**Version:** 0.1.0

> Estimates must be based on the design requirements's scale requirements.

## Summary

| Category | Estimated Monthly Cost | Notes |
|----------|----------------------|-------|
| Compute | $0 (marginal) | Runs on existing GitHub Actions minutes already allocated to this repo's CI; no new infrastructure provisioned |
| Storage | $0 | Ephemeral temp DuckDB per run, deleted/discarded — nothing persisted |
| Network / Egress | $0 | Local-only (127.0.0.1) traffic within the CI runner; Chromium binary download is a one-time/cached CI step, not a recurring egress cost |
| Third-party Services | $0 | `@playwright/test` and `@playwright/mcp` are open-source npm packages, no paid service |
| **Total** | **$0 (marginal)** | Cost is CI minutes only — see below |

## Compute Costs

| Component | Service | Instance / SKU | Quantity | Unit Cost | Monthly Cost | Scaling Trigger |
|-----------|---------|---------------|----------|-----------|-------------|----------------|
| E2E test suites | GitHub Actions (existing plan) | Standard runner | ~1 job per PR/push | Included in existing GitHub Actions allocation (public repo or existing paid minutes) | Marginal — additional ~5 min/PR added to an already-running CI job | PR/push frequency |

## Storage Costs

Not applicable — no persistent storage added by this feature.

## Network / Egress Costs

Not applicable — no external network calls; all traffic is `127.0.0.1`-local within the CI runner.

## Third-party Services

| Service | Purpose | Pricing Model | Estimated Usage | Monthly Cost |
|---------|---------|--------------|----------------|-------------|
| @playwright/test (npm, open-source) | E2E test framework | Free / open-source | N/A | $0 |
| @playwright/mcp (npm, open-source) | Interactive test authoring aid (P3 only, not CI) | Free / open-source | N/A | $0 |

## Assumptions

1. Existing GitHub Actions minutes allocation already covers this repo's CI (no new billing tier triggered) — the added ~5 min/PR (NFR-001) is assumed to be within existing headroom.
2. No paid Playwright Test Cloud / sharding service is used — suites run within a single existing CI job.
