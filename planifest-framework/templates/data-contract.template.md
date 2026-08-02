---
title: "Data Contract: {{component-name}}"
summary: "Defines the precise schema and relationships of data owned by this component."
status: "draft | active"
version: "0.1.0"
---
# Data Contract - {{component-name}}

**Skill:** [codegen-agent](../skills/codegen-agent-SKILL.md) (updated via migration proposals)
**Component:** {{component-id}}
**Feature:** {{feature-id}}
**Owner:** {{component-id}}
**Schema Version:** {{semver}}

> This is the authoritative schema definition for this component's data.

## Tables

### {{table-name}}

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|------------|
| {{column}} | {{type}} | yes / no | {{default}} | {{PK, FK, unique, check}} |

**Indexes:**
- {{index description}}

**Relationships:**
- {{type}} to {{target-table}} via {{foreign-key}}

## Invariants

- {{invariant-1}}
- {{invariant-2}}

## Migration History

| ID | Version | Description | Status | Destructive |
|----|---------|------------|--------|------------|
| M-001 | 0.1.0 | Initial schema | applied | no |

