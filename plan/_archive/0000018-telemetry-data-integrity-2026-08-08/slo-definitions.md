# SLO Definitions - Telemetry Data Integrity

**Skill:** [spec-agent](../skills/spec-agent-SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Version:** 0.14.0

> Based on this feature's NFRs (execution-plan.md), not aspirational. This is a local single-user tool with no rolling-window monitoring infrastructure — targets below are what req-001–010's acceptance criteria actually guarantee, stated in SLO form for traceability, not measured continuously in production.

## Service Level Objectives

| SLO ID | Service / Component | SLI (what is measured) | Target | Window | Error Budget |
|--------|-------------------|----------------------|--------|--------|-------------|
| SLO-001 | structured-telemetry-mcp (durability) | Events lost on an unclean process kill, relative to the last checkpoint | ≤ 60 seconds / 100 events, whichever smaller, per incident | per-incident (not a rolling window — verified by test, req-001/002) | N/A — this is a hard bound asserted by test, not a statistical budget |
| SLO-002 | structured-telemetry-mcp (backup) | Proportion of scheduled daily backups that complete verify → promote successfully | 100% attempted daily; any single failure degrades to a warning, not a missed SLO breach, per the "degrade and keep serving" posture | 30-day rolling (informal — no monitoring system tracks this automatically) | Not tracked automatically; `doctor`'s staleness report is the substitute signal |
| SLO-003 | structured-telemetry-mcp (deploy correctness) | Proportion of deploys that correctly detect a build-identity mismatch when one exists | 100% (NFR-005) | per-deploy (verified by test, req-008/009) | N/A — correctness requirement, not a statistical target |
| SLO-004 | structured-telemetry-mcp (pagination) | Proportion of full-result-set pagination runs with zero dropped/duplicated rows | 100% (NFR-004) | per-query (verified by test, req-010) | N/A — correctness requirement, not a statistical target |

## SLI Definitions

| SLI ID | Name | Measurement Method | Data Source | Good Event Definition | Valid Event Definition |
|--------|------|-------------------|-------------|----------------------|----------------------|
| SLI-001 | Data-at-risk window | `kill -9` under sustained write; count events present after reopen | Test harness (req-001/002 acceptance criteria) | Loss ≤ 60s / 100 events | Any unclean-kill test run |
| SLI-002 | Backup verification success | Backup routine's own verify step (row-count assertion) | Sidecar metadata file written by req-006 | Row count at scratch-restore matches count pinned at export time | Any completed export attempt |
| SLI-003 | Build-identity detection | Deploy's post-restart comparison of computed hash vs. `/health`'s reported `buildId` | `deploy` action output (req-008) | Mismatch correctly detected and reported non-zero; match correctly passes | Any deploy run against a running daemon |
| SLI-004 | Pagination completeness | Union of all pages compared to the seeded source set | Regression test (req-010) | Union equals source set exactly | Any full pagination of a duplicate-sort-key seed set |

## Error Budget Policy

Not applicable in the standard sense — there is no team, no rolling-window monitoring, and no velocity-vs-reliability tradeoff to govern for a single-user local tool. SLO-001, SLO-003, and SLO-004 are correctness bars enforced by CI (P4), not statistical budgets that can be "spent." SLO-002 is the one target with genuine day-to-day variance (a backup can legitimately fail once due to transient contention); its policy is: a single failure is a warning, not an incident; `doctor` reporting staleness beyond ~2 days without explanation is the informal trigger to investigate.

## Burn Rate Alerts

Not applicable. No alerting pipeline exists for this product (see `operational-model.md`'s Alerting Thresholds section).
