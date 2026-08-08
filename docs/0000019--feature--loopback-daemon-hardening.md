# Feature: 0000019 — Loopback Daemon Hardening

**Version:** 0.15.0
**Date:** 2026-08-08
**Route:** Feature Pipeline (standard-iterative)
**Branch:** feat/0000019-loopback-daemon-hardening

Hardens the loopback HTTP daemon on `127.0.0.1:3741` — the path both the Log Viewer and the stdio proxy use. Before this feature the daemon had no `Host`/`Origin`/`Content-Type` validation, no request-body cap, a weaker validation gate than the MCP path, and returned raw DuckDB errors containing SQL text and stored row values; one malformed request could terminate the process via `uncaughtException -> process.exit(1)`. This is a security/robustness hardening feature — no telemetry event type, schema, or route was added or removed.

Follow-up to 0000018, which recorded the request-boundary work as out of scope and named the backlog entries (00010–00014, 00020); this feature is that follow-up, and all six are now delivered.

---

## What Changed

### Caller provenance, no shared secret (ADR-032)

The daemon now checks where every request comes from, before routing and before the body is read:

- **`Host` allow-list** — accepts only `127.0.0.1:<port>` / `localhost:<port>`, compared against the *actually-bound* port (`server.address()`), closing DNS rebinding (req-001).
- **`Origin` rejection** — a foreign `Origin` is refused; a request with **no** `Origin` is accepted, because the stdio proxy (ADR-009) and the Planifest emission hooks are non-browser clients and send none (req-002).
- **`Content-Type: application/json` required on writes** (`POST /emit`, `POST /query`) — closes the CORS-simple no-preflight write path (`text/plain`, `application/x-www-form-urlencoded`, `multipart/form-data`) (req-003).

No credential (token/password/key) was added. ADR-032's Alternatives table records why: a token in `~/.planifest/` defends only against the browser pages the three checks already fully exclude, while giving nothing against a same-user process that can read `telemetry.db` off disk. ADR-032 narrows, rather than removes, `component.yml`'s earlier "no auth model required" position.

### Request-body cap, timeout, and crash safety (req-004)

Request bodies are capped at `PLANIFEST_MAX_BODY_BYTES` (default 4 MB) at two independent enforcement points — a `Content-Length` pre-check and a streaming byte counter (the load-bearing one against a chunked or forged-length request). A stalled connection is closed by `PLANIFEST_REQUEST_TIMEOUT_MS` (default 30 s). A try/catch around the `readBody` end-listener rejects the promise on a throw instead of reaching `uncaughtException`, so a single malformed request can no longer terminate the daemon.

### One shared query validation gate (req-005)

New `src/query/validate-query.ts`, reused by both the HTTP and MCP query paths, applies integer-and-range constraints with per-mode `limit` ceilings (`event_log` 1000, `distinct_values` 20, `failure_sequence`/`drill_down` 1000; `trend` treats `limit` as a day count, ceiling 365). **`distinct_values` changed from a silent clamp to a reject** over its ceiling. `offset`, previously undeclared and unvalidated on *both* paths, is now constrained too.

### Bounded result sets and MCP text budget (req-007, req-008)

`failure_sequence` and `drill_down` are bounded by a row cap and gained additive `json.truncated` / `json.total_count` fields (`total_count` computed by a count query, not by counting returned rows). Assembled `query_telemetry` MCP tool-result text is capped at `PLANIFEST_MCP_TEXT_BUDGET` (default 100000), truncated at section boundaries so the agent never receives a half-serialised JSON block.

### Error redaction (req-006)

Engine failures now return a generic `500` carrying a `correlationId` (mapping to a full stderr log line), replacing the previous `400` responses that interpolated raw DuckDB SQL text and stored row values. Applied across all three leak sites — `server-http.ts`'s `/emit` and `/query`, and the MCP result path in `server-factory.ts`. `400` is now reserved for validated client input.

### Genuine security tests (req-009, req-010, req-011, req-012)

Injection-shaped input tests against `sortField` and `distinct_values.field` on both paths (including `constructor`/`__proto__`/`prototype` prototype keys), and Playwright XSS-escaping coverage across every rendered field including the `title` attribute (asserted behaviourally via a dialog handler). req-009 and req-010 were **each verified with a real RED-before-GREEN weakening cycle**. `test-coverage.md`'s false coverage claim was corrected, and `*.local-only.*` was added to `.gitignore`.

---

## Files Changed

| File | Change |
|---|---|
| `src/server-http.ts` | Host/Origin/Content-Type checks, two-point body cap, request timeout, crash-safe `readBody`, error redaction with `correlationId` (req-001–004, 006) |
| `src/query/validate-query.ts` | **New** — shared per-mode numeric validation gate for HTTP + MCP (req-005) |
| `src/server-factory.ts` | Wires the shared gate into the MCP path; MCP tool-result text budget; MCP-path error redaction (req-005, 006, 008) |
| `src/query/failures.ts` | `failure_sequence` bounded + additive `truncated`/`total_count` (req-007) |
| `src/query/token-efficiency.ts` | `drill_down` bounded + additive `truncated`/`total_count` (req-007) |
| `tests/integration/server-http-boundary.test.ts` | **New** — boundary refusal coverage (403/415/413/500) |
| `tests/integration/bounded-result-sets.test.ts` | **New** — truncated/total_count assertions |
| `tests/integration/injection-identifiers.test.ts` | **New** — identifier-injection corpus incl. prototype keys (req-009) |
| `tests/unit/validate-query.test.ts` | **New** — shared-gate unit coverage |
| `tests/unit/server-factory-hardening.test.ts` | **New** — MCP-path hardening coverage |
| `tests/e2e/ui/xss-escaping.spec.ts` | **New** — XSS-escaping E2E across all rendered fields (req-010) |
| `tests/unit/column-allow-list.test.ts`, `tests/unit/server-factory.test.ts`, `tests/unit/ui.test.ts`, `tests/e2e/support/server-harness.ts` | Adjusted for the tightened gate and `ui.test.ts` now imports `SORTABLE_FIELDS`/`SUGGESTIBLE_FIELDS` rather than restating them (req-011) |
| `.gitignore` | `*.local-only.*` ignored (req-012) |
| `src/structured-telemetry-mcp/component.yml` | Version 0.14.0 → 0.15.0; contract, responsibilities, exceptions, scope, quirks updated; `contract.apiSpec` published to the living path (P6) |
| `src/structured-telemetry-mcp/docs/openapi-spec.yaml` | **New** (published at P6) — first formal OpenAPI 3.1 contract for the HTTP surface |
| `src/structured-telemetry-mcp/docs/test-coverage.md` | False coverage claim corrected (req-011) |

---

## Environment Variables (new)

| Variable | Default | Effect |
|---|---|---|
| `PLANIFEST_MAX_BODY_BYTES` | 4 MB | Request-body cap; over-cap → `413` |
| `PLANIFEST_REQUEST_TIMEOUT_MS` | 30 s | Stalled-request socket timeout |
| `PLANIFEST_MCP_TEXT_BUDGET` | 100000 | MCP tool-result text character budget |

---

## Decisions

- **ADR-032 — Caller Provenance Without a Shared Secret** (accepted). See `docs/decisions-index.md`.

---

## Validation

545 Vitest tests (262 unit + 145 integration + 137 regression + 1 performance) + 25 Playwright E2E (Chromium-only), typecheck + build clean. 0000019 added +54 Vitest and +3 E2E (XSS-escaping); req-009 and req-010 each verified with a real RED-before-GREEN weakening cycle.
