# Security Report - 0000016-e2e-playwright-test-suites

## Threat Model (STRIDE)

| Threat | Category | Severity | Mitigation |
|---|---|---|---|
| E2E harness binds the ephemeral test server to a non-loopback address (e.g. `0.0.0.0`), exposing it beyond the local machine during test runs | Info Disclosure / Elevation | Medium | Not applicable — `server-http.ts`'s `server.listen(PORT, '127.0.0.1', ...)` call is unchanged by this feature; the harness only sets `PLANIFEST_MCP_PORT=0` (port selection) via env var, never the bind address. Confirmed by code review: no code path in `tests/e2e/support/server-harness.ts` or the small `server-http.ts` diff touches the bind address. R-005 (risk register) closed. |
| Ephemeral port collision across parallel test workers if a hardcoded port were used instead of OS-assigned | DoS (test flakiness, not a production threat) | Low | Mitigated — `PLANIFEST_MCP_PORT=0` is always used (`server-harness.ts`), letting the OS assign a free port; the actual port is read back from `server.address().port` via the modified ready-log line. Never hardcoded. R-002 (risk register) closed. |
| Command injection via the child-process spawn in `server-harness.ts` | Tampering | Low | Not exploitable — `spawn(TSX_BIN, ['src/server-http.ts'], {...})` uses fixed, hardcoded constants for both the binary path and the single argument; no string concatenation, no shell (`spawn` without `shell: true`), no user- or network-derived input reaches the command line. |
| Fixture-seeding helper (`fixtures.ts`) sends attacker-controlled data into `/emit` | Tampering | Low | Not applicable — all fixture data is hardcoded in `buildFixtureSet()`/`buildEnvelope()`, generated at test-authoring time, never derived from external/network input. Exercises the same existing `validateEvent()` path every other `/emit` caller goes through — no new validation bypass introduced. |
| Ephemeral temp DuckDB file leaks test data or is left behind after a crashed test run | Info Disclosure | Low | Low impact — test fixture data only (synthetic session IDs, no real credentials/PII), written to the OS temp directory (`mkdtempSync`) which is world-readable-by-owner-only by default on the platforms this project targets. `stop()` removes the directory; a crash before `stop()` leaves an orphaned temp dir with synthetic data only, cleaned up by normal OS temp-directory housekeeping or CI runner teardown. No new class of exposure versus the existing `tests/integration/*.test.ts` pattern, which already uses the same `tmpdir()` approach for its own temp DBs. |
| A future CI job accidentally invokes the Playwright MCP server instead of `@playwright/test`, changing the trust boundary of what runs in CI | Elevation | Low | Mitigated by ADR-021's explicit documentation of the authoring-only boundary; no MCP server configuration exists in this repo's CI workflow or `playwright.config.ts` — there is nothing in the shipped artifact for a future change to accidentally invoke. Documentation-level mitigation, not a code-level control; residual risk R-003 (risk register) remains open by design, tracked. |

## Dependency Audit

`npm audit` (full, including devDependencies) reports 4 advisories, none introduced by this feature's new dependency (`@playwright/test`):

- `@hono/node-server` (moderate, transitive via `@modelcontextprotocol/sdk`) — pre-existing, tracked in `component.yml` risk items since `0000008c`.
- `body-parser` (low, transitive via `@modelcontextprotocol/sdk`) — pre-existing.
- `esbuild` (low, transitive via `tsx`'s nested dependency, Windows dev-server only) — pre-existing, explicitly accepted in `docs/quirks.md` under `0000012-test-harness-and-sdk-audit` (Windows-only, dev-only, narrow blast radius).

`@playwright/test` itself: zero advisories. Version pinned to `^1.62.1` (latest stable at scaffold time), consistent with the version policy. No new entries added to the dependency-audit surface by this feature.

## Secrets Management

No secrets are introduced, read, or handled by this feature. Fixture data (`tests/e2e/support/fixtures.ts`) is entirely synthetic (fake session IDs, fake product paths like `/repo/product-a`) — no real paths, tokens, or credentials. The ephemeral DB path and port are the only "configuration" involved, both generated locally at test-run time, never persisted or logged beyond the OS temp directory.

## Authentication & Authorisation Review

Not applicable — no API endpoints were added or modified by this feature (it adds test coverage for the existing `/emit`, `/query`, `/health`, `/ui` surface). The existing no-auth, 127.0.0.1-only posture (documented in `component.yml` exceptions: `"Does not authenticate callers"`) is unchanged and is exercised, not altered, by the new suites.

## Input Validation Review

No new input-accepting code paths were added. The E2E suites are **callers** of the existing `/emit` and `/query` endpoints, which retain their existing validation (`validateEvent()` via AJV for `/emit`; the existing query-parameter handling for `/query`). The one negative-path test added (`POST /emit rejects a schema-invalid envelope`) specifically exercises and confirms the existing validation still rejects malformed input — a net positive for input-validation confidence, not a new risk surface.

## Network Policy

No change to the production network policy. The server under test binds `127.0.0.1` only, on either the fixed default port (`3741`, unchanged production behavior) or an OS-assigned ephemeral port when `PLANIFEST_MCP_PORT=0` is explicitly set (test-only usage). No new listen address, no new port opened to a non-loopback interface, no new outbound network calls (fixture seeding is `fetch()` to `127.0.0.1` only). CI's new `e2e` job (`.github/workflows/ci.yml`) runs entirely within the GitHub Actions runner's own sandboxed network — no new external network dependency beyond the existing Chromium binary download (cached, from Playwright's own CDN, same trust level as any other CI toolchain download already in this pipeline, e.g. `npm ci`).

## Infrastructure as Code Review

Not applicable — no IaC files exist or were added by this feature (stack declares `iac: none`).

## Summary

**Overall risk rating: Low**

No critical, high, or medium findings. All identified threats are either not applicable to the actual implementation (verified by direct code review, not assumption) or already mitigated by construction (OS-assigned ports, unchanged bind address, hardcoded spawn arguments, synthetic-only fixture data).

Top actions before production: none required. For completeness/future tracking:
1. Keep R-003 (risk register — Playwright MCP/`@playwright/test` conflation) in view if this project's CI workflow is ever restructured by someone unfamiliar with ADR-021.
2. No action needed on the 4 pre-existing `npm audit` advisories — already tracked and accepted in `docs/quirks.md`/`component.yml`; unaffected by this feature.
3. No action needed on ephemeral temp-DB cleanup — synthetic data only, existing OS temp-directory conventions already relied upon elsewhere in this codebase (`tests/integration/*.test.ts`).
