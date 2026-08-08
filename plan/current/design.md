# Design - 0000019-loopback-daemon-hardening

## Feature
- Problem: The loopback HTTP daemon on `127.0.0.1:3741` — the path both the log viewer and the stdio proxy use — has no `Origin`, `Host`, or `Content-Type` validation, no request-body cap, a weaker validation gate than the MCP path, and returns raw DuckDB errors containing SQL text and stored row values; one malformed request can terminate the process via `uncaughtException -> process.exit(1)`.
- Adoption mode: standard-iterative
- Feature ID: 0000019-loopback-daemon-hardening
- Version: 0.14.0 -> 0.15.0 (minor, Feature Pipeline track)
- Discovery: see `plan/current/discovery.md` (raw P0 findings — this document records confirmed decisions only)

## Product Layer

- User stories:
  - US-001: As an operator, I want malformed or oversized requests rejected with a structured error, so that a single bad request cannot terminate the daemon.
  - US-002: As a developer, I want the HTTP path to reuse the MCP path's `QueryShape` gate, so that the log viewer's path is no less strict than the MCP one.
  - US-003: As a security reviewer, I want error responses to carry a correlation id instead of engine text, so that no SQL fragment or stored value reaches a caller.
  - US-004: As a developer, I want cross-origin requests refused, so that a page I visit cannot forge telemetry into my store.
  - US-005: As a developer, I want `Host` validated, so that a rebound DNS name cannot read my telemetry.
  - US-006: As a developer, I want `Content-Type: application/json` required on writes, so that the CORS-simple no-preflight loophole is closed.
  - US-007: As an operator, I want `failure_sequence` and `drill_down` to cap their result sets and report truncation, so that one query cannot exhaust daemon memory.
  - US-008: As an agent consumer, I want the MCP tool-result text capped independently of the HTTP response, so that a large result cannot flood a context window.
  - US-009: As a security reviewer, I want injection-shaped input actually exercised against `sortField` and `distinct_values.field`, so that the allow-list claim is backed by a test.
  - US-010: As a security reviewer, I want XSS escaping verified in the rendered UI, so that the escaping claim is backed by a test.
  - US-011: As a maintainer, I want `test-coverage.md` to match what the suite exercises, so that the document is not a false assurance.
  - US-012: As a maintainer, I want files matching `*.local-only.*` ignored by git and untracked, so that local helper scripts cannot be committed by an `add -A`.

- Acceptance criteria confirmed: 15 (see `feature-brief.md`)

- Constraints:
  - ADR-009 — the stdio proxy talks to this daemon over HTTP and sends no browser headers; new checks must not refuse it
  - ADR-018 — `/ui` is served in-process from the same origin, has no build step and no secret store
  - ADR-024 — identifier inputs validate against the shared allow-list before SQL interpolation; extend it rather than duplicate it
  - ADR-016 — `event_log`'s limit/offset bounding is the precedent for bounding `failure_sequence` and `drill_down`
  - `component.yml` `breakingChangePolicy: requires-adr` — reversing the documented "no auth model required" position requires an ADR
  - Framework Hard Limit 3 — no schema modification; this feature adds no column, table, or migration

- Integrations: `GET /ui` (same-origin browser client), the stdio proxy per ADR-009 (non-browser), Planifest emission hooks (non-browser). All three must keep working unchanged.

## Architecture Layer

- Latency target: `/query` p95 stays under the existing 100ms CI gate; boundary-validation overhead under 5ms.
- Availability target: zero daemon exits under a malformed/oversized-request fuzz pass. This is the feature's headline guarantee — today one request can kill the process.
- Scalability target: not constrained. Single-user local daemon; concurrency is a handful of local clients.
- Security: **Origin/Host/Content-Type checks, no shared secret** (ADR-032, confirmed at P0). `Host` allow-listed to `127.0.0.1:<PORT>` / `localhost:<PORT>`; `Origin` refused when present and not the daemon's own; `Content-Type: application/json` required on `POST /emit` and `POST /query`. No authz model — there is one local user. Data classification: telemetry `data` payloads carry file paths, error strings, and prompt/ADR fragments, so treat the store as sensitive-internal; that classification is precisely why 00011's error leakage matters.
- Data privacy: no regulated data, no PII by design. Retention unchanged (7 daily + 4 weekly verified backups per 0000018). No new data is collected by this feature.
- Observability: full error detail with stack to stderr, paired with a correlation id returned to the caller so a developer can trace a redacted client error back to the server log. No new metrics or tracing.
- Cost boundary: not constrained — local daemon, no cloud spend.

## Engineering Layer

- Stack: vanilla-js frontend (no build step, ADR-018) / TypeScript on Node, no framework (`node:http`) / DuckDB / no ORM / no IaC / no cloud / local-daemon compute / GitHub Actions CI / build target `local`. Unchanged — no new stack decision.
- Components:
  - `structured-telemetry-mcp` (existing, sole component) — telemetry ingestion, query, loopback HTTP daemon, static log viewer.
- Data ownership: `structured-telemetry-mcp` -> `~/.planifest/telemetry.db` (`events`). Sole owner. No other component writes it.
- Deployment: user-scoped supervised background service — launchd (macOS), `systemd --user` (Linux), nssm (Windows). `npm run deploy` builds and restarts a running daemon, verifying via the `buildId` fingerprint on `GET /health` (0000018) that the new build is the one answering.
- API versioning: not applicable. The changes are additive rejections at the boundary plus two additive response fields (`truncated`, `total_count`) on `failure_sequence` / `drill_down`. No existing successful response shape changes.

## Scope

- In:
  - `Host` allow-list validation on all daemon routes
  - `Origin` rejection when present and not the daemon's own origin
  - `Content-Type: application/json` required on `POST /emit` and `POST /query`
  - Request-body byte cap enforced on both `Content-Length` and the streaming `data` handler
  - `try/catch` around the `req.on('end')` handler so a throw rejects the promise rather than reaching `uncaughtException`
  - Socket/request timeout against slow-body connections
  - HTTP path reuses the MCP path's `QueryShape` gate
  - Integer/range/NaN validation for `limit`, `offset`, `loop_threshold`, `trend.limit`
  - Generic client error bodies with a correlation id; full error to stderr; `500` for engine errors, `400` reserved for validated client input
  - Explicit `LIMIT` plus `truncated` and `total_count` on `failure_sequence` and `drill_down`
  - Independent cap on MCP tool-result text serialisation
  - Genuine injection tests against `sortField` and `distinct_values.field`
  - Playwright XSS-escaping tests including the `title` attribute
  - `SORTABLE_FIELDS` / `SUGGESTIBLE_FIELDS` imported into `ui.test.ts` rather than restated
  - `test-coverage.md` corrected to match what the suite exercises
  - `.gitignore` pattern `*.local-only.*`; untrack the two currently-tracked matches
  - ADR-032 superseding the "no auth model required" position

- Out:
  - Log viewer correctness defects (00015-00018) — deferred to 0.16.0; **00016 is a live regression against 0000017 and was deferred with that called out**
  - Log viewer capability gaps (00004, 00006, 00021, 00022)
  - Recovering the ~4,100 stranded WAL events (00023)
  - Any `planifest-framework/` change (00007, 00025 route out per the Framework Update Policy)
  - Multi-user authentication or access control — the threat model is browser-mediated attack from the developer's own browser, not multiple humans
  - Remote/network exposure — the daemon stays bound to `127.0.0.1`
  - Any schema or migration change
  - Revisiting `uncaughtException -> process.exit(1)` as a general policy; this feature stops the request path reaching it, the handler stays
  - Graceful-shutdown request draining and its race with the WAL checkpoint — 0000018 shutdown-path surface, not request-boundary surface
  - Hook-side handling of a structured `400` from `/emit` — filed as backlog 00028

- Deferred:
  - Local shared secret token (00012 action 4) — **not adopted**; blocked on a threat the checks do not already close. A token readable by the owning user gives no protection against a same-user process that can read `telemetry.db` directly.
  - Projection instead of full `data` payload per row in `failure_sequence` / `drill_down` (00014 action 3) — blocked on evidence the capped payload is still too large in practice.

## Assumptions

- The daemon's only legitimate clients are `/ui` (same-origin), the stdio proxy, and Planifest hooks — impact if wrong: a real client gets refused and its traffic silently stops.
- Browsers reliably send `Origin` on cross-origin requests including CORS-simple ones — impact if wrong: the CSRF defence in US-004 does not hold and the `Content-Type` requirement becomes the sole barrier.
- A few MB is a generous body cap; no legitimate caller approaches it — impact if wrong: a large legitimate `/emit` is refused.
- 00020's file/line references are 0.13.0-era (405 tests / 16 files) and predate 0000018's growth to 491 / 28 files — impact if wrong: P3 chases stale line numbers. Mitigation: re-verify against the current tree before acting on them.
- **Not an assumption — verified at P0:** every legitimate caller already sends `Content-Type: application/json` (three framework hooks, the stdio proxy client, the log viewer).

## Risks

- R-001 — The `Origin`/`Host` checks refuse a legitimate non-browser client (stdio proxy, emission hooks). Likelihood: medium. Impact: high — telemetry stops being recorded and, per backlog 00028, may do so silently. Mitigation: the checks fire only on a *present and mismatched* `Origin` or an unrecognised `Host`; explicit acceptance criteria cover both clients.
- R-002 — F1, F2 and F3 all modify `src/server-http.ts`. Likelihood: high if parallelised. Impact: medium — clobbering, as seen in 0000017 R-002 with `index-html.ts`. Mitigation: implement as one integrated pass, not three parallel edits to the same file.
- R-003 — Reversing the documented "no auth model required" position without the ADR landing first would leave `component.yml` contradicting the code. Likelihood: low. Impact: medium. Mitigation: ADR-032 at P2, before P3 codegen.
- R-004 — Tightening the HTTP path to `QueryShape` may break existing callers relying on loose coercion (e.g. a string `limit` that previously worked by accident). Likelihood: medium. Impact: medium. Mitigation: audit the log viewer's own `/query` payloads at P3; they are the main in-repo caller.
- R-005 — 00020's stale line references send P3 to the wrong tests. Likelihood: medium. Impact: low. Mitigation: re-verify against the current tree first.
- R-006 — Body-cap enforcement placed only on `Content-Length` would be bypassed by a chunked request with no or forged length. Likelihood: medium if implemented naively. Impact: high — the original DoS remains. Mitigation: explicit acceptance criterion for the streaming byte counter.

## Dependencies

- Upstream: 0000018 (`buildId` on `/health`, orphan-port detection, WAL checkpoint behaviour — all relied on by the first-run and cross-session paths); ADR-009, ADR-016, ADR-018, ADR-024.
- Downstream: backlog 00028 (hook-side `/emit` `400` handling) becomes reachable only once this ships — worth picking up in the same window. Cluster B (00015-00018) targets 0.16.0 against the same daemon.

## Active Skills
None. The skills-inbox is empty and no capability skill was proposed for this stack — the work is Node/TypeScript backend hardening plus Vitest/Playwright tests, all covered by the existing Planifest phase skills.

## Skill Map

| Requirement | Best-fit Skill | Rationale |
|-------------|----------------|-----------|
| US-001, US-002, US-003 — request boundary validation and safety | planifest-codegen-agent (TDD inner loop: test-writer -> implementer -> refactor) | Behavioural change to one file with reproducible failing cases already documented; RED-before-GREEN is straightforward |
| US-004, US-005, US-006 — browser-mediated attack surface | planifest-adr-agent, then planifest-codegen-agent | The auth reversal needs ADR-032 landed before code, per `breakingChangePolicy: requires-adr` |
| US-007, US-008 — bounded result sets | planifest-codegen-agent | Follows the existing ADR-016 bounding precedent; mechanical once the cap is chosen |
| US-009, US-010, US-011 — security tests that can fail | planifest-test-writer, then planifest-security-agent at P5 | These *are* tests; the security agent is the right reviewer for whether they now back the claims |
| US-010 — XSS escaping in the rendered UI | playwright | Browser-executed evidence is the only way to prove no script executes, including via the `title` attribute |
| US-012 — local-only file hygiene | planifest-codegen-agent | One `.gitignore` line plus an untrack; no design content |
| All — verification before P5 | planifest-verify-by-execution | Acceptance criteria here are behavioural (a request is refused, the daemon stays up) and must be proven by running the daemon, not by reading test output |

## Repo Instructions

Two files present in `planifest-overrides/instructions/`:

**`framework-update-policy.md`** — Uncommitted changes under `planifest-framework/` are a dependency update, not a feature: commit them directly, never fold them into the active feature's pipeline artifacts, never mix them into a commit with product code, and push on whatever branch is active. Established 2026-08-01. **Applied at P0:** backlog 00007 and 00025 were routed out of this feature on this basis, and 00028 was filed rather than folded in.

**`git-up-to-date-shorthand.md`** — "GUTD" means: `git status` first, checkout `main`, pull latest, and report untracked files. Do not silently force-reconcile a diverged local `main`; prefer a reversible step. Established 2026-08-02. **Applied at session start:** GUTD run clean, `main` level with `origin/main`, no untracked files.

## Confirmation
Human confirmed this design before proceeding: {{pending}} // Date and Time confirmed: {{pending}}
