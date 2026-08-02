# Recommendations - telemetry-log-viewer-ui

**Skill:** [docs-agent](../skills/planifest-docs-agent/SKILL.md)
**Feature:** 0000015-telemetry-log-viewer-ui
**Version:** 0.11.0

> These are not blockers - they are opportunities for future work.

## Recommendations

| ID | Category | Priority | Component | Recommendation | Rationale | Effort |
|----|----------|----------|-----------|---------------|-----------|--------|
| REC-001 | observability | medium | structured-telemetry-mcp | Pick up `plan/backlog/00002-framework-product-id-emission` in a `planifest-framework` pipeline run | Until the framework's own hooks populate `product_id`, every newly-emitted event (not just historical ones) shows "unknown" in the new UI — the feature's main filtering benefit for multi-project use is unrealized until this lands | small |
| REC-002 | testing | low | structured-telemetry-mcp | If `server-http.ts` ever gets real HTTP-level test coverage (starting the actual `node:http` server in tests), extend it to cover `GET /ui`, `/health`, `/emit`, and `/query` together — today all four are tested only indirectly (via `server-factory.ts` handlers or, for `/ui`, its served content) | Would catch route-wiring regressions (wrong method, wrong path, wrong content-type) that content-level tests structurally cannot | medium |
| REC-003 | maintainability | low | structured-telemetry-mcp | If the Log Viewer UI's scope grows meaningfully beyond the four confirmed features (e.g. the deferred aggregation-dashboard views), revisit ADR-018's no-framework decision | Vanilla JS string concatenation for DOM updates is deliberately minimal for 4 views; a genuinely larger UI would benefit from the structure a lightweight framework provides | large |
| REC-004 | performance | low | structured-telemetry-mcp | Re-run the `event_log` p95 latency check (currently 2.28ms unfiltered at 5000 rows) against a realistic multi-year data volume before assuming A-002 holds indefinitely | The confirmed design accepted offset pagination on the assumption that local event volumes stay small; worth a periodic sanity check rather than a one-time measurement | small |

## Deferred Items

| Scope Item | Recommendation | When to Address |
|-----------|---------------|-----------------|
| Aggregation/dashboard views in the UI (bottleneck/failure/token-efficiency charts) | Build as a new wave on top of this UI's existing shell (filters/pagination/URL-state patterns are already established and reusable) | When there's a specific need beyond raw event browsing |
| Authentication / multi-user UI access | Add before this ever runs for more than one person or leaves localhost | If the no-auth/local-only posture ever needs to change |
| Editing or deleting events from the UI | Not recommended without a specific, deliberate need — telemetry is generally append-only by design across this whole system | Only if a concrete need arises |
| Live auto-refresh / tail mode | Simple to add (re-run `refresh()` on an interval) if manual refresh proves too slow in practice | If users report friction with manual refresh |
| `product_id` backfill on historical rows | Not recommended — no reliable signal exists (ADR-017); leave permanently as "unknown" | Never, unless new provenance data somehow becomes available |

## Tech Debt

No new tech debt was introduced by this feature. See `src/structured-telemetry-mcp/docs/tech-debt.md` for the component's existing (already-resolved) entries.
