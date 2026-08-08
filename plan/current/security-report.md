# Security Report - 0000019-loopback-daemon-hardening

**Component:** structured-telemetry-mcp
**Scope reviewed:** `src/server-http.ts`, `src/server-factory.ts`, `src/query/validate-query.ts`, `src/query/failures.ts`, `src/query/token-efficiency.ts`, `src/query/event-log.ts`, `src/query/distinct-values.ts`, `src/query/bottlenecks.ts`, `src/query/column-allow-list.ts`, `src/ui/index-html.ts`, ADR-032, risk-register, req-001..req-012.

This is a security-hardening feature, so the review verifies the code actually closes the vulnerabilities it targets and introduces no new ones. **It does.** Every requirement-level control was traced to code and confirmed. No Critical or High finding exists in the feature's own code. **Nothing blocks the ship.**

---

## Threat Model (STRIDE)

| Threat | Category | Severity | Mitigation |
|---|---|---|---|
| DNS-rebinding page reaches the daemon with a rebound hostname | Spoofing | High | **Mitigated.** `checkBoundary()` (server-http.ts:247-252) exact-matches `Host` against `127.0.0.1:<boundPort>` / `localhost:<boundPort>` via `Array.includes`. A rebound attacker domain can never equal an allow-listed authority. Compared against the *actually-bound* port (:236), not the configured constant. |
| Cross-origin browser page forges writes/reads (CSRF) | Tampering / Info Disclosure | High | **Mitigated.** Origin rejection (server-http.ts:254-261) refuses any present `Origin` not equal to the daemon's own; `Content-Type: application/json` required on POST (:263-268) forces a preflight that Origin then declines. Absent-Origin acceptance is safe — browsers always send `Origin` on cross-origin requests. |
| Oversized / chunked body crashes daemon (the original DoS) | Denial of Service | High | **Mitigated.** Two-point body cap (server-http.ts:198-202 Content-Length pre-check, :206-218 streaming counter with `req.destroy()`); `end` handler wrapped in try/catch (:219-225) so no throw escapes to `uncaughtException`. Request timeout set against slow-loris (:394). |
| Engine/SQL/stored-row text leaks to caller | Info Disclosure | High | **Mitigated.** `respondError()` (server-http.ts:282-294) and `redactError()` (server-factory.ts:235-239) return generic bodies + a `correlationId`; full error/stack goes to stderr only. Verified on `/emit`, `/query`, and the MCP handler. |
| SQL injection via identifier position (`sortField`, `distinct_values.field`, `group_by`) | Tampering | High | **Mitigated.** All three resolve through allow-lists before any SQL is built (event-log.ts:46-49, distinct-values.ts:33-39, bottlenecks.ts:88-98 gated by dispatchQuery:119-124). Only resolved column names are interpolated — never the client string. |
| Numeric-field abuse bypasses cap via NaN/coercion | Tampering / DoS | Medium | **Mitigated.** `validateQuery` (validate-query.ts) rejects on a positive integer/range test (`isIntegerInRange`, :70-72), never a failed comparison; per-mode ceilings; runs on both HTTP (:373) and MCP (server-factory.ts:196) paths. |
| Unbounded result set exhausts memory / context | Denial of Service | Medium | **Mitigated.** `failure_sequence` / `drill_down` gain explicit `LIMIT` + `total_count`/`truncated` (failures.ts:160-201, token-efficiency.ts:211-252); MCP tool-result text budget (server-factory.ts:249-269). |
| Stored hostile value renders as script in the log UI (XSS) | Elevation / Tampering | Medium | **Mitigated.** `escapeHtml` escapes `& < > " '` (index-html.ts:243-245) applied to every rendered cell including the `title` attribute (:302); detail JSON via `textContent` (:317); datalist via `option.value` (:286-287). |
| Same-user local process reads `telemetry.db` directly | Info Disclosure | Low | **Not mitigated — out of scope by design (ADR-032).** No shared secret; the threat model is browser-mediated, not multi-process. Accepted, documented. |
| Repudiation of who emitted an event | Repudiation | Low | Not applicable — single local user, no auth model (ADR-032). |

---

## Dependency Audit

`npm audit`: **9 total (3 high, 4 moderate, 2 low)**; `npm audit --omit=dev`: **6 (2 high, 3 moderate, 1 low)** — includes `postcss` (moderate, GHSA-fxqj-rqcc-2cmp) and `ip-address` (transitive).

- **Pre-existing, not introduced by this feature** — no dependency was added or bumped in 0000019 (package.json unchanged in the diff).
- Not reachable through the daemon's runtime surface: the daemon does not process untrusted CSS (`postcss` is build/UI tooling) and the flagged transitive packages are not on the request path.
- **M1 (Medium):** run `npm audit fix` and re-audit as routine maintenance. Non-blocking for this feature.

## Secrets Management

- No hardcoded credentials, tokens, keys, or passwords in the reviewed code. Deliberately no secret store (ADR-032).
- Correlation ids are `randomUUID()` — non-secret trace handles, correctly not treated as auth.
- `.gitignore` gains `*.local-only.*` (req-012) to keep local-only files untracked. No secret exposure via env: env vars are numeric tuning knobs (`PLANIFEST_MAX_BODY_BYTES`, timeouts, ceilings) only.

## Authentication & Authorisation Review

- By design (ADR-032) the daemon authenticates **no credential**. It now checks caller **provenance** (Host / Origin / Content-Type) instead. This is the correct model for a single-user loopback daemon and the ADR reasoning is sound: a shared secret would defend against exactly the attacker the three checks already exclude, while doing nothing against a same-user process that can read the DB file directly.
- The absent-`Origin` acceptance is load-bearing (stdio proxy + emission hooks send none) and **not** a browser bypass: browsers cannot suppress `Origin` on a cross-origin request. Reasoning holds.

## Input Validation Review

Verified against the two entrypoints (`POST /query`, `POST /emit`, and the MCP tools). Both query entrypoints run the identical two-stage gate — `QueryShape` (Zod) then `validateQuery` — before dispatch, closing the HTTP/MCP divergence (req-005).

- `Host` media-type/authority parse admits no bypass tested: `application/json\t`, `application/json ; x`, and a duplicated `Content-Type` header (Node joins to `"application/json, text/plain"`) all fail the exact `=== 'application/json'` check after `split(';')[0].trim().toLowerCase()`.
- Numeric fields (`limit`, `offset`, `loop_threshold`) require `typeof === 'number' && Number.isInteger && in-range`; floats, strings, `NaN`, and out-of-range all reject. `offset` is validated by the gate itself (it is not in the Zod schema), so a non-numeric `offset` is caught before the `OFFSET ${offset}` interpolation.
- `/emit` `validateEvent` errors (validate-event.ts:57-79) name only the caller's own submitted structure (event type, required field name) — never a submitted value and never stored data. Consistent with req-006.

## Network Policy

- Daemon binds `127.0.0.1` only (server-http.ts:396) — no external interface. IPv6 loopback (`[::1]`) is intentionally not allow-listed and not bound; not a gap.
- No new ports, no egress introduced. Backup/checkpoint use the daemon's own already-open connection (no second connection to the DB file).

## Infrastructure as Code Review

Not applicable — no Terraform/Pulumi/CDK/CloudFormation in scope. The daemon is a local Node process.

---

## Findings by Severity

### Critical
None.

### High
None.

### Medium
- **M1 — Pre-existing dependency vulnerabilities.** `npm audit` reports 6 prod / 9 total (up to High). Not introduced by this feature and not on the daemon's request path, but should be cleared. *Fix:* `npm audit fix`; re-audit. Non-blocking.

### Low
- **L1 — `in` operator on the ceiling table traverses the prototype chain.** `validate-query.ts:63` `mode in QUERY_LIMIT_CEILINGS` returns `true` for `constructor` / `toString` / `__proto__`, resolving `ceiling` to a function/object. This **fails safe** — `isIntegerInRange(limit, 1, <non-number>)` returns `false`, so such a query is *rejected*, and dispatch never routes those modes to a builder anyway. Not exploitable. *Fix (hygiene):* use `Object.hasOwn(QUERY_LIMIT_CEILINGS, mode)` or a null-prototype map / `Map`.
- **L2 — Invalid `sortField`/`field`/`group_by` and missing-`session_id` throws map to 500, not 400.** These allow-list/shape violations throw generic `Error`s caught by `respondError`/`redactError`, returning a redacted 500 rather than a field-named 400 (req-009 acceptance wording). The **security properties hold**: injection is blocked before SQL is built and the offending value is redacted to stderr only. This is a status-code/UX conformance nit, not a vulnerability. *Fix (optional):* fold identifier-field validation into the gate to return 400 with a field name.

### Informational
- **I1 — Non-constant-time Host/Origin comparison** (`Array.includes`). No secret is compared (allowed authorities are public, port is discoverable), and the daemon is loopback-only, so there is no meaningful timing side-channel. Noted only; no action recommended.

---

## Risk Register Cross-Reference

The spec-stage risks (R-004 log-viewer `/query` still succeeds, R-006 Content-Length-only insufficiency, R-008 ephemeral-port test server, R-018 distinct_values clamp→reject behaviour change) are all addressed in the implementation as designed: the streaming counter satisfies R-006, `boundPort` satisfies R-008, and the per-mode ceiling table with reject-not-clamp satisfies R-018. No spec-stage risk remains open in code.

---

## Summary

**Overall risk rating: Low.**

The feature does what it set out to do. Each of the eight verification targets was traced to code and confirmed sound: the Host allow-list is exact-match and closes DNS rebinding; the Origin check closes CSRF with a correct absent-Origin asymmetry; the Content-Type parse resists the tab/trailing/duplicate-header bypasses; the body cap enforces at both points with a crash-safe `end` handler; error redaction leaks no engine/SQL/stored text on any of the three sites; the shared gate cannot be bypassed by NaN/coercion and resolves the per-mode ceiling correctly; and the allow-list is the *only* path to SQL identifier interpolation (verified by grep across all query builders). No new ReDoS, resource leak, or unhandled-rejection path was introduced.

**No Critical or High finding blocks the ship.**

Top actions before production:
1. **M1** — `npm audit fix` for the pre-existing dependency vulnerabilities (housekeeping, not introduced here).
2. **L1** — replace `mode in QUERY_LIMIT_CEILINGS` with `Object.hasOwn` / a `Map` (defensive hygiene; currently fails safe).
3. **L2** — optionally route identifier-field rejections through the gate so they return a field-named 400 instead of a redacted 500 (req-009 conformance polish).
