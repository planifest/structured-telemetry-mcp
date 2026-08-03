# Operational Model - log-viewer-enhancements

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000017-log-viewer-enhancements
**Version:** 0.13.0

## Component Ownership

| Component | Owner (team/role) | On-call Rotation | Escalation Path |
|-----------|------------------|-----------------|-----------------|
| structured-telemetry-mcp | Single local developer (the human on the loop) | None — local single-developer tool, no on-call | N/A — human debugs their own local service via `npm run service:status` / logs |

## Runbook Triggers

| Trigger | Condition | Action | Automated? |
|---------|-----------|--------|-----------|
| UI shows backend-unreachable banner on initial load | `GET /health` fails or times out from the UI | Human runs `npm run service:status`, then `npm run service:restart` if needed | no |
| `#auto-refresh-status` shows a persistent "retrying" message across many poll cycles | Repeated poll failures while auto-refresh is on | Same as above — the underlying backend, not the polling logic, is the likely cause | no |
| `event_log` or `distinct_values` query exceeds NFR-001 latency in practice | Manually noticed slow page loads or slow suggestion pop-in | Re-check A-002 (data volume assumption); consider an index on frequently-suggested/sorted columns | no |

## Alerting Thresholds

Not applicable — no monitoring/alerting infrastructure exists or is being added for this local, single-developer, no-SLO tool, unchanged from 0000015.

## Deployment Model

| Component | Strategy | Rollback Plan | Health Check |
|-----------|----------|--------------|-------------|
| structured-telemetry-mcp | In-place restart of the existing local service (launchd/systemd/nssm) after `npm run deploy` | `git revert` the feature commit(s), rebuild, redeploy — no traffic-shifting rollback needed for a single local process | Existing `GET /health` endpoint |

## Backup and Recovery

| Data Store | Backup Frequency | Retention | Recovery Time Objective | Recovery Point Objective |
|-----------|-----------------|-----------|------------------------|------------------------|
| DuckDB `telemetry.db` | None — unchanged by this feature. No schema change, no new backup requirement introduced. | N/A | N/A | N/A |
