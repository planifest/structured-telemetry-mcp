---
title: "Revision Log - {{feature-id}}"
summary: "One entry per artifact rev-bumped by a granted reversal — the audit trail that makes reversals reconstructable."
---
# Revision Log - {{feature-id}}

> Path: `plan/current/revision-log.md`. Created on the first granted reversal.
> Every artifact revised by a reversal gets exactly one entry per revision.
> Together with the defect report, verdict, cascade list, and gate record this
> makes each reversal reconstructable from artifacts alone (NFR-005).

| # | Artifact | Version | Defect Report | Classification | Date |
|---|----------|---------|---------------|----------------|------|
| 1 | `{{plan/current/... path}}` | {{0.1.0 → 0.2.0}} | [{{seq}}-{{slug}}](defect-reports/{{seq}}-{{slug}}.md) | {{additive \| altering}} | {{ISO-8601}} |

---

## Cascade Records

One block per granted reversal — written *before* any re-work starts (ADR-005).

### Reversal {{seq}} — {{date}}
- **Revised artifact(s):** {{paths}}
- **Invalidation cascade ({{n}} artifacts{{; >3 = human gate}}):**
  - {{path — why invalidated (traceability link)}}
- **Human gate:** {{not required (additive, ≤3 cascade, continuous run) | approved by human {{date}}}}
