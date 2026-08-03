# Recommendations - Log Viewer Enhancements

**Skill:** [docs-agent](../skills/planifest-docs-agent/SKILL.md)
**Feature:** 0000017-log-viewer-enhancements
**Version:** 0.13.0

> These are not blockers - they are opportunities for future work.

## Recommendations

| ID | Category | Priority | Component | Recommendation | Rationale | Effort |
|----|----------|----------|-----------|---------------|-----------|--------|
| REC-001 | maintainability | medium | structured-telemetry-mcp | Add a lightweight regression test (or a build-time check) asserting `src/ui/index-html.ts`'s hand-mirrored `SORTABLE_FIELDS`/`SUGGESTIBLE_FIELDS` constants stay in sync with `src/query/column-allow-list.ts`'s exports | ADR-018's no-build-step constraint means the frontend copy is manually maintained (`docs/quirks.md`) — a drift wouldn't be a security bug (the backend re-validates independently) but would be a confusing UX bug (an option offered client-side that the backend then rejects) that a simple test could catch immediately | small |
| REC-002 | architecture | low | structured-telemetry-mcp | If a future feature (e.g. backlog #00004's aggregation views) revisits ADR-018 and introduces a build step, migrate `index-html.ts`'s manually-duplicated allow-list constants to a real shared import at that point | Removes REC-001's need entirely rather than just testing around it — but only worth doing once a build step exists for other reasons; not a reason to introduce one on its own | small (once a build step exists) |
| REC-003 | observability | low | structured-telemetry-mcp | If local event volumes grow enough that `distinct_values`' `SELECT DISTINCT` lookups become noticeably slow (risk-register A-002), consider an index on the suggestible columns, or a periodically-refreshed cached values list, before reaching for a more invasive fix | No evidence of a problem today (measured well within NFR-001 at P4) — this is a documented assumption to revisit on evidence, not a pre-emptive optimization | small–medium |
| REC-004 | testing | low | structured-telemetry-mcp | Add an E2E test for the `pollForUpdates()` failure-path UI (a poll that fails mid-session shows the "Auto-refresh failed — retrying…" message and recovers on the next successful poll) | The success-path pickup and the unit-level failure-path assertions are both covered; a live-browser failure-path E2E (e.g. by temporarily stopping the server mid-test) would close the last gap in this feature's auto-refresh coverage, at the cost of a flakier/slower test | medium |

## Deferred Items

| Scope Item | Recommendation | When to Address |
|-----------|---------------|-----------------|
| Aggregation/dashboard views (bottleneck/failure/token-efficiency charts) | Design the aggregation query layer and explicitly revisit ADR-018 before codegen | Wave 2 — tracked as `plan/backlog/00004-aggregation-dashboard-views` |
| Quick date-range filter presets (today/yesterday/last N/60 days) | Add preset buttons that set the existing `from`/`to` fields directly | Tracked as `plan/backlog/00006-quick-date-range-filters` |
| WebSocket/SSE push-based live updates | Revisit ADR-027 if 5-second polling proves insufficient in practice | On evidence — noticeable poll latency/load, not pre-emptively (A-001) |
| `planifest-framework`'s own emitters populating `product_id` | Cross-product dependency, implementation-ready | Tracked as `plan/backlog/00002-framework-product-id-emission`, now with a full handoff report (`handoff-report.md`) ready for that product's own P0 |

## Tech Debt

No new tech debt beyond what's already recorded in `docs/quirks.md` and `component.yml`'s `quality.techDebt`/`quality.quirks` (the hand-mirrored frontend allow-list constants, addressed by REC-001/REC-002 above, is tracked as a quirk rather than debt — it's a deliberate, documented trade-off of ADR-018, not an oversight).
