---
title: "Iteration Log - {{feature-id}}"
summary: "Execution log for the agent session."
status: "active"
version: "0.1.0"
---
# Iteration Log - {{feature-id}}

> **Audience:** Build-assessment-agent (P8) and post-run technical review. This is NOT the PR changelog — the PR changelog (written by ship-agent Step 1) is the human-readable audit trail for PR reviewers.

**Skill:** [docs-agent](../skills/planifest-docs-agent/SKILL.md) (or whichever agent completes the final iteration step)
**Date:** {{ISO-8601}}
**Wave:** {{wave-number}} (if waved)

## Iteration Steps Completed

| Phase | Status | Gate Result | Notes |
|-------|--------|-------------|-------|
| 0 - Assess & Coach | {{pass/skip}} | Design confirmed: {{yes/no}} | {{coaching rounds count}} |
| 1 - Specification | {{pass/fail/skip}} | All artifacts produced: {{yes/no}} | |
| 2 - ADRs | {{pass/fail/skip}} | {{n}} ADRs generated | |
| 3 - Code Generation | {{pass/fail/skip}} | Implementation complete: {{yes/no}} | {{deviations count}} |
| 4 - Validation | {{pass/fail/blocked}} | CI clean: {{yes/no}} | {{self-correct cycles}} cycles |
| 5 - Security | {{pass/fail/skip}} | Critical findings: {{count}} | |
| 6 - Docs & Ship | {{pass/fail/skip}} | All docs synced: {{yes/no}} | |

## Requirement Changes During Run

| Change | Phase Active | Classification | Action Taken |
|--------|-------------|----------------|-------------|
| {{description}} | {{phase number}} | cosmetic / additive / contradictory | {{what was re-run}} |

## Self-Correct Log

{{what failed and how it was fixed - each attempt with the error and the fix}}

## Quirks

{{anything unusual noticed during the run - written to docs/quirks.md and component.yml}}

## Recommended Improvements

{{what should be reviewed before the PR - these are not blockers, but flagged for human attention}}

