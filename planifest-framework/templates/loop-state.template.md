---
title: "Loop State: {{loop-id}}"
summary: "Persisted state for one loop instance — survives context resets and session interrupts."
status: "active | done | escalated"
---
# Loop State: {{loop-id}}

> Path: `plan/current/loop-state-{loop-id}.md`. Git-tracked; committed after every
> update so budget/iteration counters survive interrupt/resume (ADR-007). Resume
> convention: see `pause.template.md`. While a loop-state file has `status: active`, the
> ratchet hook is armed for `plan/current/` artifact writes.

| Field | Value |
|-------|-------|
| Loop id | `{{p0_completeness \| design_critic \| reversal_protocol \| verify_by_execution \| cross_model_review}}` |
| Owning phase | `{{P0–P6}}` |
| Toggle level | `{{report-only \| on}}` |
| Iteration | `{{n}}` of cap `{{3 (default) — P4 validate keeps 5}}` |
| Reversal budget remaining | `{{2 − grants this feature}}` (shared across all loops; feature-wide) |
| Last decision | `{{continue \| done \| escalate}}` |
| Last updated | `{{ISO-8601 UTC}}` |

---

## Run Log

Append-only — one record per iteration. Never rewrite a prior record.

### Iteration {{n}} — {{ISO-8601 UTC}}
- **Action:** {{what the loop did this iteration}}
- **Observation:** {{what was found/measured — findings, check results, evidence}}
- **Decision:** {{continue | done | escalate}} — {{one-line reason}}

---

## Escalation Context

Populated only when `status: escalated`.

- **Stop rule hit:** {{iteration cap | no-progress (same finding 2 consecutive iterations) | budget exhausted}}
- **Outstanding gap/finding:** {{exact statement}}
- **What was attempted:** {{summary across iterations}}
- **Recommended next step:** {{for the human}}
