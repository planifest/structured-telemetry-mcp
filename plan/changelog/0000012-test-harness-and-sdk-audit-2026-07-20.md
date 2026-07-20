# Changelog — 0000012-test-harness-and-sdk-audit — 20 Jul 2026

**Feature:** Test Harness and SDK Audit
**Pipeline run:** Change Pipeline (precedent: `0000009-ship-phase-enum`, `0000011-defects-and-query-telemetry-fix`)
**PR:** pending — updated after PR is raised

## What Was Built

Clears 2 of 3 items filed to `plan/backlog/` during `0000011`:

1. **`npm audit` advisory fix.** All 5 advisories (`hono`, `fast-uri`, `ip-address`, `qs`, `express-rate-limit` — transitive via `@modelcontextprotocol/sdk`'s `@hono/node-server` dependency) resolved via `npm audit fix` (no `--force`, no `package.json` changes). Turned out not to need an SDK bump — already on latest.
2. **bats test harness** for `scripts/service-macos.sh` and `scripts/service-linux.sh` — 23 tests covering pure-logic paths (argument dispatch, path resolution, `xml_escape()`, `systemctl`/`node` detection). Wired into `.github/workflows/ci.yml`.

Item 00001 (Linux hardware verification) stays in the backlog — attempted via a Multipass VM but hit host-level networking issues across 3 attempts. Not pulled into this feature.

## Artifacts Produced

- `plan/current/change-summary.md`
- `docs/0000012--feature--test-harness-and-sdk-audit.md`
- `tests/bats/service-macos.bats`, `tests/bats/service-linux.bats`
- Updated: `.github/workflows/ci.yml`, `component.yml`, `product.yml`, `package.json`, `package-lock.json`, `src/structured-telemetry-mcp/docs/quirks.md`

## Decisions

None requiring a new ADR — neither change modifies an interface contract.

## Validation

324/324 Vitest tests, 23/23 bats tests, typecheck clean, build succeeds.

## Skipped Phases

None. (Full P1/P2/P5 artifact sets don't apply to Change Pipeline runs — see `0000011`'s changelog for the routing rationale, unchanged here.)
