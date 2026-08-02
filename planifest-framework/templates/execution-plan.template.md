# Execution Plan - {{feature-name}}

> Every requirement must be traceable to a user story or acceptance criterion.

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** {{feature-id}}
**Wave:** {{wave-number}} (if waved)
**Version:** {{semver}}
**Status:** draft | active | superseded

## Active Skills

| Skill | Scope | Purpose |
|-------|-------|---------|
| {{skill-name}} | plan \| permanent | {{what it provides}} |

## Functional Requirements Directory

Functional requirements are split into individual files — one user story per file — at `plan/current/requirements/`.

Each file follows the naming convention `req-{NNN}-{kebab-slug}.md` and the [Requirement Template](../templates/requirement.template.md).

| File | Requirement |
|------|------------|
| [req-001-{kebab-slug}.md](requirements/req-001-{kebab-slug}.md) | {{one-line description}} |

## Non-Functional Requirements

| ID | Category | Requirement | Target | Measurement |
|----|----------|------------|--------|-------------|
| NFR-001 | Performance | {{requirement}} | {{measurable target}} | {{how measured}} |
| NFR-002 | Security | {{requirement}} | {{measurable target}} | {{how measured}} |

> "The system should be fast" is not a requirement. "p95 latency < 200ms for the primary endpoint" is.

## API Summary

The full contract is in `openapi-spec.yaml`.

| Method | Path | Description | Feature |
|--------|------|-------------|---------|
| POST | /api/v1/{{resource}} | {{what it does}} | {{feature-name}} |

## Data Model Summary

The full schema is in the component's data contract.

| Entity | Owner Component | Key Fields | Relationships |
|--------|----------------|------------|--------------|
| {{entity}} | {{component-id}} | {{fields}} | {{relationships}} |

## Component Interactions

```mermaid
flowchart LR
    A[{{component}}] -->|{{method}}| B[{{component}}]
    B -->|{{method}}| C[{{component}}]
```

## Assumptions

Each is a risk item with likelihood: medium.

| ID | Assumption | Impact if Wrong |
|----|-----------|----------------|
| A-001 | {{assumption}} | {{what breaks}} |

## Open Questions

Reported to the orchestrator - not filled in by assumption.

| ID | Question | Blocking |
|----|----------|----------|
| Q-001 | {{question}} | {{what is blocked}} |

