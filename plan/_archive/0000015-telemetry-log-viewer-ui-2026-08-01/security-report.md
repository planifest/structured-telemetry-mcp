# Security Report - 0000015-telemetry-log-viewer-ui

## Threat Model (STRIDE)

| Threat | Category | Severity | Mitigation |
|---|---|---|---|
| SQL injection via new `event_log` filters (`phase`, `agent`, `product_id`, `from`, `to`) | Tampering | Low | All filter values are bound as named parameters (`$phase`, `$agent`, `$product_id`, `$from`, `$to`) via `conn.prepare(sql).bind(params)` in `src/query/event-log.ts` — never string-concatenated. `from`/`to` use a static `::TIMESTAMPTZ` cast applied to the bound placeholder, not to raw input. Mitigated. |
| SQL injection via `sort` → `ORDER BY` direction | Tampering | Low | `sortDirection` is derived via `query.sort === 'desc' ? 'DESC' : 'ASC'` — an allowlist mapping to one of two hardcoded literals, never a passthrough of the input value. Mitigated by construction. |
| SQL injection / malformed query via `limit`/`offset` | Tampering | Low | Both are coerced with `Number(...)` before interpolation (`LIMIT ${limit} OFFSET ${offset}`); a non-numeric input becomes `NaN`, which DuckDB rejects as invalid syntax (a 400 query error), not an injection vector. This is a pre-existing pattern shared with `bottlenecks.ts`'s `limit` handling, not newly introduced. A malformed/negative value produces a clean error, not arbitrary SQL execution. Accepted — matches existing codebase convention. |
| XSS via agent-supplied event data rendered in the log-viewer table (`session_id`, `phase`, `agent`, `event`, `timestamp`, `product_id`) | Tampering / Elevation | Low | Every dynamic value written into `row.innerHTML` in `src/ui/index-html.ts` passes through `escapeHtml()` first, including the `title=` tooltip attribute (quotes are escaped). Verified no unescaped interpolation path exists in `renderTable()`. Mitigated. |
| XSS via the row-detail JSON view or status/banner text | Tampering | Low | The detail view uses `pre.textContent = JSON.stringify(...)`, and the banner/status/page-label use `.textContent` assignment throughout — never `.innerHTML`. `textContent` never interprets its argument as markup regardless of content. Mitigated by construction. |
| Information disclosure — `event_log` no longer requires a scope filter (ADR-016), so the entire `events` table becomes trivially page-through-able with just `limit`/`offset` | Info Disclosure | Medium | The pre-existing trust boundary was already the OS/network layer, not the API: the server is 127.0.0.1-only with no auth (component.yml exception, unchanged), and `event_type` — one of the three previously-"required" scope fields — is a small, public, well-known 25-value enum, so any local caller could already dump the full table before this change by iterating those 25 values with a large `limit`. ADR-016 removes friction, not an access boundary that was actually enforcing anything. Still, this is now measurably one HTTP call instead of up to 25, which is worth being explicit about. No new mitigation added in this feature; unchanged from the project's existing accepted no-auth/local-only posture (component.yml `exceptions`, confirmed design NFR-002). **Recommend**: if this server is ever exposed beyond localhost, this finding becomes High and must be revisited before that happens. |
| Information disclosure — `product_id` embeds absolute filesystem paths (may include OS usernames, e.g. `/Users/martinmayer/...`) | Info Disclosure | Low | Already identified at design time (ADR-017, risk-register.md R-005). Same no-auth/local-only mitigation as above applies. Accepted, documented, unchanged by this review. |
| Denial of service via unbounded `event_log` result payload | Denial of Service | Low | `limit` is capped at 1000 server-side (`event-log.ts`, `MAX_LIMIT`), rejecting anything higher with a clear error before the query runs. The expanded `SELECT` (all columns vs. 8 previously) increases per-row payload size, measured empirically at p95 = 2.28ms for an unfiltered 50-row page against 5000 seeded rows (see Summary) — well within the confirmed NFR-001 target (p95 < 300ms). Mitigated. |
| New network-facing route `GET /ui` | Elevation / Info Disclosure | Low | Added to the same `server-http.ts` process, same `server.listen(PORT, '127.0.0.1', ...)` binding — unchanged from every other route. No new port, no new process, no CORS headers added (unneeded — the UI's `fetch('/query', ...)` calls are same-origin). Confirmed via `tests/unit/ui.test.ts` that the UI makes zero calls to any non-relative URL. No new exposure. |

## Dependency Audit

No new dependencies were added by this feature (schema/DB/query changes are pure code; the UI is plain HTML/CSS/vanilla JS with zero new packages — ADR-018). `package.json`/`package-lock.json` unchanged. No new CVE exposure introduced. Pre-existing dependency posture (documented in `component.yml`'s `quality.techDebt` and `docs/quirks.md`) is unaffected.

## Secrets Management

No secrets, credentials, or API keys are introduced or handled by this feature. `product_id` is not a secret — it is a local filesystem path, addressed above under Information Disclosure rather than Secrets Management.

## Authentication & Authorisation Review

No API surface requiring authentication was added. Consistent with the project's existing, explicitly-documented no-auth posture (`component.yml` exceptions: "Does not authenticate callers — bound to 127.0.0.1, no auth model required"; confirmed design NFR-002). The new `GET /ui` route and the extended `event_log` query family inherit this posture unchanged — no OpenAPI spec exists for this project (by established convention, `apiSpec: "none"`), so there is no contract mismatch to check.

## Input Validation Review

- `product_id` on the envelope: validated as an optional plain string by the JSON Schema (`schemas/telemetry-event.schema.json`) and the `EmitEventEnvelope` Zod gate (`server-factory.ts`) — no length limit, consistent with every other free-text envelope field (`initiative_id`, `question`, `description`, etc.). Not a new gap; pre-existing pattern.
- `event_log` query filters (`phase`, `agent`, `product_id`, `event_type`, `session_id`, `initiative_id`): unvalidated against any enum — an invalid value (e.g. a `phase` not in the real enum) simply matches zero rows rather than erroring. Correct, safe behavior for a filter — not an input validation gap.
- `from`/`to`: any string is accepted and passed to `::TIMESTAMPTZ`; an unparseable value produces a clean DuckDB error surfaced as a 400, not a crash or injection. Acceptable.
- `limit`/`offset`: see Denial of Service / Tampering rows above — capped and coerced safely.

## Network Policy

Unchanged. The daemon binds to `127.0.0.1` only (`server-http.ts`, not modified by this feature's route addition). No new ports, no new listeners, no change to CORS (none configured, none needed for same-origin use). This matches `component.yml`'s existing exceptions list.

## Infrastructure as Code Review

Not applicable — no IaC exists or was added for this feature (design stack: `iac: none`, `cloud: none`, local-only compute).

## Risk Register Cross-Reference

| Risk | Status |
|---|---|
| R-001 (ADR-010 scope-filter removal enforced in two places, risk of drift) | **Resolved, not just mitigated** — the duplicate check in `server-factory.ts`'s `dispatchQuery` was removed entirely rather than kept in sync; `event-log.ts` is now the single enforcement point for bounding. No drift risk remains. |
| R-002 (three tests assert the old scope-required error) | Resolved — all three updated to the new contract (P3/P4). |
| R-003 (expanded SELECT payload vs. p95 < 300ms NFR) | Resolved — empirically measured at p95 = 2.28ms (unfiltered, 50-row page, 5000 seeded rows), ~130x margin under target. This measurement was missed during P4 and is recorded here instead. |
| R-004 (migration approval blocking downstream work) | Resolved — approved and applied before req-002/003/004 were built. |
| R-005 (product_id path privacy) | Open/accepted, unchanged — see Information Disclosure above. |
| R-006 (permanent "unknown" for historical/unpopulated rows) | Accepted by design, not a defect. |

## Summary

**Overall risk rating: Low**

No Critical or High findings. One Medium finding (information disclosure via the relaxed scope requirement) is assessed as not a material change to actual exposure given the pre-existing, already-porous trust boundary (local-only, no-auth, small public enum) — but is flagged explicitly because it lowers the effort required to exfiltrate the full table from "guess one of 25 known strings" to "send one request."

Top actions before production (i.e., before this server is ever exposed beyond localhost — not required for the current local/dev posture):
1. If `structured-telemetry-mcp` is ever deployed anywhere reachable beyond `127.0.0.1`, add authentication before that happens — the Medium finding above becomes High the moment the trust boundary is no longer "only processes on this machine."
2. Consider bounding `product_id`/free-text filter length if this ever becomes a multi-tenant or internet-facing service (not needed today).
3. No action required for the current release — all other findings are Low and either pre-existing, mitigated, or accepted by explicit design decision.
