---
title: "Risk Register - 0000019-loopback-daemon-hardening"
summary: "Technical, operational, security and compliance risks with likelihood and impact."
---
# Risk Register - 0000019-loopback-daemon-hardening

| ID | Category | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-001 | operational | The new `Origin`/`Host` checks refuse a legitimate non-browser client — the stdio proxy (ADR-009) or a Planifest emission hook. Telemetry stops being recorded, and per backlog 00028 it may do so **silently**, because it is unverified whether the hooks treat a non-2xx as a failure worth writing a marker for | medium | high | req-002 passes any request with no `Origin` header, which is what both clients send. Explicit acceptance criteria in req-002 and req-003 cover both. P0 verified all six in-repo callers already send `Content-Type: application/json`. Residual exposure is tracked as backlog 00028 |
| R-002 | technical | req-001 to req-004 all modify the same request-entry path in `src/server-http.ts`. Parallel edits clobber each other | high if parallelised | medium | Implement as one integrated pass, not four dispatched agents. Exact precedent: 0000017 R-002 hit this with `index-html.ts` and the resolution was the same. Recorded in the design and in each requirement's Dependencies |
| R-003 | technical | A body cap enforced only on `Content-Length` looks correct in review but is bypassed by a chunked request with absent or forged length — the original DoS survives a plausible fix | medium | high | req-004 mandates two independent enforcement points and states that a `Content-Length`-only check does not satisfy the requirement. Three separate acceptance criteria cover honest, absent, and forged length |
| R-004 | technical | Tightening the HTTP path to the shared gate breaks an existing caller that relied on loose coercion — for example a string `limit` that previously worked by accident | medium | medium | Audit `src/ui/index-html.ts` at P3; it is the main in-repo caller. req-005 forbids loosening the schema to accommodate a broken caller — report instead |
| R-005 | security | `QueryShape` is reused on the HTTP path without tightening, closing only the `limit: "abc"` case and leaving `-5`, `1.5`, `1e21` and the undeclared `offset` open. The requirement looks satisfied while three of four reproduced defects remain | medium | high | req-005 states this explicitly with a per-input table, and its acceptance criteria enumerate all six inputs across both paths. This risk exists because the backlog entry's own suggested action was insufficient |
| R-006 | security | Error redaction is applied to the two HTTP sites but not to the MCP site at `src/server-factory.ts:204`, leaving the same leak open on the path that feeds an agent's context directly | medium | high | req-006 names all three sites in one table and requires them fixed together |
| R-007 | security | The allow-list check is implemented as a bare property lookup, so `constructor` or `__proto__` returns an inherited function and passes a truthiness test | low | high | req-009 puts all three prototype keys in the mandatory corpus with a stated rationale, and requires rejection before SQL construction |
| R-008 | technical | The `Host` check compares against the configured `PORT` constant rather than the actual bound port, locking out the ephemeral-port E2E harness (0000016 R-002 binds via port 0) | medium | medium | req-001 requires comparison against `server.address()`, with a dedicated acceptance criterion for an ephemeral-port server |
| R-009 | technical | 00020's file and line references are 0.13.0-era (405 tests / 16 files) and predate 0000018's growth to 491 / 28. P3 chases stale pointers | medium | low | Verified at P1: current locations recorded in each requirement. `readBody` is at `:166` not `:65`; the `/query` catch at `:230` not `:126`; `uncaughtException` at `:72` not `:51` |
| R-010 | operational | XSS tests assert only that the DOM contains escaped entities, which passes even if a payload executes in a context the assertion does not inspect | medium | medium | req-010 requires behavioural assertions — a registered dialog handler and console-error listener — and states that DOM-text assertions alone do not satisfy it |
| R-011 | security | The new tests are written to pass against current behaviour rather than to fail against broken behaviour, reproducing the exact defect this release exists to fix | medium | high | req-009 and req-010 each require a real RED-before-GREEN cycle: weaken the control, confirm the test fails for the right reason, restore. 0000018 set this precedent for its P5 fixes |
| R-012 | operational | `test-coverage.md` is updated to describe intended coverage rather than actual coverage, re-creating the false-assurance defect in a new form | low | high | req-011 requires every security claim to name the test file backing it, and lands only after req-009 and req-010 exist |
| R-013 | compliance | The auth reversal ships without ADR-032, leaving `component.yml`'s documented "no auth model required" position contradicting the code, in breach of `breakingChangePolicy: requires-adr` | low | medium | ADR-032 is a P2 gate item and is listed as a dependency of req-001 and req-002 |
| R-014 | operational | `git rm --cached` on the two `.local-only.` files reads as a deletion to anyone else on the repo, who then recreates or restores them | low | low | req-012 requires the commit message to state the files remain on disk, and forbids sharing a commit with `src/` changes |
| R-018 | technical | req-005 makes `distinct_values`' limit ceiling a hard rejection, where `distinct-values.ts:39` today silently clamps — `{"mode":"distinct_values","limit":500}` succeeds now and returns `400` afterward. A caller relying on that clamp breaks | low | low | No in-repo test or caller sends `distinct_values` with `limit > 20` — verified at P1 review. req-005's Test corpus makes the change explicit rather than incidental, and the log viewer's own suggestion comboboxes never request more than the default |

## Assumptions Carrying Risk

Recorded per the spec-agent rule that documented assumptions for minor gaps are logged at `likelihood: medium`.

| Assumption | Impact if wrong | Tracked as |
|---|---|---|
| The daemon's only legitimate clients are `/ui`, the stdio proxy, and Planifest hooks | An unknown client is refused and its traffic silently stops | R-001 |
| Browsers reliably send `Origin` on cross-origin requests including CORS-simple ones | req-002's CSRF defence does not hold; req-003's `Content-Type` requirement becomes the sole barrier | R-001 |
| 4 MB is a generous body cap that no legitimate caller approaches | A large legitimate `/emit` is refused with `413` | R-015 |
| A 100,000-character MCP text budget is generous for normal results | Normal-sized results start truncating, degrading the agent experience | R-016 |

Both threshold assumptions previously pointed at R-004, which concerns callers relying on loose numeric coercion — a different failure entirely. They now have risks that actually cover them.

| ID | Category | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|---|
| R-015 | operational | The 4 MB body cap is lower than some legitimate payload, so a real `/emit` is refused with `413` | low | medium | Overridable via `PLANIFEST_MAX_BODY_BYTES`. The runbook directs an operator to investigate what the client is sending before raising it, so a genuine defect is not masked by widening the cap |
| R-016 | operational | The 100,000-character MCP text budget truncates results a user considers normal, degrading the agent experience without an obvious cause | low | low | req-008 requires a truncated result to say so and to report `total_count`, so the cause is self-evident rather than silent. Overridable via `PLANIFEST_MCP_TEXT_BUDGET` |
| R-017 | technical | The shared gate applies one global ceiling to `limit`, admitting `distinct_values` values up to 1000 that are then silently reduced to 20, or applying a 1000-row ceiling to `trend`'s day count | medium | medium | req-005 states the ceiling is per-mode and that `trend`'s `limit` is days, with corpus cases for both. `MAX_LIMIT` is two unexported module-local constants (`event-log.ts:19` = 1000, `distinct-values.ts:20` = 20), which is what makes this easy to get wrong |

**No longer an assumption:** that legitimate callers send `Content-Type: application/json` was verified at P0 across all six in-repo callers and is now a fact, not a risk.
