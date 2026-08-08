---
title: "Build Log - 0000019-loopback-daemon-hardening"
summary: "Working telemetry file maintained by the orchestrator throughout the pipeline run."
---
# Build Log - 0000019-loopback-daemon-hardening

> Created at P0. Appended by the orchestrator at each phase boundary. Survives session changes.

## Header

| Field | Value |
|-------|-------|
| Feature ID | `0000019-loopback-daemon-hardening` |
| Pipeline start | `2026-08-08T12:37:31Z` |
| Tool | `Claude Code` |
| Primary model | `claude-opus-5` |
| Cheaper model | `claude-sonnet-5` |

---

## Phase Log

### P0 — Assess & Coach

| Field | Value |
|-------|-------|
| Start | `2026-08-08T12:37:31Z` |
| Model tier | primary |
| Skills loaded | planifest-orchestrator |
| Agents spawned | `0` |
| MCP calls | `4` |
| Parallel task batches | `0` |
| Telemetry | confirmed-disabled |
| Notes | see exchanges below |

Adoption mode: standard-iterative — confirmed by human on 2026-08-08
Version confirmed: 0.15.0 (from 0.14.0, minor — Feature Pipeline track)

Context hygiene: no programmatic context-clear available on this host. Flagged to
the human at P0 start action -1 per Context Hygiene. Human did not elect to clear
and directed the run forward twice; proceeding without a clear, recorded here
rather than silently skipped. Prior session context is this run's own GUTD sync
and the discovery that motivated the hygiene line item — no completed-cycle
residue.

Telemetry: `--structured-telemetry-mcp` signal not detected for this run; no
failure markers present under `plan/.telemetry-failures/`. Recorded as
confirmed-disabled.

#### P0 exchanges

P0 exchange — release scope (round 1): Q: Is this release just the *.local-only.*
gitignore change, or a larger release with backlog items pulled in? / A: Bundle
backlog items in — Feature Pipeline, minor bump.

P0 exchange — scoping frame correction: Q: (orchestrator framed the run as a
"gitignore release" with backlog items added to it) / A: Human corrected — it is a
full release and the scope is being decided; the gitignore item is a line item,
not the anchor. Orchestrator re-triaged the backlog on substance rather than
filename.

P0 exchange — 0.15.0 scope: Q: Which cluster goes into 0.15.0 — daemon hardening
+ test integrity, log-viewer correctness, or both as two waves? / A: Cluster A
(00010-00014) + 00020 + the gitignore hygiene item. Log-viewer correctness
(cluster B) deferred to 0.16.0.

#### Backlog pickup (P0 start action 3c)

Pulled in (6): 00010, 00011, 00012, 00013, 00014, 00020 — folded into
`feature-brief.md`; entry folders deleted in the same commit.

Discarded as already shipped (2), verified before discard:
- 00002-framework-product-id-emission — `schemas/telemetry-event.schema.json`
  defines `product_id`; `emit-phase-start.mjs`, `emit-phase-end.mjs` and
  `context-pressure.mjs` all emit it.
- 00005-scope-lock-default-to-drafted-answers — `planifest-scope-lock-agent`
  exists and the orchestrator skill documents default parallel dispatch (ADR-003).

Routed out of this pipeline (2) — Framework Update Policy, CLAUDE.md:
- 00007-docs-agent-gate-b-ignores-continuous-run
- 00025-auto-trigger-orchestrator-not-resuming-session
Both are `planifest-framework/` changes and are committed directly rather than
routed through P0-P9. 00025 was observed reproducing during this session: the
orchestrator did not auto-load on `UserPromptSubmit` and was invoked manually.

Left for a future pickup (12): 00001, 00004, 00006, 00015, 00016, 00017, 00018,
00021, 00022, 00023, 00026, 00027.

Flagged to the human at pickup, not actioned:
- 00016 is a live regression against 0000017 (shipped 2026-08-03) — auto-refresh
  destroys expanded rows on every poll. Human accepted the deferral to 0.16.0
  with the regression called out.
- 00023 — ~4,100 events stranded in a 2.4 MB DuckDB WAL that 1.5.1 cannot replay.
  Not time-critical, but unrecoverable if the file is cleaned up.

#### Scope Lock Challenge

Dispatched per ADR-003 default: four `planifest-scope-lock-agent` instances in
parallel, one per scenario path, fresh context, no coaching history passed.
Human explicitly authorised the dispatch (this session is otherwise configured
not to spawn subagents). All four returned; none failed, so the partial-failure
fallback was not used. Batch-presented; human gave a separate explicit decision
per item.

Scope Lock — happy path: Three canonical first actions, not two — a Planifest
hook POST /emit (write), a developer opening /ui which calls /query (read), and
the stdio proxy POST /query (ADR-009, non-browser, no Origin header). Success is
that all three behave exactly as they did pre-hardening; the hardening is
invisible unless a request violates a check. [source: agent-draft-edited]

Scope Lock — first-run path: No bootstrap or provisioning step exists — the
checks are stateless per request, so first run behaves identically to every later
run. On upgrade, `npm run deploy` restarts and verifies via buildId that the new
code answers; on fresh install the daemon is already hardened. No relaxed or
learning period. telemetry.db untouched — no schema change. The deploy/restart
transition is deliberately NOT new test surface: 0000018's buildId fingerprint
(req-008) and orphan-port detection (req-009) already cover it. Recorded as an
intentional decision rather than an oversight. [source: agent-draft-edited]

Scope Lock — error / sad path: The likeliest failure is a false positive, not an
attack. Origin/Host checks only fire on a mismatched Origin or unrecognised Host,
so callers sending neither pass untouched. A wrong or missing Content-Type
returns 400 naming the field plus a correlation id, never engine text, with full
detail to stderr. A refused /emit is a real telemetry gap, so the daemon returns
a clean unambiguous 400 the hook's failure-marker logic can act on, distinct from
a 500. Oversized or malformed bodies return 413/400 and the daemon stays up.
[source: agent-draft-accepted]

Scope Lock — cross-session continuity: Daemon at-risk state is unchanged —
events since the last WAL checkpoint (60s or 100 events). This feature adds no
persisted state but shrinks how often that window is entered, since a bad request
no longer exits the process. Recovery runs 0000018's existing path unchanged. No
token means nothing to resynchronise across a restart. An interrupted in-flight
request writes nothing partial — validation completes before any write. Pipeline
session state in plan/current/ survives interruption. [source:
agent-draft-accepted]

Scope Lock complete. All four scenario paths captured.

##### Gaps surfaced by the Scope Lock agents, and their resolution

- Content-Type assumption (error-path agent, flag a): the agent flagged as
  unverified that the stdio proxy and Planifest hooks already send
  `Content-Type: application/json`. **Closed by inspection at P0**, not carried
  forward as a risk — all three framework telemetry hooks
  (`emit-phase-start.mjs:219`, `emit-phase-end.mjs:208`,
  `context-pressure.mjs:235`), the stdio proxy's HTTP client
  (`src/http-query-service.ts:42`, `src/http-repo.ts:16`) and the log viewer
  (`src/ui/index-html.ts:258`) all send it today. Requiring it breaks no
  legitimate caller.
- Hook-side handling of an /emit 400 (error-path agent, flag b): nothing wires a
  structured 400 from /emit into `plan/.telemetry-failures/`. That protocol lives
  hook-side in `planifest-framework/`, which routes out of this pipeline per the
  Framework Update Policy. Human decision: file as backlog 00028 rather than drop.
- In-flight request vs SIGTERM checkpoint (cross-session agent): drain-to-
  completion versus drop-mid-handling is unspecified by any ADR. Human decision:
  explicitly OUT OF SCOPE for this feature — it is 0000018 shutdown-path surface,
  not request-boundary surface. Recorded as a decision in scope, not left as an
  open gap.

#### Open decision resolved

P0 exchange — auth model (ADR-032): Q: Local shared secret token, or
Origin/Host/Content-Type checks alone? / A: Checks only, no shared secret. A
token in ~/.planifest/ readable by the owning user gives no protection against a
same-user local process that can already read telemetry.db directly; it defends
only against browser pages, which the checks close completely, while adding
friction to the stdio proxy and forcing the daemon to inject the secret into a
static page with no secret store.

P0 exchange — Scope Lock drafting method: Q: Framework wants four parallel
scope-lock subagents, but this session is configured not to spawn agents unless
asked — draft inline or dispatch? / A: Dispatch the four subagents. Framework
default protocol followed exactly; no deviation to record.

#### P0 gate

P0 exchange — design confirmation: Q: Confirm the design and start the pipeline?
/ A: Confirmed, proceed to P1.

P0 exchange — run mode: Q: Check after each phase, or continuous run? / A:
Continuous run. `plan/.run-mode` written as `continuous`. No stops at P1-P6
gates; P7-P9 still stops.

P0 exchange — loop toggles: Q: Turn on the design-critic maker-checker pass? /
A: On, blocking — a REJECT returns artifacts for revision, cap 3 per
`planifest-loop-runner`. Note the combination chosen: continuous run with a
blocking critic, so quality control at P1/P2 is automated rather than human.
No toggle config file exists in `planifest-framework/`, so `p0_completeness`,
`cross_model_review` and `reversal_protocol` remain at their default off.

Capability skills (REQ-026): stack assessed, no proposal made. The work is
Node/TypeScript backend hardening plus Vitest/Playwright tests; the `playwright`
skill is already available and mapped to US-010 in the Skill Map. Skills-inbox
empty at P0 and re-checked at the P0->P1 transition.

Gate accepted: P0 — 2026-08-08T13:19:38Z

---

### P1 — Requirements

| Field | Value |
|-------|-------|
| Start | `2026-08-08T13:19:38Z` |
| Model tier | primary |
| Skills loaded | planifest-orchestrator, planifest-spec-agent |
| Agents spawned | `{{count}}` |
| MCP calls | `{{count}}` |
| Parallel task batches | `{{count}}` |
| Telemetry | confirmed-disabled |
| Notes | Continuous run — no human gate stop. `design_critic` on (blocking) runs over the P1 artifact set before P2. |

#### design_critic loop (cap 3)

Iteration 1: REJECT, 10 blocking findings. Fixed: AC-cap breach on all 12
requirements (recast to 3 ACs each with corpora moved to a Test corpus
section), limit clamp-vs-reject stated backwards against a passing test
(query-telemetry.test.ts:299), total_count/truncated placed where they would
have broken the log viewer's existing read (index-html.ts:371/:419),
correlationId-on-403 contradiction, ErrorEnvelope object-only shape that
would have silently restructured /emit's error format, req-009 naming the
wrong two tests as tautological (would have had codegen delete the two tests
that catch a regression and keep the two that cannot), trend.limit named as
a field that does not exist, component.yml contract.apiSpec pointing at a
nonexistent file, two risk-register assumptions mapped to a risk that did
not cover them.

Iteration 2: REJECT, 8 blocking findings — two self-inflicted by iteration
1's own fixes. Most consequential: component.yml's exceptions block had
started citing "ADR-032" as an accepted decision and describing the auth
change in present tense, before P2 has written that ADR — contradicting the
feature's own sequencing rule. Also: distinct_values genuinely clamps today
(distinct-values.ts:39) where req-005 had treated ceiling behaviour as
uniform; resolved by making rejection uniform going forward as a stated,
deliberate behaviour change, not an accident. failure_sequence/drill_down
ceilings undefined in req-005 despite req-007 depending on them.
trend.limit remnants in component.yml/scope.md not caught by iteration 1's
fix elsewhere. Correlation-id gap on 413/415. Two OpenAPI self-contradictions
(worked example reintroducing the global-ceiling mistake; /emit 400
description contradicting the ErrorEnvelope shape one section later).

Iteration 3: REJECT, 1 blocking finding — domain-glossary.md's MAX_LIMIT
entry still asserted uniform rejection, missed when req-005 moved off that
premise in iteration 2. Fixed and re-verified. One advisory (R-018) also
picked up: no risk entry covered the distinct_values behaviour change itself.

Cap reached at iteration 3 per the design_critic toggle's own rule. Per
Governed Phase-Reversal escalation conventions, the loop halted and escalated
to the human rather than dispatching a fourth automated critic pass, even
though iteration 3's own assessment characterised the remaining item as a
one-paragraph sync gap rather than a structural defect.

Mechanical gate (consistency-check.mjs) held at 18 findings across all three
iterations, unchanged — all pre-existing cross-feature ADR-resolution class,
independently reproduced by two critic instances against the shipped
plan/_archive/0000018 archive (which fails the same check with 23 findings).
Filed as backlog 00029 rather than fixed inline, since an agent should not
edit the gate currently judging its own output.

P0 exchange — P1 gate close-out: Q: design_critic hit its cap; iteration 3's
finding is fixed and re-verified — accept and proceed, spawn a 4th
independent check, or review directly? / A: Accept P1 as revised, proceed to
P2.

Gate accepted: P1 — 2026-08-08T14:07:34Z (continuous run; no phase-boundary
stop, escalation resolved above per Hard Limit on blocked-loop escalation)

---

### P2 — Architecture Decisions

| Field | Value |
|-------|-------|
| Start | `2026-08-08T14:07:34Z` |
| Model tier | primary |
| Skills loaded | planifest-orchestrator, planifest-adr-agent |
| Agents spawned | `{{count}}` |
| MCP calls | `{{count}}` |
| Parallel task batches | `{{count}}` |
| Telemetry | confirmed-disabled |
| Notes | Continuous run — no human gate stop. `design_critic` on (blocking) runs over the combined P1+P2 set before P3, running consistency-check.mjs first per the orchestrator's Design-critic note. |

| Metric | Value |
|--------|-------|
| Total phases completed | `{{count}}` |
| Total agents spawned | `{{count}}` |
| Total MCP calls | `{{count}}` |
| Phases using parallelism | `{{count}}` |
| Primary tier agent calls | `{{count}}` |
| Cheaper tier agent calls | `{{count}}` |
| Self-corrections | `{{count}}` |
| Phases skipped | `{{list or "none"}}` |
| Phases with a recorded telemetry gap | `{{count}}` |
