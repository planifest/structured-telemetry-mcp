# Operational Model - telemetry-log-viewer-ui

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000015-telemetry-log-viewer-ui
**Version:** 0.11.0

## Component Ownership

| Component | Owner (team/role) | On-call Rotation | Escalation Path |
|-----------|------------------|-----------------|-----------------|
| structured-telemetry-mcp | Single local developer (the human on the loop) | None — local single-developer tool, no on-call | N/A — human debugs their own local service via `npm run service:status` / logs |

## Runbook Triggers

| Trigger | Condition | Action | Automated? |
|---------|-----------|--------|-----------|
| UI shows backend-unreachable banner | `GET /health` fails or times out from the UI | Human runs `npm run service:status`, then `npm run service:restart` if needed | no |
| `event_log` query exceeds NFR-001 latency in practice | Manually noticed slow page loads | Re-check A-002 (data volume assumption); consider cursor-based pagination | no |

## Alerting Thresholds

Not applicable — no monitoring/alerting infrastructure exists or is being added for this local, single-developer, no-SLO tool. This section is intentionally left without invented thresholds (SLO Definitions likewise records "not applicable" rather than fabricating targets).

## Deployment Model

| Component | Strategy | Rollback Plan | Health Check |
|-----------|----------|--------------|-------------|
| structured-telemetry-mcp | In-place restart of the existing local service (launchd/systemd/nssm) after `npm run deploy` | `git revert` the feature commit(s), rebuild, redeploy — no traffic-shifting rollback needed for a single local process | Existing `GET /health` endpoint |

## Backup and Recovery

| Data Store | Backup Frequency | Retention | Recovery Time Objective | Recovery Point Objective |
|-----------|-----------------|-----------|------------------------|------------------------|
| DuckDB `telemetry.db` | None — unchanged by this feature. No new backup requirement introduced; the `product_id` column addition is additive and does not change existing backup posture (there is none, matching the tool's local/dev-only classification) | N/A | N/A | N/A |
