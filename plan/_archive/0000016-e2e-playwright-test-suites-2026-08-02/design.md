# Design - 0000016-e2e-playwright-test-suites

## Feature
- Problem: The MCP server's HTTP surface (`/emit`, `/query`, `/health`) and the log-viewer UI (`GET /ui`) have only unit/integration coverage — no true black-box HTTP/browser-level regression coverage.
- Adoption mode: standard-iterative
- Feature ID: 0000016-e2e-playwright-test-suites
- Discovery: see `plan/current/discovery.md` (raw P0 findings — this document records confirmed decisions only)

## Product Layer
- User stories:
  - US-001: As a maintainer, I run the backend E2E suite against a real running server-http.ts instance, so that I know `/emit`, `/query`, and `/health` behave correctly over real HTTP, not just at the handler level.
  - US-002: As a maintainer, I run the UI E2E suite against a real browser driving the served `/ui` page, so that I know filtering, pagination, and the detail view actually work for a user, not just that the right HTML/JS is served.
- Acceptance criteria confirmed: 12 (see `plan/current/feature-brief.md`)
- Constraints: server remains 127.0.0.1-only, no auth added; no visual-regression tooling
- Integrations: none external — both suites test this repo's own existing HTTP/UI surface

## Architecture Layer
- Latency target: CI runtime p95 < 5 min for both suites combined
- Availability target: not applicable (test infrastructure, not a running service)
- Scalability target: not applicable
- Security: no auth (unchanged, existing NFR); E2E harness must not introduce new network exposure
- Data privacy: no regulated data — ephemeral per-run test DuckDB, not the dev/prod DB
- Observability: Playwright's built-in HTML/trace reporter on failure; 1 retry in CI, 0 locally
- Cost boundary: not constrained

## Engineering Layer
- Stack: TypeScript / Node >=20.19 / @playwright/test (new devDependency) / no frontend framework (testing existing vanilla-JS `/ui`, ADR-018 unchanged) / ephemeral DuckDB temp file / no ORM / no IaC / no cloud / local+CI compute / GitHub Actions (extend `.github/workflows/ci.yml` with a new `e2e` job — corrected at P3 from an initial `planifest.yml` assumption) / Build target: ci-only (also runnable locally)
- Components: structured-telemetry-mcp (existing, single component) — E2E suites are test additions under `tests/e2e/backend/` and `tests/e2e/ui/`, no new component
- Data ownership: structured-telemetry-mcp test harness owns the ephemeral per-run DuckDB (isolated, deleted after each run)
- Deployment: not applicable — suites run in CI/local dev only, nothing deployed
- API versioning: not applicable — tests consume the existing `/emit`, `/query`, `/health`, `/ui` surface unchanged

## Scope
- In: backend suite (`/emit` valid+invalid, `/query` filtering/pagination/sort, `/health`); UI suite (page load, filters+URL state, pagination, zero-result state, row-click detail expansion); Chromium-only; blocking CI check on every PR
- Out: MCP stdio interface, visual/screenshot regression, load/performance testing, auth flows, multi-browser matrix
- Deferred: nothing — scope above is complete

## Assumptions
- Chromium-only coverage is sufficient given the deliberately minimal vanilla-JS UI (ADR-018, no browser-specific behavior expected) - impact if wrong: cross-browser bugs ship undetected; add Firefox/WebKit projects later if this occurs
- `npx playwright install chromium --with-deps` fits within the 5-minute CI budget as a one-time build step - impact if wrong: NFR needs revisiting or browser install needs caching

## Risks
- Ephemeral server/port/DB startup adds per-run overhead that could threaten the 5-min NFR at scale - likelihood: low, impact: medium (mitigated by parallel test execution within Playwright)
- Playwright MCP conflated with @playwright/test by a future contributor, leading to confusion about what actually gates CI - likelihood: low, impact: low (mitigated by ADR at P2 explicitly separating the two roles)

## Dependencies
- Upstream: none — builds entirely on already-shipped `0000015` surface (server-http.ts, `/ui`, event_log query mode)
- Downstream: none anticipated

## Active Skills
- playwright (capability skill, installed permanently at `planifest-overrides/capability-skills/playwright/`) — Playwright browser verification workflow for user-journey evidence with deterministic replay artifacts

## Skill Map
| Requirement | Best-fit Skill | Rationale |
|-------------|----------------|-----------|
| US-001 - backend-e2e-suite | planifest-codegen-agent (+ playwright capability skill) | Standard TDD codegen loop for the suite; playwright capability skill supplies the verification/replay-artifact discipline |
| US-002 - ui-e2e-suite | planifest-codegen-agent (+ playwright capability skill) | Same — browser-driven suite against the existing vanilla-JS `/ui` |

## Repo Instructions

### Archiving Policy
All pipeline runs archive to `plan/_archive/{feature-id}-{YYYY-MM-DD}/` when they finish — no exceptions for route. This Change-Pipeline-gap-closing override applies retroactively and going forward; established 2026-07-23 after several Change Pipeline runs left permanent top-level `plan/{feature-id}/` folders. (This is a Feature Pipeline run, which already archives via the ship-agent's P7 step — the override is satisfied by default.)

### Framework Update Policy
Uncommitted changes under `planifest-framework/` are a dependency update, not a feature — commit them directly, do not route through the P0–P9 pipeline. `planifest-framework/` is vendored build tooling, not part of this repo's shipped product. Established 2026-08-01. Not applicable to this feature's own work (no framework-internal changes made), but the capability-skill installation above touched `planifest-overrides/` (product-side override config, not `planifest-framework/` itself) so this policy does not gate it either.

## Confirmation
Human confirmed this design before proceeding: yes // Date and Time confirmed: 02 Aug 2026 @ 04:53 PM BST
