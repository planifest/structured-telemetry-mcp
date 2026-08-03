# Design - 0000017-log-viewer-enhancements

## Feature
- Problem: The 0000015 log viewer only supports static, one-shot browsing — a developer must manually re-run a query to see new events, retype exact filter values from memory, and use a separate dropdown to change sort order instead of the table itself.
- Adoption mode: standard-iterative
- Feature ID: 0000017-log-viewer-enhancements
- Version: 0.13.0 (minor bump from 0.12.0, Feature Pipeline default — confirmed in P0 build log)
- Discovery: see `plan/current/discovery.md` (raw P0 findings — do not embed them here; this document records confirmed decisions only)

## Product Layer
- User stories:
  - US-001: As a developer, I toggle live auto-refresh on the event log, so that new events appear without me manually re-running the query. Toggle state persists via URL query params (defaults off when absent), consistent with filter/sort persistence. (Auto-Refresh / Tail Mode)
  - US-002: As a developer, I get suggested values as I type into a filter field, so that I can filter accurately without memorizing exact session/event-type/agent strings. (Filter Combobox)
  - US-003: As a developer, I click a column header to sort by that field, so that I don't have to use the separate sort-field dropdown for a task the table itself should support. Column header, sort-field dropdown, and URL query params stay three-way synced. (Sortable Headers)
- Acceptance criteria confirmed: 8 (see `feature-brief.md`)
- Constraints: no build step/bundler/new frontend dependency (ADR-018 still applies); no architecture change — extends the existing `server-http.ts` process and `/ui` static page only; auto-refresh must not silently discard a user's in-progress filter edit or scroll position; all persisted URL query params (filters, sort field/direction, auto-refresh toggle) must degrade gracefully to their defaults when absent or malformed — never throw or block page load
- Integrations: none external — UI talks only to the existing local backend

## Architecture Layer
- Latency target: p95 < 300ms per poll/query (inherited from 0000015)
- Availability target: deferred — best-effort, no SLO (local single-developer tool)
- Scalability target: deferred — single local developer's data volume; revisit polling strategy if missed
- Security: no auth; server remains bound to 127.0.0.1 only (unchanged existing posture)
- Data privacy: no regulated data; UI makes zero external network calls (unchanged from 0000015)
- Observability: standard defaults (existing telemetry-on-telemetry emission via this session's own P0-P9 run)
- Cost boundary: not constrained (local, no cloud spend)

## Engineering Layer
- Stack: TypeScript (backend, existing) + vanilla JS/HTML/CSS (frontend, existing, no build step) / Node.js runtime / no framework (raw `node:http`) / DuckDB (existing) / no ORM / Vitest / no IaC / no cloud / local persistent process / existing CI / Build target: local
- Components: structured-telemetry-mcp (existing, extended) — no new component created
- Data ownership: `events` table (existing) owned by structured-telemetry-mcp; read by MCP `query_telemetry`, REST `/query`, and the UI (same process) — unchanged from 0000015
- Deployment: unchanged — existing local service, UI served as static assets from the same `server-http.ts` process on 127.0.0.1:3741
- API versioning: not applicable (internal REST endpoint, additive query params / new lightweight suggestion endpoint only)

## Scope
- In: live auto-refresh/tail mode (polling, preserves filters/sort/scroll, URL-persisted); filter combobox with distinct-value suggestions per filterable field (session_id, initiative_id, event_type, phase, agent, product_id); sortable table column headers three-way synced with the sort-field dropdown and URL query params; URL-state persistence extended to cover sort field/direction and auto-refresh toggle (0000015 already covers filters)
- Out: aggregation/dashboard views (bottleneck/failure-rate/token-efficiency charts) — deferred, backlog #00004; any change to ADR-018 (static vanilla-JS, no framework); backfilling `product_id` on historical rows or framework-side `product_id` emission — backlog #00002
- Deferred: aggregation/dashboard views — blocked until a future pipeline run revisits ADR-018 and this feature's Wave 1 ships (backlog #00004)

## Assumptions
- Polling (not WebSocket/SSE push) is sufficient for "live" auto-refresh at local single-developer data volumes - impact if wrong: revisit push-based approach if poll latency/load becomes noticeable
- Distinct filter-value suggestions can be served from the existing `events` table with a lightweight query (e.g. `SELECT DISTINCT`) without a new index - impact if wrong: may need an index or a cached/precomputed values list if suggestion queries are slow at scale

## Risks
- `product_id` filter suggestions will show "unknown" for historical rows until backlog #00002 (framework-side emission) lands — likelihood: certain, impact: low (explicitly accepted, documented, not a defect)
- Runtime poll-failure behavior during an active auto-refresh session (transient server/query failure) extends the same "degrade gracefully, never block" principle applied to malformed URL params, by inference rather than prior explicit confirmation — likelihood: low, impact: low (accepted via Scope Lock error-path draft; behavior: keep last successful results, show non-blocking failure indicator, keep retrying)

## Dependencies
- Upstream: none new
- Downstream: backlog #00002 (framework `product_id` emission) — does not block this feature; backlog #00004 (aggregation/dashboard views) depends on this feature's Wave 1 shipping plus a future ADR-018 revisit; backlog #00005 (Scope Lock default-drafting UX) and #00006 (quick date-range filters) — both independent, non-blocking

## Active Skills
None (no capability skills installed for this run — plain vanilla JS/HTML frontend needs no framework-specific skill, same as 0000015)

## Skill Map
| Requirement | Best-fit Skill | Rationale |
|-------------|----------------|-----------|
| US-001 - auto-refresh-tail-mode | planifest-codegen-agent | Backend polling-friendly query path (unchanged contract) + frontend interval-poll/merge logic and URL-param persistence |
| US-002 - filter-combobox-suggestions | planifest-codegen-agent | New lightweight backend suggestion endpoint (distinct values per field) + frontend combobox UI |
| US-003 - sortable-headers-three-way-sync | planifest-codegen-agent | UI-only: header click handlers, dropdown/header/URL state sync logic |

## Repo Instructions
### framework-update-policy.md
# Framework Update Policy

**Uncommitted changes under `planifest-framework/` are a dependency update, not a feature — commit them directly, do not route them through the P0–P9 pipeline.**

`planifest-framework/` is vendored build tooling (the Planifest framework itself), not part of this repo's shipped product (`structured-telemetry-mcp`). It has its own independent version and feature-numbering sequence, separate from this product's. Treat a change confined to `planifest-framework/` the same way you'd treat bumping a `package.json` dependency — not as application code requiring requirements, ADRs, codegen, security review, etc.

## Rule

When `git status` shows uncommitted changes under `planifest-framework/` (and optionally its companion CI file `.github/workflows/planifest.yml`) that are unrelated to the active feature's own diff:

1. Do not fold them into the active feature's pipeline artifacts (design.md, requirements, ADRs, build-log) — they are a separate concern.
2. Stage only the framework-related paths (`planifest-framework/`, `.github/workflows/planifest.yml`) — never mix them into the same commit as product code changes (`src/`, `schemas/`, `tests/`, `docs/`, `plan/`).
3. Commit directly with a plain, descriptive message — `Planifest framework update` (or similarly plain; no need to describe every internal change). No orchestrator phases, no `plan/current/` artifacts, no build-log entry required for this commit.
4. Push it on whatever branch is currently active — it does not need its own branch or PR. It is fine for a framework update to ride along inside a product feature's branch/PR.
5. If the human asks to actually *develop* a new framework feature (not just commit an already-made update), that is different — it goes through the framework's own pipeline as its own product, on its own numbering sequence.

## Why

Established 2026-08-01 after a session accumulated ~180 files of in-progress `planifest-framework` changes (a framework-internal feature, `0000021-framework-context-bloat-audit`) alongside unrelated product work. The orchestrator initially over-treated this as requiring its own product/feature lifecycle before committing. Human clarified: this is routine tooling maintenance, equivalent in weight to a dependency version bump — commit it plainly and move on, every time a new framework version needs to land.

### git-up-to-date-shorthand.md
# Shorthand: GUTD

**When the human sends "GUTD", treat it as shorthand for "git up to date": check out `main`, pull the latest, and check for any untracked files.**

## Rule

On receiving the literal token `GUTD` (case-insensitive):

1. `git status` first — per standard safety practice, stash or flag anything uncommitted before switching branches.
2. `git checkout main`.
3. Pull the latest from `origin/main`. If local `main` has diverged (local-only commits not on `origin/main`), do not silently force-reconcile — investigate what those commits are first, same as any other unexpected local state, and prefer a reversible step (e.g. a backup branch) over discarding them.
4. Report any untracked files in the working tree (`git status --porcelain` `??` entries) — list them for the human rather than silently ignoring or cleaning them.

## Why

Established 2026-08-02 as a shorthand for a routine sync check the human runs often. Folds in the untracked-files check by default, since a prior "checkout main and pull latest" request surfaced local `main` commits that had diverged from `origin/main` (a stray, unfinished P0 pipeline run started directly on `main`) — worth surfacing untracked/stray state every time, not just when asked.

## Confirmation
Human confirmed this design before proceeding: yes // Date and Time confirmed: 03 Aug 2026 @ 12:24 AM BST
