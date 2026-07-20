# Feature: 0000012 — Test Harness and SDK Audit

**Version:** 0.10.2
**Date:** 2026-07-20
**Route:** Change Pipeline (precedent: `0000009-ship-phase-enum`, `0000011-defects-and-query-telemetry-fix`)
**Branch:** feat/0000012-test-harness-and-sdk-audit

Clears 2 of the 3 items filed to `plan/backlog/` during `0000011`. The third (Linux hardware verification, 00001) stays in the backlog — a Multipass VM setup hit host-level networking issues across 3 distinct attempts and is being investigated separately.

---

## What Changed

### `npm audit` advisory fix (was backlog 00003)

Simpler than the backlog entry anticipated: `@modelcontextprotocol/sdk` was already on latest (1.29.0, via the existing `^1.26.0` range) — no SDK bump needed. `npm audit fix` (no `--force`, no `package.json` changes) resolved all 5 advisories inherited transitively via `@hono/node-server`: `hono`, `fast-uri`, `ip-address`, `qs`, `express-rate-limit`. One residual Low-severity finding remains — `tsx`'s own nested `esbuild` (Windows dev-server only, dev-only dependency) — documented as an accepted risk in `quirks.md`, not re-filed to backlog given its narrow scope.

### bats test harness (was backlog 00002)

`scripts/service-macos.sh` and `scripts/service-linux.sh` both gained the standard "only run `main` when executed directly" sourcing guard (`if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then main "$@"; fi`) — zero behavioral change when run directly, but now `bats` can `source` them to unit-test individual functions without triggering real `launchctl`/`systemd` calls.

23 new tests: `tests/bats/service-macos.bats` (12 — `xml_escape()`, `resolve_node_path()`, `main()` dispatch) and `tests/bats/service-linux.bats` (11 — `resolve_repo_dir()`, `resolve_node_path()`, `check_systemctl()`, `main()` dispatch). Wired into `.github/workflows/ci.yml` as a new `bats` job running on `ubuntu-latest` + `macos-latest` (no node/npm setup needed — pure bash).

**Explicitly out of scope**, matching the original backlog entry: real `launchctl`/`systemd` install/uninstall against a live service. That remains manual or CI-matrix verification — the hardcoded macOS Homebrew fallback paths in `resolve_node_path()` and any real service-state mutation are not covered by this harness.

---

## Files Changed

| File | Change |
|---|---|
| `package-lock.json` | 5 transitive dependency advisories resolved via `npm audit fix` |
| `src/structured-telemetry-mcp/docs/quirks.md` | Residual Low-severity finding documented (`tsx`'s nested `esbuild`) |
| `scripts/service-macos.sh` | Sourcing guard added (no behavioral change when run directly) |
| `scripts/service-linux.sh` | Sourcing guard added (no behavioral change when run directly) |
| `tests/bats/service-macos.bats` | New — 12 tests |
| `tests/bats/service-linux.bats` | New — 11 tests |
| `.github/workflows/ci.yml` | New `bats` job (ubuntu-latest + macos-latest matrix) |
| `src/structured-telemetry-mcp/component.yml` | Version 0.10.1 → 0.10.2; scope/quality sections updated |

---

## Backlog Status

- **00001** (Linux hardware verification) — still open. Multipass VM setup on the macOS host failed to become network-reachable across 3 distinct attempts (fresh launch, graceful restart, force-stop+start, delete+recreate), each failing differently — pointing to a host-level issue rather than VM state. Left in `plan/backlog/`, not pulled into this feature. Human is investigating the host issue separately.
- **00002** (shell-script test harness) — **cleared**, see above.
- **00003** (SDK dependency advisories) — **cleared**, see above.

---

## Validation

324/324 Vitest tests + 23/23 bats tests passing, typecheck clean, build succeeds. No ADR required — neither change modifies an interface contract.
