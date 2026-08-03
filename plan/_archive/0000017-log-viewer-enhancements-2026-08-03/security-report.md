# Security Report - 0000017-log-viewer-enhancements

## Threat Model (STRIDE)

| Threat | Category | Severity | Mitigation |
|---|---|---|---|
| SQL injection via `sortField` → `ORDER BY {column}` (new, `event_log`) | Tampering | Low | `sortField` is validated against the exported `SORTABLE_FIELDS` allow-list (`src/query/column-allow-list.ts`) before any SQL is built (`src/query/event-log.ts`); an unrecognized value throws before the query runs. Only the allow-list-resolved column name (`ALLOWED_EVENT_COLUMNS[sortField]`) is ever interpolated — the raw client string is never used as the identifier. Verified: `tests/integration/query-telemetry.test.ts` (req-003 describe block) asserts an unrecognized `sortField` rejects before execution. Mitigated by construction. |
| SQL injection via `distinct_values`'s `field` → `SELECT DISTINCT {column}` (new endpoint) | Tampering | Low | Same allow-list pattern (`SUGGESTIBLE_FIELDS`), enforced in `src/query/distinct-values.ts` before any SQL is built. Verified: `tests/integration/distinct-values.test.ts` asserts both an unrecognized field (`not_a_real_field`) and a sortable-but-not-suggestible field (`timestamp`) are rejected before execution. Mitigated by construction. |
| SQL injection via `distinct_values`'s `q` (prefix-match) param | Tampering | Low | `q` is always bound as a SQL parameter (`$q`, via `conn.prepare(sql).bind(params)`) — the `%` suffix is appended in application code before binding, never string-concatenated into SQL text (`src/query/distinct-values.ts`). Same pattern as the existing `buildWhereClause` value-binding in `event-log.ts`. Mitigated by construction. |
| Two independent allow-lists drifting out of sync (a column renamed/removed in one but not the other, silently reopening the injection surface) | Tampering | Low | Closed at the architecture level, not just per-instance: ADR-024 mandates one shared `src/query/column-allow-list.ts` module (`ALLOWED_EVENT_COLUMNS`, `SORTABLE_FIELDS`, `SUGGESTIBLE_FIELDS`) that both `event-log.ts` and `distinct-values.ts` import — verified in the actual implementation, neither file defines its own literal column list. Residual risk: `src/ui/index-html.ts` hand-mirrors these constants client-side (no import mechanism in the embedded template literal, ADR-018) — a future backend allow-list change requires a manual, easy-to-forget sync into the frontend copy. This is a maintainability/correctness risk (a stale frontend list would offer a sort/suggest option the backend then rejects), not a security bypass — the backend allow-list is still authoritative and re-validates every request regardless of what the frontend sends. Documented in `docs/quirks.md`. |
| Denial of service via `distinct_values` result size | Denial of Service | Low | Hard-capped at 20 results (`MAX_LIMIT = 20` in `distinct-values.ts`), computed in code via `Math.min(Math.max(1, ...), 20)` before interpolation — a client cannot request more. `q` is truncated to 200 chars before binding. Mitigated. |
| Denial of service / abuse via 5-second auto-refresh polling | Denial of Service | Low | No new endpoint — polling reuses the existing, already-bounded `event_log` query (`limit`/`offset`/`MAX_LIMIT = 1000`, unchanged from 0000015/ADR-016). A single browser tab issuing one request per 5 seconds is negligible load for a local single-developer DuckDB process; no server-side awareness that a request is a "poll" exists to abuse. Mitigated by the pre-existing bounding, not new logic. |
| XSS via suggestion values rendered into `<datalist><option>` elements | Tampering / Elevation | Low | `fetchSuggestions()` (`src/ui/index-html.ts`) creates `<option>` elements via `document.createElement('option')` and sets `.value` as a DOM property, never `.innerHTML` or string concatenation — the browser's own attribute-setting semantics prevent markup interpretation regardless of the suggested value's content (e.g. a `session_id` containing `<script>`). Consistent with the existing `escapeHtml()`/`.textContent` discipline established in 0000015 for the rest of the page. Mitigated by construction. |
| Information disclosure via `distinct_values` enabling faster enumeration of distinct field values (e.g. discovering all `session_id`s or `product_id`s that exist, without already knowing one) | Info Disclosure | Medium | Same pre-existing trust boundary as 0000015's ADR-016 finding: the server is 127.0.0.1-only with no auth (`component.yml` exceptions, unchanged), and `event_log` with no scope filter already lets any local caller page through the entire table (accepted Medium finding in the 0000015 security report). `distinct_values` doesn't cross a boundary that wasn't already effectively open — it makes discovering *which* values exist marginally more convenient (one call per field vs. inferring values from a full-table page-through), but does not expose any data `event_log` didn't already expose. No new mitigation added; same accepted posture. **Recommend** (carried forward from 0000015, still applies, now with one more reason to act on it before it's needed): if this server is ever exposed beyond localhost, both this and the 0000015 finding become High and must be revisited before that happens. |
| Malformed/adversarial URL query params (`sortField`, `autoRefresh`, or any filter) crafted to break page load | Tampering / DoS | Low | Every new persisted param degrades gracefully: `sortField` not in the allow-list → silently falls back to `'timestamp'` (`readStateFromUrl`, never throws); `autoRefresh` any value other than exactly `'1'` → `false`. Verified in `tests/unit/ui.test.ts`. Consistent with the malformed-input handling already established for `page`/`pageSize`/`sort` in 0000015. Mitigated. |
| New network-facing behavior: none | Elevation / Info Disclosure | N/A | No new HTTP route added (`distinct_values` is a `mode` on the existing `POST /query`, per ADR-026 — same endpoint, same `dispatchQuery` try/catch, same 127.0.0.1 binding). Auto-refresh and suggestions are pure client-side polling/fetching against the existing `/query` endpoint. Confirmed via `tests/unit/ui.test.ts`'s existing zero-external-fetch assertion (unchanged, still passes) and manual review of `server-http.ts` (untouched by this feature). No new exposure. |

## Dependency Audit

No new dependencies were added by this feature — `package.json`/`package-lock.json` are unchanged (confirmed via `git diff` at P4). All new backend code (`column-allow-list.ts`, `distinct-values.ts`, `event-log.ts` extension) uses only the existing `@duckdb/node-api` client already in use. No new CVE exposure introduced.

## Secrets Management

No secrets, credentials, or API keys are introduced or handled by this feature. No change to this project's secrets posture.

## Authentication & Authorisation Review

No API surface requiring authentication was added. `distinct_values` inherits the exact same no-auth posture as every other query family (unchanged `component.yml` exception; no OpenAPI spec exists for this project by established convention, `apiSpec: "none"`, so there is no contract mismatch to check).

## Input Validation Review

- `sortField` (`event_log`): validated against `SORTABLE_FIELDS`, rejected with a clear error before SQL executes if not a member. Not a new gap — closes what would otherwise have been one.
- `field` (`distinct_values`): validated against `SUGGESTIBLE_FIELDS`, same pattern.
- `q` (`distinct_values`): no character-class restriction, but closed structurally — always a bound SQL parameter (never concatenated) and always assigned via a safe DOM property on the frontend (never `innerHTML`) — so neither the SQL nor the XSS injection surface depends on input filtering. Truncated to 200 chars server-side as a size guard, not a security boundary.
- `autoRefresh` URL param: strict equality check (`=== '1'`) — any other value, including attempts like `autoRefresh=true` or `autoRefresh=1; DROP TABLE events`, resolves to `false` with no further processing (it's never used in any query or SQL path at all — purely a client-side UI toggle).

## Network Policy

Unchanged. No new ports, listeners, or routes. `server-http.ts` (the file that owns the 127.0.0.1 binding) was not modified by this feature — every new capability rides through the existing `POST /query` endpoint.

## Infrastructure as Code Review

Not applicable — no IaC exists or was added (design stack: `iac: none`, `cloud: none`, local-only compute, unchanged from prior features).

## Risk Register Cross-Reference

| Risk | Status |
|---|---|
| R-001 (SQL-injection-via-identifier risk for `sortField`/`field`) | **Resolved** — ADR-024's shared allow-list is implemented and enforced in both `event-log.ts` and `distinct-values.ts`; verified by dedicated rejection tests in both. |
| R-002 (req-001/002/003 all touch the same shared `index-html.ts` state functions — coordination hazard) | **Resolved** — implemented as one integrated pass (not parallel edits), per the codegen build log. No evidence of clobbered/duplicated state logic found on review. |
| R-003 (`product_id` shows "unknown" until backlog #00002) | Accepted by design, unchanged — not a defect. |
| R-004 (poll-failure degrade-gracefully behavior, inferred not pre-confirmed) | Resolved — implemented exactly as accepted in the Scope Lock draft (last-successful-results retained, non-blocking indicator, keeps retrying); covered by a real E2E test seeding a live event and confirming pickup. |
| A-001 (polling sufficiency assumption) | Open, as expected — not a security risk; operational assumption tracked for future revisit if poll load ever becomes noticeable. |
| A-002 (distinct-values query performance at scale without a new index) | Open, as expected — not a security risk; same operational-assumption category as A-001. |

## Summary

**Overall risk rating: Low**

No Critical or High findings. One Medium finding (marginal improvement in ease-of-enumeration via `distinct_values`, layered on top of 0000015's already-accepted Medium finding for the same underlying no-auth/local-only trust boundary) — assessed as not a material new exposure, since it doesn't expose anything `event_log`'s existing unscoped access didn't already expose, but flagged explicitly because it's one more reason the "before this server is ever exposed beyond localhost" action item matters.

Top actions before production (i.e., before this server is ever exposed beyond localhost — not required for the current local/dev posture):
1. If `structured-telemetry-mcp` is ever deployed anywhere reachable beyond `127.0.0.1`, add authentication before that happens — both this feature's and 0000015's Medium findings become High the moment the trust boundary is no longer "only processes on this machine."
2. Keep the frontend's hand-mirrored `SORTABLE_FIELDS`/`SUGGESTIBLE_FIELDS` copies in `index-html.ts` in sync with `src/query/column-allow-list.ts` if either changes in a future feature — a stale frontend copy is a UX bug (offers an option the backend then rejects), not a security bypass, but worth a lint/test guard if this pattern grows (tracked in `docs/quirks.md`).
3. No action required for the current release — all other findings are Low and either mitigated by construction or accepted by explicit design decision, matching the risk register.
