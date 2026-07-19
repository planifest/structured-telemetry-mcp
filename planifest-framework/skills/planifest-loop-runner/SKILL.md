---
name: planifest-loop-runner
description: Canonical loop mechanics for every pipeline loop — state file conventions, stop rules, escalation format, toggle protocol. Loaded by any phase agent entering a loop.
bundle_templates: [loop-state.template.md, loop-toggles.template.yml]
bundle_standards: [telemetry-standards.md]
hooks:
  phase: orchestrator
---

# Planifest - loop-runner

> You define how every loop in the pipeline behaves. Loops iterate; you make sure they iterate *boundedly*, *observably*, and *recoverably*. Any skill that loops (P0 completeness, design-critic, reversal protocol, verify-by-execution, cross-model review, P4 validate) loads this skill for its mechanics and defines only its own rubric and pass condition. Improvements here propagate to every loop at once.

---

## Hard Limits

1. **Every loop has an armed stop rule before its first iteration.** No cap, no loop.
2. **Agents never write `plan/current/.ratchet-approve`.** That marker is the human's approval instrument (ADR-004). Writing it yourself is a violation, not a workaround.
3. **Budget counters are never reset by an agent.** They live in the loop-state file, are git-tracked, and survive interrupt/resume (ADR-007).
4. **Run-log records are append-only.** Never rewrite a prior iteration's record.

---

## Toggle Protocol (ADR-003)

Before arming any loop, read `planifest-overrides/loop-toggles.yml` (see `templates/loop-toggles.template.yml`):

- Absent file, absent key, or unreadable/invalid value → the loop is **off**. Emit a one-line warning only for an invalid value on a known key.
- `report-only` → run the loop, write findings/verdicts, block nothing, mutate nothing.
- `on` → verdicts gate progression per the owning skill's rules.
- With every toggle off, pipeline behaviour is identical to a pipeline without loop support — zero-config regression guarantee.

The framework never creates `planifest-overrides/loop-toggles.yml`; enabling a loop is always a deliberate human act.

---

## Loop State (per instance)

Create `plan/current/loop-state-{loop-id}.md` from `templates/loop-state.template.md` when the loop arms. Update and **commit after every iteration** — the state file is how an interrupted session resumes mid-loop (`Px: Resuming…` convention), and how budget counters survive resume.

While any loop-state file has `status: active`, the `ratchet-check.mjs` hook is armed for `plan/current/` artifact writes. Set `status: done` or `status: escalated` when the loop exits — never leave a dead loop armed.

---

## The Iteration Cycle

```
while state.status == active:
  1. ACT      — do one bounded unit of loop work (one critique pass, one fix, one verification)
  2. OBSERVE  — collect the evidence (findings, check output, observed behaviour)
  3. RECORD   — append one run-log record: action, observation, decision
  4. DECIDE   — continue | done | escalate, per the stop rules below
```

One iteration = one record. Doing three passes and logging one record is a defect.

## Stop Rules

Armed on every loop, checked at every DECIDE:

| Rule | Trigger | Action |
|------|---------|--------|
| Pass | The owning skill's pass condition is met | `done` — set state, disarm |
| Iteration cap | iteration == cap (default **3**; P4 validate keeps its existing **5**; a skill may declare its own) | `escalate` |
| no-progress | The same gap/finding survives **2 consecutive iterations** without measurable change | `escalate` — do not spend the remaining cap restating the problem |
| Budget | The relevant budget counter (e.g. reversal budget 2/feature) is exhausted | `escalate` — always to the human, regardless of run mode |

Caps and budgets are enforced by orchestrator control flow reading the state file — not by this text (ADR-007). If you find yourself rationalizing "one more iteration past the cap", the control flow will stop you; file what you have.

## Escalation Format

On `escalate`, populate the state file's Escalation Context section (stop rule hit, outstanding finding, attempts summary, recommended next step) and emit:

```
Px: Blocked — {loop-id}: {one-line outstanding finding}
Escalation context: plan/current/loop-state-{loop-id}.md
```

The escalation carries **full context in the state file** — a human or a fresh session must need nothing from the dead conversation.

---

## Telemetry

Per `telemetry-standards.md` emission gate. After every RECORD step:

**`loop_iteration`**
```json
{ "loop_id": "<loop-id>", "iteration": <n>, "cap": <cap>, "decision": "continue | done | escalate", "toggle_level": "report-only | on" }
```

Emission is async and non-blocking — a telemetry failure is logged once and never stops a loop.
