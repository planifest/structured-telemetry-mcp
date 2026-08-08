---
title: "Backlog Entry: {{id}} - {{short-title}}"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
---
# Backlog Entry: {{id}} - {{short-title}}

> Path: `plan/backlog/{id}-{slug}/entry.md` — one folder per entry, `{id}` zero-padded sequence, `{slug}` kebab-case.
>
> **`{id}` is its own sequence — collisions with feature IDs are expected.** Next
> `{id}` = highest ever allocated + 1, including picked-up and discarded entries.
>
> **Deferral source** distinguishes why the entry exists: `discovered mid-flight`
> (a surprise found during a run, judged out of scope on the spot — today's only
> case for ad hoc filings), `deliberate scope decision` (a call already made and
> reasoned through in the source feature's own `scope.md`/ADRs — this entry
> points back at that reasoning rather than repeating it), or `tech debt`
> (acknowledged debt filed alongside the code that incurred it). Entries routed
> automatically from a `recommendations.md` Deferred Items or Tech Debt row use
> `deliberate scope decision` or `tech debt` respectively; entries filed live
> during a run use `discovered mid-flight`.

**Source feature:** {{feature-id that discovered this}}
**Source phase:** {{P0–P9 phase active when discovered}}
**Deferral source:** {{discovered mid-flight | deliberate scope decision | tech debt}}
**Date filed:** {{ISO-8601 date}}

---

## Problem

{{What was discovered. Specific enough that a future P0 — with no memory of this
session — can judge whether to pull it in. Name files/paths where relevant.}}

## Suggested Action

{{One or two sentences: what fixing it would look like. A suggestion, not a spec —
scope is decided at pickup.}}

## Why Deferred

{{Why this was not folded into the active feature: out of scope / non-blocking /
would need its own design decision.}}
