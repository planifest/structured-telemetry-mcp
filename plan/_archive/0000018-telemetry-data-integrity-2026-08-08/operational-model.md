# Operational Model - Telemetry Data Integrity

**Skill:** [spec-agent](../skills/spec-agent-SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Version:** 0.14.0

> This is a local, single-user daemon (no cloud deployment, no team on-call rotation, no paging infrastructure — design.md Architecture Layer). The tables below reflect that reality rather than inventing SRE infrastructure this product does not have.

## Component Ownership

| Component | Owner (team/role) | On-call Rotation | Escalation Path |
|-----------|------------------|-----------------|-----------------|
| structured-telemetry-mcp | The developer running it locally — no team, no rotation | None — single-user tool | `npm run doctor`, then the restore procedure (req-006), then the project's issue tracker if neither resolves it |

## Runbook Triggers

| Trigger | Condition | Action | Automated? |
|---------|-----------|--------|-----------|
| Daemon refuses to start | Startup self-check reports an unopenable database (req-004) | Read the printed message (file path, PID if applicable, recovery step); follow the restore procedure linked from it | no — message is automated, remediation is manual by design (decision D: no auto-remediation) |
| `doctor` reports "no verified backup" | No backup has ever completed verify → promote (req-006/007) | Investigate whether the backup trigger mechanism (pending P2 ADR) is actually running | no |
| `doctor` reports a stale verified-backup age | Age exceeds what the operator expects given the daily schedule | Check backup routine logs for repeated verification failures (req-006) | no |
| Deploy exits non-zero on build-identity mismatch | `buildId` returned by `/health` differs from the just-built bundle's hash (req-008) | Re-run `deploy`; if it persists, manually restart the service | no |
| Deploy exits non-zero on orphan port holder | A process not managed by launchd/systemd is bound to port 3741 (req-009) | Run the printed `kill <pid>` command manually, then re-run `deploy` | no — deploy deliberately never kills the foreign process itself |

## Alerting Thresholds

Not applicable. There is no alerting channel (Slack/PagerDuty/email) for a local single-user tool. The equivalent signal is `npm run doctor`'s output, checked on demand by the operator, and the startup self-check message, which is unmissable (the daemon does not start).

## Deployment Model

| Component | Strategy | Rollback Plan | Health Check |
|-----------|----------|--------------|-------------|
| structured-telemetry-mcp | In-place restart via `npm run deploy` (build, then platform-specific restart) — req-008/009 add build-identity and orphan-port verification to this same flow | `git checkout` the previous commit and re-run `npm run deploy`; no automated rollback exists or is in scope | `GET /health`, gaining an additive `buildId` field this feature (req-008) |

## Backup and Recovery

| Data Store | Backup Frequency | Retention | Recovery Time Objective | Recovery Point Objective |
|-----------|-----------------|-----------|------------------------|------------------------|
| `telemetry.db` (DuckDB, req-006) | Daily | 7 daily + 4 weekly (~1 month) | Manual restore, minutes — no automated failover exists or is in scope | ≤ 24 hours (time since the last verified daily backup) plus ≤ 60s/100 events from the last checkpoint if the live database itself is also intact (req-001/002) |
