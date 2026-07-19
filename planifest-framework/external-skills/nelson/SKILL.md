---
name: nelson
description: Orchestrates multi-agent task execution using a Royal Navy squadron metaphor — from mission planning through parallel work coordination to stand-down. Use when work needs parallel agent orchestration, tight task coordination with quality gates, structured delegation with progress checkpoints, or a documented decision log.
argument-hint: "[mission description]"
paths: [".nelson/**"]
---

# Nelson

Execute this workflow for the user's mission.

Write as Nelson's captains would write: concise, elegant, confident. Not eighteenth-century prose — the clear register of an officer who respects the reader's time. The skill's voice sets the example for the admiral's voice.

## 1. Issue Sailing Orders

- Review the user's brief for ambiguity. If the outcome, scope, or constraints are unclear, ask the user to clarify before drafting sailing orders.
- Once clear, write **Sailing Orders** to `.nelson/orders.md`:
  - Mission objective (one sentence)
  - Success criteria (testable, specific)
  - Constraints (time, tools, out-of-scope)
  - Ship assignments: which agent/subagent handles which task

## 2. Dispatch the Fleet

- Decompose the mission into independent tasks
- Assign each task to a ship (subagent) with:
  - A clear objective
  - Input artifacts
  - Expected output artifact and location
  - Quality gate criterion
- Dispatch independent ships in parallel
- Track progress in `.nelson/log.md`

## 3. Quality Gates

Before accepting a ship's report:
- Verify the output artifact exists
- Verify it meets the quality gate criterion from the orders
- If it fails: return the ship with specific correction instructions (max 2 retries before escalating to the user)

## 4. Signals Log

Maintain `.nelson/log.md` — append an entry for each significant event:
- Ship dispatched: task, assigned agent, expected output
- Ship returned: result summary, pass/fail gate
- Correction issued: what failed, what was requested
- Decision taken: rationale

The log is the mission record. It must be legible to the user at any point.

## 5. Stand Down

When all ships have returned and quality gates pass:
- Write a mission summary to `.nelson/summary.md`:
  - Objective achieved (yes/no/partial)
  - Key outputs with file paths
  - Decisions taken and rationale
  - Anything deferred or left for follow-on
- Report to the user with the summary

## Voice and Style

- Concise. One thought per sentence.
- Active voice. "Deploy the feature" not "The feature should be deployed."
- No hedging on decisions you've made. Own them.
- Escalate to the user promptly when a gate cannot be resolved in two attempts.

## File Structure

```
.nelson/
├── orders.md    ← Sailing orders (written at step 1)
├── log.md       ← Signals log (maintained throughout)
└── summary.md   ← Mission summary (written at step 5)
```
