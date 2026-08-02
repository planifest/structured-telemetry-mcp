---
title: "ADR 022: Ephemeral Real-Server-Process + Temp-DuckDB Test Harness"
summary: "Both E2E suites spin up a real server-http.ts child process against a fresh temp-file DuckDB on an OS-assigned ephemeral port per run, rather than testing against handlers directly or a shared long-lived instance."
status: "accepted"
version: "0.1.0"
---
# ADR-022 - Ephemeral Real-Server-Process + Temp-DuckDB Test Harness

**Skill:** [adr-agent](../skills/planifest-adr-agent/SKILL.md)
**Feature:** 0000016-e2e-playwright-test-suites
**Component:** structured-telemetry-mcp
**Date:** 2026-08-02

## Context

All existing tests in this project (Vitest unit/integration) exercise `server-http.ts`'s route logic via its exported handler functions, not by starting a real listening process (`component.yml` quirks: "server-http.ts has no HTTP-level test coverage anywhere in this project"). This feature's entire purpose is true black-box coverage — catching regressions in real request/response behavior and real browser rendering, which handler-level testing structurally cannot do (see the log-viewer UI's `REC-002` recommendation from `0000015`, filed for exactly this gap). A decision on how the suites stand up their system-under-test was required: reuse a shared dev instance, run against handlers, or spin up a genuinely real, isolated instance per run.

## Decision

Each E2E suite starts a real `server-http.ts` process via `child_process`, bound to `127.0.0.1` on an OS-assigned ephemeral port (`port: 0`, actual port read back after bind — never hardcoded, per R-002), pointed at a fresh temp-file DuckDB created for that run. Both are torn down after the run. No suite depends on a developer's already-running dev server, and no suite imports server-side handler functions directly — every assertion goes over the wire (real HTTP for the backend suite, a real Chromium browser for the UI suite).

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Test against exported handler functions (existing project convention) | Fastest, matches existing Vitest patterns, no process/port management | Cannot catch real HTTP-layer or real-browser-rendering regressions — the entire reason this feature exists | Rejected — defeats the purpose of an E2E suite |
| Require a developer/CI to have a dev server already running, suites just connect to it | Simple harness code | Not CI-friendly (nothing guarantees a server is running in a fresh CI runner), and shared state between test runs risks flaky/order-dependent tests | Rejected — incompatible with "blocking check on every PR" in a clean CI runner |
| One shared long-lived server + shared DuckDB for the whole suite run, with per-test data cleanup | Faster suite startup (one process, not N) | Cross-test data leakage risk if cleanup is imperfect; harder to run suites in parallel; couples test isolation correctness to cleanup logic instead of process boundaries | Rejected for now — the ephemeral-per-run pattern is simpler to reason about and isolation-safe by construction; revisit only if NFR-001 (5-min CI budget) is threatened by startup overhead (see A-003, R-001) |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | New test-harness code under `tests/e2e/` (process spawn/teardown, ephemeral DB provisioning); no change to `server-http.ts` itself or production behavior |

## Consequences

**Positive:**
- Genuine black-box coverage — a regression in real HTTP handling or real browser rendering is caught, not just a regression in handler logic
- Perfect isolation between runs by construction (fresh process, fresh port, fresh DB) — safe for parallel CI execution, no test-ordering dependencies

**Negative:**
- Slower than handler-level tests — real process startup/teardown overhead per run
- New harness code to maintain (spawn, health-check-wait, teardown, temp-file cleanup) that doesn't exist elsewhere in the project

**Risks:**
- Startup overhead could threaten the 5-min CI budget as suites grow (R-001, mitigated by A-003's fallback plan)
- Port/bind mistakes could introduce test flakiness (R-002) or accidental network exposure (R-005) if the harness is implemented carelessly — both called out explicitly as review/verification items at P4/P5

## Related ADRs

- ADR-020 - depends-on (this harness runs inside `@playwright/test`'s fixture model)

## Supersedes

- None

## Superseded By

- None
