---
title: "Backlog Entry: 00029 - consistency-check.mjs cannot resolve cross-feature ADR references"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "medium"
---
# Backlog Entry: 00029 - consistency-check.mjs cannot resolve cross-feature ADR references

**Source feature:** 0000019-loopback-daemon-hardening
**Source phase:** P1 (design-critic gate, iteration 1)

**Date filed:** 2026-08-08

---

## Problem

`planifest-framework/scripts/consistency-check.mjs:74` resolves ADR references against a single directory:

```js
const adrDir = join(dir, "adr");
```

Only ADRs *owned by the feature currently in `plan/current/`* live there. Every ADR from a prior feature lives in `plan/_archive/{feature}/adr/`. The script has no knowledge of the archive, so **any reference to a prior feature's ADR is reported as a missing file**, and the script exits 1.

This is structural, not incidental. In an iterative project, requirements referencing established architectural decisions is the normal and desirable case — it is how a constraint gets carried forward. The more disciplined the traceability, the more findings the script emits.

Measured on this repository:

| Artifact set | Exit | Findings | Of which cross-feature ADR refs |
|---|---|---|---|
| `0000019` P1 (current, post-revision) | 1 | 18 | 18 (all of them) |
| `0000018` archive (shipped 0.14.0) | 1 | 23 | 13 |

The shipped 0000018 release fails the same check. So does its predecessor pattern of referencing ADR-002, ADR-014, ADR-016, ADR-017, ADR-018 and ADR-024 from a feature that owned none of them.

## Why this matters beyond noise

The `planifest-design-critic` skill treats a non-zero exit as an **automatic REJECT that no rubric judgement overrides**. Combined with the above, that rule cannot be satisfied by any feature in an established codebase — the gate is unpassable by construction, which pushes a reviewing agent toward either rubber-stamping the failure or manually re-classifying findings each run. Both erode the value of having a mechanical gate at all.

A gate that always fails teaches everyone to ignore it. That is worse than no gate.

## Suggested Action

- Resolve ADR ids against the union of `{dir}/adr/` and `plan/_archive/*/adr/`, so a reference to an accepted prior decision resolves.
- Keep reporting a genuinely dangling reference — an id that exists nowhere — as a finding. That is the check's real value and it should survive the fix.
- Consider distinguishing a **forward reference to an ADR this feature will create at P2** (ADR-032 during 0000019's P1) from a dangling one. A P1 artifact naming its own upcoming ADR is correct practice, not a defect.
- Separately, reconsider the 3-acceptance-criteria cap at `consistency-check.mjs:68`. It is currently breached by 10/10 requirements in the last shipped feature and was breached by 12/12 in this one before revision. Either it is the right rule and nothing has ever complied, or the threshold is wrong. Worth a deliberate decision rather than a permanently-red line.

## Why Deferred

The fix lives entirely in `planifest-framework/scripts/`. Per the Framework Update Policy in `CLAUDE.md`, framework changes are committed directly as tooling maintenance and are not routed through this product's P0-P9 pipeline.

It was also deliberately **not** fixed inline during 0000019's P1, on the principle that an agent should not modify the quality gate that is currently judging its own output. Filed for a human to decide on instead.
