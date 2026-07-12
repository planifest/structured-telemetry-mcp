---
title: "Defect Report: {{seq}} - {{short-title}}"
summary: "A P3–P6 agent is blocked by an upstream P0–P2 artifact and petitions for a governed reversal."
status: "filed | assessing | granted | denied"
---
# Defect Report: {{seq}} - {{short-title}}

> Path: `plan/current/defect-reports/{seq}-{slug}.md`. Filing halts the reporting
> agent's current task and hands control to the orchestrator, which spawns a
> fresh-context `planifest-reversal-assessor` (never the filer) to judge it
> (ADR-006). All five sections are required — an incomplete report is returned to
> the filer, not assessed. Valid only from P3–P6 against live P0–P6 artifacts;
> nothing archived at P7 can be the subject of a report. A re-filed report for a
> previously denied defect escalates straight to the human.

**Filed by:** {{phase + agent, e.g. P3 planifest-codegen-agent}}
**Date:** {{ISO-8601 UTC}}
**Reversal budget remaining before this petition:** {{n}} of 2

---

## What Is Blocked

{{The requirement/task that cannot proceed, by id and path.}}

## Binding Upstream Artifact

{{The exact artifact that causes the block: criterion, ADR, or spec section —
path + section/line reference. This is what a granted reversal would revise.}}

## Attempts Made

{{At least one required. What was tried within the current design, and why each
attempt cannot satisfy the requirement as specified.}}

## Evidence

{{Test output, error text, or the concrete contradiction — verbatim where
possible. The assessor judges on this, not on the narrative.}}

## Proposed Correction Scope

{{The smallest change to the binding artifact that unblocks the work, and which
downstream artifacts the filer believes it invalidates (the assessor recomputes
this from traceability).}}
