---
title: "Scope - 0000019-loopback-daemon-hardening"
summary: "In scope, out of scope, and deferred - stated explicitly."
---
# Scope - 0000019-loopback-daemon-hardening

## In Scope

| # | Item | Requirement |
|---|---|---|
| 1 | `Host` allow-list on every route, checked before body reading | req-001 |
| 2 | `Origin` rejection when present and foreign; absent `Origin` passes (ADR-009) | req-002 |
| 3 | `Content-Type: application/json` required on `POST /emit` and `POST /query` | req-003 |
| 4 | Request-body byte cap on both `Content-Length` and the streaming `data` handler | req-004 |
| 5 | `try/catch` around the `req.on('end')` handler so a throw rejects rather than exits the process | req-004 |
| 6 | Socket/request timeout against slow-body connections | req-004 |
| 7 | One shared query-validation gate across the HTTP and MCP paths | req-005 |
| 8 | Per-mode integer/range validation for `limit` (event_log 1000, distinct_values 20 — clamp changes to reject, failure_sequence/drill_down 1000 new), `offset`, `loop_threshold`, and `limit`-as-days when `mode: trend` (no separate `trend.limit` field exists) | req-005 |
| 9 | Error redaction with correlation ids; `500` for engine errors, `400` for validated input | req-006 |
| 10 | Explicit `LIMIT` plus `truncated` and `total_count` on `failure_sequence` and `drill_down` | req-007 |
| 11 | Independent character budget on MCP tool-result text | req-008 |
| 12 | Injection-shaped input tests against `sortField` and `distinct_values.field` | req-009 |
| 13 | Playwright XSS-escaping tests across all rendered fields, including the `title` attribute | req-010 |
| 14 | `test-coverage.md` corrected; allow-list constants imported into `ui.test.ts` | req-011 |
| 15 | `.gitignore` pattern `*.local-only.*` and untracking of the two tracked matches | req-012 |
| 16 | ADR-032 superseding `component.yml`'s "no auth model required" position | P2 |

## Out of Scope

| Item | Why |
|---|---|
| Log viewer correctness defects (00015, 00016, 00017, 00018) | Deferred to 0.16.0 at P0 backlog pickup. **00016 is a live regression against 0000017** — auto-refresh destroys expanded rows on every poll — and was deferred with that explicitly called out to the human, not overlooked |
| Log viewer capability gaps (00004, 00006, 00021, 00022) | Improvement-severity; a separate release |
| Recovering the ~4,100 stranded WAL events (00023) | Data-recovery operation, different in kind; already excluded by 0000018 |
| Any `planifest-framework/` change (00007, 00025) | Framework Update Policy: framework changes are committed directly as tooling maintenance, never routed through a product pipeline run |
| Hook-side handling of a structured `400` from `/emit` | Lives in `planifest-framework/hooks/telemetry/`; filed as backlog 00028. Becomes reachable only once this feature ships, so worth picking up in the same window |
| Multi-user authentication or access control | The threat model is browser-mediated attack from the developer's own browser, not multiple humans. `component.yml`'s existing deferral was reasoned against multi-user access, which is a different question |
| Remote or network exposure | The daemon stays bound to `127.0.0.1` |
| Any schema or migration change | Framework Hard Limit 3; this feature needs none |
| Revisiting `uncaughtException -> process.exit(1)` as a general policy (00013 action 5) | req-004 stops the request path from reaching it. Changing the handler's policy is a separate decision affecting every other crash path |
| Graceful-shutdown request draining and its race with the WAL checkpoint | Surfaced by the cross-session Scope Lock agent as unspecified by any ADR. Excluded by human decision at P0: it is 0000018 shutdown-path surface, not request-boundary surface. `server.close()` at `src/server-http.ts:261` keeps its current semantics |
| CORS response headers | The daemon refuses cross-origin access rather than negotiating it. Adding `Access-Control-Allow-Origin` would defeat req-002 |

## Deferred

| Item | Blocked until |
|---|---|
| Local shared secret token (00012 action 4) | A threat emerges that req-001 to req-003 do not already close. Not adopted at P0: a token in `~/.planifest/` readable by the owning user gives no protection against a same-user process that can read `telemetry.db` directly, so it defends only against browser pages — which the checks close completely — while adding friction to the stdio proxy and forcing the daemon to inject the secret into a page with no secret store |
| Projection instead of the full `data` payload per row in `failure_sequence` / `drill_down` (00014 action 3) | Evidence that the req-007-capped payload is still too large in practice |

## Nothing Assumed Away

No requirement gap was worked around by assumption. One P0 assumption was **removed by verification** rather than carried: that legitimate callers already send `Content-Type: application/json` is now a checked fact (three framework hooks, the stdio proxy client, the log viewer), not a belief. The four assumptions that remain are recorded in `design.md` with their impact-if-wrong, and the material ones are tracked as risks R-001 and R-004 in `risk-register.md`.
