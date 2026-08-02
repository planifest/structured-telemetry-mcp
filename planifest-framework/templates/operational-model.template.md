# Operational Model - {{feature-name}}

**Skill:** [spec-agent](../skills/spec-agent-SKILL.md)
**Feature:** {{feature-id}}
**Version:** {{semver}}

## Component Ownership

| Component | Owner (team/role) | On-call Rotation | Escalation Path |
|-----------|------------------|-----------------|-----------------|
| {{component-id}} | {{team}} | {{rotation details}} | {{who to escalate to}} |

## Runbook Triggers

| Trigger | Condition | Action | Automated? |
|---------|-----------|--------|-----------|
| {{trigger name}} | {{metric > threshold or event}} | {{what to do}} | yes / no |

## Alerting Thresholds

| Alert | Metric | Warning Threshold | Critical Threshold | Channel |
|-------|--------|-------------------|-------------------|---------|
| {{alert name}} | {{metric name}} | {{value}} | {{value}} | {{slack / pagerduty / email}} |

## Deployment Model

| Component | Strategy | Rollback Plan | Health Check |
|-----------|----------|--------------|-------------|
| {{component-id}} | rolling / blue-green / canary | {{how to rollback}} | {{health endpoint or check}} |

## Backup and Recovery

| Data Store | Backup Frequency | Retention | Recovery Time Objective | Recovery Point Objective |
|-----------|-----------------|-----------|------------------------|------------------------|
| {{database/store}} | {{frequency}} | {{retention period}} | {{RTO}} | {{RPO}} |

