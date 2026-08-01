# Design - 0000015-telemetry-log-viewer-ui

## Feature
- Problem: Developers must hand-write JSON queries via curl or an MCP tool call to inspect telemetry; there is no browsable view for casual inspection.
- Adoption mode: standard-iterative
- Feature ID: 0000015-telemetry-log-viewer-ui
- Version: 0.11.0 (minor bump from 0.10.4, Feature Pipeline default — product.yml, versionPolicy: max-component-version)
- Discovery: n/a (standard-iterative — no retrofit discovery pass required)

## Product Layer
- User stories:
  - US-001: As a developer, I see which repo/project emitted each event, so that I can distinguish events across the multiple projects sharing one telemetry DB. (product_id Tagging)
  - US-002: As a developer, I view a paginated table of telemetry events (newest first, with a total count), so that I can browse history without hand-writing queries. (Event Log Table)
  - US-003: As a developer, I filter the event table by session_id, initiative_id, event_type, phase, agent, product_id, and a full timestamp range, so that I can narrow down to relevant events. (Event Filtering)
  - US-004: As a developer, I click a row to see the event's full JSON (envelope + typed data payload), so that I can inspect fields not shown in the table. (Event Detail View)
- Acceptance criteria confirmed: 8 (see feature-brief.md)
- Constraints: no build step/bundler/new frontend dependency; must not modify planifest-framework's hook scripts; schema changes are additive-only and require a migration proposal + human approval
- Integrations: none external — UI talks only to the existing local backend

## Architecture Layer
- Latency target: p95 < 300ms per page load/query
- Availability target: deferred — best-effort, no SLO (local single-developer tool)
- Scalability target: deferred — single local developer's data volume; revisit pagination strategy if missed
- Security: no auth; server remains bound to 127.0.0.1 only (unchanged existing posture)
- Data privacy: no regulated data; UI makes zero external network calls (telemetry may contain free-text agent-authored fields that must stay local)
- Observability: standard defaults (existing telemetry-on-telemetry emission via this session's own P0-P9 run)
- Cost boundary: not constrained (local, no cloud spend)

## Engineering Layer
- Stack: TypeScript (backend, existing) + vanilla JS/HTML/CSS (frontend, new, no build step) / Node.js runtime / no framework (raw node:http) / DuckDB (existing) / no ORM / Vitest / no IaC / no cloud / local persistent process / existing CI / Build target: local
- Components: structured-telemetry-mcp (existing, extended) — no new component created
- Data ownership: `events` table (incl. new `product_id` column) owned by structured-telemetry-mcp; read by MCP `query_telemetry`, REST `/query`, and the new UI (same process)
- Deployment: unchanged — existing local service (launchd/systemd/nssm), UI served as static assets from the same `server-http.ts` process on 127.0.0.1:3741
- API versioning: not applicable (internal REST endpoint, additive query params only)

## Scope
- In: product_id schema field + DB column + migration proposal; event_log query offset pagination/total_count/sort/new filters (phase, agent, product_id, from/to); static browser UI (table, filters, detail view, URL-state persistence); empty-state and backend-unreachable handling
- Out: nothing permanently excluded — see Deferred
- Deferred: aggregation/dashboard views in the UI; auth/multi-user access; editing/deleting events; live auto-refresh/tail; backfilling product_id on historical rows (not feasible — other projects besides this repo have also used the shared DB); planifest-framework's own emitters populating product_id (cross-product dependency, filed as plan/backlog/00002-framework-product-id-emission)

## Assumptions
- The existing server-http.ts process (127.0.0.1:3741) is the right place to serve the UI's static assets - impact if wrong: UI would need its own process/port, adding deployment complexity
- Local event volumes are small enough for offset pagination to perform well - impact if wrong: revisit pagination strategy (e.g. cursor-based) if the latency NFR is missed at realistic data volumes

## Risks
- Schema/DB migration (product_id column) requires a written migration proposal and explicit human approval before application — likelihood: certain (process step), impact: low (additive, non-destructive, blocking only until approved)
- ADR-010 relaxation (removing the mandatory scope-filter requirement on event_log queries) changes existing query behavior/contract — likelihood: certain, impact: medium — needs an ADR recording the change and its bounding rationale (limit/offset always required instead)
- Historical rows permanently show product_id as "unknown" — likelihood: certain, impact: low (explicitly accepted, documented, not a defect)

## Dependencies
- Upstream: none new
- Downstream: planifest-framework's telemetry hooks should eventually populate product_id (tracked in plan/backlog/00002-framework-product-id-emission) — this feature does not block on that; historical/interim events simply show "unknown"

## Active Skills
None (no capability skills installed for this run — plain vanilla JS/HTML frontend needs no framework-specific skill)

## Skill Map
| Requirement | Best-fit Skill | Rationale |
|-------------|----------------|-----------|
| US-001 - product_id-tagging | planifest-spec-agent → planifest-codegen-agent | Schema/migration-affecting requirement; spec-agent defines the contract, codegen-agent implements the additive schema field + DB column + migration proposal |
| US-002 - event-log-table | planifest-codegen-agent | Backend query extension (pagination/total_count/sort) + static UI table rendering |
| US-003 - event-filtering | planifest-codegen-agent | Backend filter extension + UI filter controls, URL-state persistence |
| US-004 - event-detail-view | planifest-codegen-agent | UI-only: row click → JSON detail render |
| ADR-010 relaxation | planifest-adr-agent | Architectural decision: removing mandatory scope-filter requirement, replacing with limit/offset-only bounding |
| Migration approval | planifest-codegen-agent (writes proposal) → human (approves) | Hard Limit: no direct schema modification without a written proposal and human sign-off |

## Repo Instructions
### archiving-policy.md
# Archiving Policy

**All pipeline runs archive to `plan/_archive/{feature-id}-{YYYY-MM-DD}/` when they finish — no exceptions for route.**

The framework's default behavior only archives Feature Pipeline runs (via the ship-agent's P7 step); Change Pipeline runs (the change-agent) have no archiving step of their own and by default leave `plan/current/` as a permanent top-level `plan/{feature-id}/` folder. This override closes that gap.

## Rule

When a Change Pipeline run (change-agent) finishes Phase 5 (Documentation), before considering the change complete:

1. Determine the archive path: `plan/_archive/{feature-id}-{YYYY-MM-DD}/` (date = today, matching the ship-agent's own naming convention for consistency).
2. `git mv plan/current/` (or wherever the working folder currently is) to that path — never a plain copy+delete; preserve git history via rename detection.
3. Search the repo for cross-references to the old path (`docs/*.md`, `src/*/docs/*.md`, `plan/changelog/*.md`) before moving, and update every found reference to the new path in the same commit.
4. Commit the move and reference updates together.

This applies retroactively too: if you discover an existing `plan/{feature-id}/` folder from a prior Change Pipeline run that was never archived, normalize it the same way (with human confirmation before moving history around on a shared branch).

## Why

Established 2026-07-23 after `0000008`, `0000008c`, `0000009`, `0000011`, and `0000012` all ended up as permanent top-level `plan/` folders (Change Pipeline route) while `0000010` (Feature Pipeline route) was the only one properly archived — an inconsistent, confusing `plan/` layout with no single place to look for "is this feature done and filed away." Human explicitly requested normalizing this and keeping it consistent going forward, not just as a one-time cleanup.

(Not directly applicable — this is a Feature Pipeline run, which already archives via the ship-agent's own P7 step. Included here per the standard P0 instruction-loading step.)

## Confirmation
Human confirmed this design before proceeding: yes // Date and Time confirmed: 01 Aug 2026 @ 16:47 BST
