---
title: "Scope - telemetry-log-viewer-ui"
summary: "Defines explicit boundaries of what is in scope and out of scope."
status: "active"
version: "0.1.0"
---
# Scope - telemetry-log-viewer-ui

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000015-telemetry-log-viewer-ui
**Wave:** 1 (single wave)
**Version:** 0.11.0

## In Scope

- Optional `product_id` field on the telemetry event envelope schema, plus a nullable `product_id VARCHAR` DB column added via a written, human-approved migration proposal
- `event_log` query changes: `offset`-based pagination, `total_count` in the response, `sort` param (default `asc`, back-compat), new filters (`phase`, `agent`, `product_id`, `from`, `to`), removal of the mandatory scope-filter requirement (bounded solely by `limit`/`offset` instead, with a max-`limit` misuse guard)
- Expansion of `event_log`'s SQL `SELECT` to return every `events` column, not just the current 8
- A new static browser page (`GET /ui` on the existing `server-http.ts` process) with: paginated, newest-first event table; controls for all confirmed filters; a row-click detail view showing full pretty-printed JSON; empty-state and backend-unreachable-banner handling
- URL-query-string persistence of filters/page/page-size/sort

## Out of Scope

Nothing in this feature's problem space is permanently excluded — see Deferred. There is no item here that has been ruled out.

## Deferred

- Aggregation/dashboard views in the UI (bottleneck/failure/token-efficiency charts) — blocked until there is a specific need beyond raw event browsing; these remain MCP/REST-only for now
- Authentication / multi-user access — blocked until this tool needs to run for more than one person; today's no-auth, 127.0.0.1-only posture is intentional and matches the existing project convention
- Editing or deleting events from the UI — blocked until there is a specific, deliberate need; the viewer is read-only by design, not by omission
- Live auto-refresh / tail mode — blocked until manual refresh proves too slow in practice
- Backfilling `product_id` on historical rows — blocked permanently by a lack of reliable signal: other projects besides this repo have also emitted to the shared `$HOME/.planifest/telemetry.db` historically, so there is no way to reconstruct which repo emitted a given pre-existing row. Not a "not yet" — a "cannot"
- `planifest-framework`'s own emitters populating `product_id` — blocked on that product's own pipeline picking up `plan/backlog/00002-framework-product-id-emission/entry.md`; this feature does not implement it (cross-product boundary, see design.md)
