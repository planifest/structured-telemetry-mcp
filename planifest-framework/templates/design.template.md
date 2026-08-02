# Design - {feature-id}

## Feature
- Problem: {one-line problem statement}
- Adoption mode: greenfield | standard-iterative | retrofit | external-anchor
- Feature ID: {0000000}-{kebab-case-name}
- Discovery: see `plan/current/discovery.md` (raw P0 findings — do not embed them here; this document records confirmed decisions only)

## Product Layer
- User stories:
  - US-001: As a [role], I [action], so that [outcome]
- Acceptance criteria confirmed: {count}
- Constraints: {list}
- Integrations: {list or "none"}

## Architecture Layer
- Latency target: {value or "deferred - recorded in scope"}
- Availability target: {value or "deferred - recorded in scope"}
- Scalability target: {value or "deferred - recorded in scope"}
- Security: {auth strategy, authz model, data classification}
- Data privacy: {regulations, PII handling, retention policy or "no regulated data"}
- Observability: {logging/metrics/tracing strategy or "standard defaults"}
- Cost boundary: {value or "not constrained"}

## Engineering Layer
- Stack: {frontend / backend / database / ORM / IaC / cloud / compute / CI / Build target}
- Components: {list with one-liner per component}
- Data ownership: {component -> dataset mapping}
- Deployment: {topology summary}
- API versioning: {strategy or "not applicable"}

## Scope
- In: {list}
- Out: {list}
- Deferred: {list - with notes on what is blocked until resolved}

## Assumptions
- {assumption} - impact if wrong: {what breaks}

## Risks
- {list with likelihood/impact}

## Dependencies
- Upstream: {list}
- Downstream: {list}

## Active Skills
{List of capability skills available for this run, or "None"}

## Skill Map
| Requirement | Best-fit Skill | Rationale |
|-------------|----------------|-----------|
| {REQ-NNN} - {slug} | planifest-{skill-name} | {one-line reason} |

## Repo Instructions
{Contents of planifest-overrides/instructions/ files, or "None"}

## Confirmation
Human confirmed this design before proceeding: yes / no // Date and Time confirmed: {DD MMM YYYY} @ {HH:MM AM/PM} {timezone abbreviation}
