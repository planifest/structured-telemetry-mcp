# Changelog — 0000015-telemetry-log-viewer-ui — 01 Aug 2026

**Feature:** Telemetry Log Viewer UI
**Pipeline run:** Feature Pipeline (P0–P9, continuous run mode). All phases completed; none skipped.
**PR:** https://github.com/planifest/structured-telemetry-mcp/pull/10

## What Was Built

A browser-based, read-only log viewer for the telemetry events already stored by `structured-telemetry-mcp` — filterable and paginated, for a single local developer. Previously the only way to inspect telemetry was `curl`/MCP tool calls against `query_telemetry`.

Four requirements, built in dependency order:

1. **product_id Tagging** — new optional `product_id` field on the event envelope (git repo root path, fallback `cwd`) and a matching nullable DB column, so events from the multiple projects sharing one telemetry backend can be told apart. No backfill on historical rows — other projects besides this repo have also used the shared `$HOME/.planifest/telemetry.db`, so there's no reliable signal to reconstruct provenance for pre-existing rows.
2. **Event Log Table** — `event_log` queries gained offset-based pagination, a `total_count` field, and a `sort` param (default `asc`, unchanged for back-compat). The previously mandatory "must supply a scope filter" requirement was removed (ADR-016, amends ADR-010): every request is now bounded solely by `limit`/`offset` (capped at 1000).
3. **Event Filtering** — added `phase`, `agent`, `product_id`, and a full-precision `from`/`to` timestamp range, alongside the existing `session_id`/`initiative_id`/`event_type` filters. All combine with AND semantics.
4. **Event Detail View** — clicking a table row expands the complete envelope + `data` payload as pretty-printed JSON, using data already fetched with the page (no extra request).

The UI itself is plain HTML/CSS/vanilla JS with zero new dependencies and no build step (ADR-018) — embedded as a TypeScript string (same reason the JSON schema is inline-imported: survives esbuild bundling) and served at `GET /ui` from the existing `server-http.ts` process. No new component, port, or process.

Populating `product_id` in `planifest-framework`'s own emission hooks is a separate product's responsibility (ADR-019) — filed as `plan/backlog/00002-framework-product-id-emission`, not built here.

## Artifacts Produced

- `plan/current/{feature-brief,design,execution-plan,scope,risk-register,domain-glossary,operational-model,slo-definitions,cost-model,recommendations,build-log,security-report}.md`
- `plan/current/requirements/req-{001..004}-*.md`
- `plan/current/adr/ADR-{016..019}-*.md`
- `plan/backlog/00002-framework-product-id-emission/entry.md`
- New: `src/ui/index-html.ts`, `tests/unit/ui.test.ts`
- Updated: `schemas/telemetry-event.schema.json`, `src/types/events.ts`, `src/db/{schema,index,duckdb-event-repository}.ts`, `src/query/event-log.ts`, `src/server-factory.ts`, `src/server-http.ts`, `tests/{unit,integration,regression}/*` (product_id coverage + 3 tests updated to the new event_log contract)
- Migration: `src/structured-telemetry-mcp/docs/migrations/applied-add-product-id.md` (approved and applied)
- Docs: `README.md`, `docs/{about,api-index,architecture-overview,component-registry,decisions-index,dependency-graph,usage-guide}.md`, `src/structured-telemetry-mcp/docs/{purpose,interface-contract,scope,risk,quirks,test-coverage,dependencies,data-contract}.md`, `component.yml`

## Decisions

- **ADR-016** — `event_log`'s mandatory scope-filter requirement removed; bounded solely by `limit`/`offset` instead. Amends ADR-010.
- **ADR-017** — `product_id` is additive (optional field + nullable column), never backfilled on existing rows.
- **ADR-018** — Log Viewer UI is plain vanilla JS/HTML/CSS, no build step, embedded in-process — no new component or dependency.
- **ADR-019** — `product_id` emission in `planifest-framework`'s own hooks is that product's responsibility, not built in this feature.

## Security

No Critical or High findings. One Medium finding, accepted: removing `event_log`'s mandatory scope filter lowers the effort to page through the whole table, though the actual trust boundary (127.0.0.1-only, no auth) was already the real protection — `event_type` was always a small public enum, so this doesn't break a boundary that was actually enforcing anything. Flagged to revisit if this server is ever exposed beyond localhost. Full report: `plan/_archive/0000015-telemetry-log-viewer-ui-2026-08-01/security-report.md`.

## Skipped Phases

None.

## Validation

362/362 Vitest tests passing (up from 332 baseline, +30 this feature), `tsc --noEmit` clean, `npm run build` succeeds (all 3 bundles). Additionally verified the actual esbuild-bundled `server-http.bundle.mjs` (not just dev mode) serves `GET /ui` correctly. `event_log`'s p95 < 300ms NFR empirically measured at p95 = 2.28ms (unfiltered, 5000 seeded rows) — ~130x margin. Full manual browser verification of the UI (empty state, filtering, pagination, detail view, URL-state round-trip, backend-unreachable banner) documented in `build-log.md` P3.
