---
title: "Feature Brief - loopback-daemon-hardening"
summary: "The business case, scope, and product requirements for the feature."
status: "draft"
version: "0.15.0"
---
# Feature Brief - loopback-daemon-hardening

**Feature ID:** 0000019-loopback-daemon-hardening

> Drafted by the orchestrator at P0 from six backlog entries pulled in at pickup
> (00010, 00011, 00012, 00013, 00014, 00020) plus one human-raised hygiene item.
> Confirmed by the human before the pipeline proceeds.

## Business Goal

The loopback HTTP daemon on `127.0.0.1:3741` is the path the log viewer and the stdio
proxy both use, and it is unguarded: no `Origin`, `Host`, or `Content-Type` validation,
no request-body cap, no shared validation gate with the MCP path, and raw DuckDB errors
returned to callers. Four high-severity findings from the post-0.13.0 review are live in
`src/server-http.ts` today — one of them (00013) lets a single malformed request terminate
the daemon via `process.exit(1)`, and another (00011) returns stored row values in error
bodies. Close the browser-mediated attack surface and make the request boundary
fail-safe, so the telemetry store that Planifest pipeline decisions are based on cannot be
forged, read cross-origin, or killed by one request.

Second goal, equal weight: `test-coverage.md` documents two security guarantees the suite
does not actually exercise (00020). Hardening the daemon while leaving that gap would
repeat the exact failure this release exists to correct — asserting a security property
without a test that can fail.

## Features

| Feature | User Stories | Priority | Wave |
|---------|-------------|----------|------|
| F1 - Request boundary validation and safety | As an operator, I want malformed or oversized requests rejected with a structured error, so that a single bad request cannot terminate the daemon. / As a developer, I want the HTTP path to reuse the MCP path's `QueryShape` gate, so that the log viewer's path is no less strict than the MCP one. / As a security reviewer, I want error responses to carry a correlation id instead of engine text, so that no SQL fragment or stored value reaches a caller. | must-have | 1 |
| F2 - Browser-mediated attack surface | As a developer, I want cross-origin requests refused, so that a page I visit cannot forge telemetry into my store. / As a developer, I want `Host` validated, so that a rebound DNS name cannot read my telemetry. / As a developer, I want `Content-Type: application/json` required on writes, so that the CORS-simple no-preflight loophole is closed. | must-have | 1 |
| F3 - Bounded result sets | As an operator, I want `failure_sequence` and `drill_down` to cap their result sets and report truncation, so that one query cannot exhaust daemon memory. / As an agent consumer, I want the MCP tool-result text capped independently of the HTTP response, so that a large result cannot flood a context window. | must-have | 1 |
| F4 - Security tests that can fail | As a security reviewer, I want injection-shaped input actually exercised against `sortField` and `distinct_values.field`, so that the allow-list claim is backed by a test. / As a security reviewer, I want XSS escaping verified in the rendered UI, so that the escaping claim is backed by a test. / As a maintainer, I want `test-coverage.md` to match what the suite exercises, so that the document is not a false assurance. | must-have | 1 |
| F5 - Local-only file hygiene | As a maintainer, I want files matching `*.local-only.*` ignored by git and untracked, so that local helper scripts cannot be committed by an `add -A`. | should-have | 1 |

Five features, twelve user stories, one wave. No feature exceeds three stories.

## Waves

| Wave | Features Included | Ships When |
|------|-------------------|------------|
| 1 | F1, F2, F3, F4, F5 | All acceptance criteria met, P5 security review clean |

Single wave. F1-F3 all touch `src/server-http.ts` and must be implemented as one
integrated pass rather than parallel edits to the same file (see Risks R-002).

## Target Architecture

### Components

| Component | Type | New or Existing | Responsibility |
|-----------|------|-----------------|---------------|
| structured-telemetry-mcp | microservice | existing | Telemetry ingestion, query, loopback HTTP daemon, static log viewer |

No new components. No new infrastructure.

### Data Ownership

| Data Store | Owner Component | Shared With |
|------------|----------------|-------------|
| `~/.planifest/telemetry.db` (`events`) | structured-telemetry-mcp | none (read-only via `/query` and `/ui`) |

No schema change. This feature adds no column, table, or migration.

### Integration Points

| From | To | Method | Contract |
|------|-----|--------|----------|
| Log viewer (`GET /ui`) | daemon | HTTP, same-origin | Must keep working under the new Origin/Host rules — it is same-origin so unaffected |
| stdio proxy (ADR-009) | daemon | HTTP, non-browser | Sends no `Origin` header; must not be refused by the new checks |
| Planifest hooks | daemon | HTTP `POST /emit` | Non-browser clients; must not be refused |

## Stack

Existing stack, unchanged — no new stack decision required.

| Concern | Decision |
|---------|----------|
| Language | TypeScript |
| Runtime | Node |
| Framework | none (node:http) |
| Frontend | vanilla-js, no build step (ADR-018) |
| Database | DuckDB |
| ORM | none |
| Testing | Vitest + @playwright/test (Chromium-only) |
| IaC | none |
| Cloud | none |
| Compute | local-daemon |
| CI | GitHub Actions |
| Build target | local |

## Scope Boundaries

### In Scope

- `Host` allow-list validation on all daemon routes (`127.0.0.1:<PORT>`, `localhost:<PORT>`)
- `Origin` rejection when present and not the daemon's own origin
- `Content-Type: application/json` required on `POST /emit` and `POST /query`
- Request-body byte cap enforced on both `Content-Length` and the streaming `data` handler
- `try/catch` around the `req.on('end')` body handler so a throw rejects the promise instead of reaching `uncaughtException`
- Socket/request timeout against slow-body connections
- Shared validation gate: the HTTP path reuses `QueryShape` rather than maintaining a second, weaker level of rigour
- Integer/range/NaN validation for `limit`, `offset`, `loop_threshold`, `trend.limit`
- Generic client error bodies with a correlation id; full error with stack to stderr; `500` for engine errors, `400` reserved for validated client input
- Explicit `LIMIT` plus `truncated` and `total_count` on `failure_sequence` and `drill_down`
- Independent cap on what the MCP path serialises into tool-result text
- Genuine injection tests (quotes, `;`, `--`, `/* */`, `UNION SELECT`, `constructor`, `__proto__`) against `sortField` and `distinct_values.field`, asserting structured rejection and an unchanged events table
- Playwright XSS-escaping tests covering rendered fields including the `title` attribute
- `SORTABLE_FIELDS` / `SUGGESTIBLE_FIELDS` imported into `ui.test.ts` rather than restated
- `test-coverage.md` corrected to match what the suite exercises
- `.gitignore` pattern `*.local-only.*`; `git rm --cached` the two currently-tracked matches
- ADR superseding `component.yml`'s "no auth model required" position (`breakingChangePolicy: requires-adr`)

### Out of Scope

- Log viewer correctness defects (00015, 00016, 00017, 00018) — deferred to 0.16.0 at pickup, with 00016 explicitly flagged as a live regression against 0000017
- Log viewer capability gaps (00004, 00006, 00021, 00022)
- Recovering the ~4,100 stranded WAL events (00023)
- Any change to `planifest-framework/` (00007, 00025 route out per the Framework Update Policy)
- Multi-user authentication or access control — the threat model here is browser-mediated attack from the developer's own browser, not multiple human users
- Remote/network exposure — the daemon stays bound to `127.0.0.1`
- Any schema or migration change
- Revisiting `uncaughtException -> process.exit(1)` as a general policy (00013 suggested action 5); this feature stops the *request path* from reaching it, but the handler itself stays as-is

### Deferred

- Local shared secret token (00012 suggested action 4) — see the Open Decision below; deferred unless the human elects otherwise, blocked on a threat that items 1-3 do not already close
- Projection instead of full `data` payload per row in `failure_sequence` / `drill_down` (00014 suggested action 3) — blocked on evidence the capped payload is still too large in practice

## Non-Functional Requirements

| NFR | Target | Measurement |
|-----|--------|-------------|
| Latency | `/query` p95 stays under the existing 100ms CI gate; validation overhead < 5ms | Existing performance test |
| Availability | Zero daemon exits under a malformed/oversized-request fuzz pass | Regression test asserting the process survives |
| Request cap | Body over the cap rejected with `413` before buffering completes | Integration test with an oversized body and a forged `Content-Length` |
| Result cap | `failure_sequence` and `drill_down` bounded by the same `MAX_LIMIT` precedent as `event_log` | Integration test asserting `truncated: true` and `total_count` |
| Security | Zero SQL fragments or stored values in any 4xx/5xx body | Regression test over a type-confused filter |
| Security | Injection-shaped input rejected and events table unchanged | New tests per F4 |

## Constraints and Assumptions

### Constraints

- ADR-009: the stdio proxy talks to this daemon over HTTP and sends no browser headers — new checks must not refuse it
- ADR-018: `/ui` is served in-process from the same origin, so Origin/Host checks do not affect it; the UI has no secret store and no build step
- ADR-024: identifier inputs must validate against the shared allow-list before SQL interpolation — extend it, do not duplicate it
- ADR-016: `event_log`'s limit/offset bounding is the precedent F3 should follow
- `component.yml` `breakingChangePolicy: requires-adr` — the auth reversal needs an ADR
- No schema modification (framework Hard Limit 3)

### Assumptions

- The daemon's only legitimate clients are same-origin (`/ui`), the stdio proxy, and Planifest hooks — all local, none cross-origin
- Browsers reliably send `Origin` on cross-origin requests including CORS-simple ones (the basis for F2 story 1)
- A few MB is a generous body cap for this API; no legitimate caller approaches it
- 00020's file/line references are 0.13.0-era and predate 0000018's test growth (405/16 files -> 491/28 files); they need re-verification at P3, not verbatim trust

## Scenario Paths

To be completed by the Scope Lock Challenge at P0.

**Happy path:**

> {{happy-path}}

**First-run path:**

> {{first-run-path}}

**Error / sad path:**

> {{error-sad-path}}

**Cross-session continuity:**

> {{cross-session-continuity}}

## Open Decision (blocks P1)

**Shared secret, or Origin/Host/Content-Type checks alone?** 00012 suggested action 4
proposes a token written to `~/.planifest/` at install time, required as a header.
Orchestrator recommendation: **items 1-3 only, no shared secret.** A token in
`~/.planifest/` readable by the owning user gives no protection against a same-user local
process, because that process can read `telemetry.db` directly. It defends only against
browser pages — which items 1-3 already close completely — while adding friction to the
stdio proxy and forcing the daemon to inject the secret into a static page that has no
secret store, weakening it in the process. Recorded here as the ADR question for P2.

## Acceptance Criteria

- [ ] A cross-origin `fetch` to `/emit` with `Content-Type: text/plain` is refused, and no event is written
- [ ] A request with a `Host` header naming an attacker-controlled domain is refused on every route
- [ ] `GET /ui` and the log viewer's own `/query` calls continue to work unchanged
- [ ] The stdio proxy and Planifest emission hooks continue to work unchanged
- [ ] A request body above the cap is refused with `413`, and the daemon process is still alive afterwards
- [ ] A chunked request with a forged `Content-Length` is still capped by the streaming byte counter
- [ ] `{"mode":"event_log","limit":"abc"}` returns a structured field-level error, not a DuckDB message
- [ ] `{"mode":"event_log","session_id":123}` returns no stored session_id value in the response body
- [ ] `limit` values of `-5`, `1.5`, `NaN`, and `1e21` are each rejected with a named-field error
- [ ] `failure_sequence` and `drill_down` return at most `MAX_LIMIT` rows with `truncated` and `total_count`
- [ ] Injection-shaped `sortField` and `distinct_values.field` inputs are rejected and the events table is unchanged
- [ ] An event carrying `<img src=x onerror=...>` renders literally in the UI with no script execution, including via `title`
- [ ] `test-coverage.md` claims match tests that can actually fail
- [ ] `*.local-only.*` is gitignored and the two tracked matches are untracked
- [ ] An ADR supersedes `component.yml`'s "no auth model required" position
