# Change Summary

**Feature:** 0000012-test-harness-and-sdk-audit
**Route:** Change Pipeline (precedent: 0000009-ship-phase-enum, 0000011-defects-and-query-telemetry-fix)

Change request: "next release. clear the backlog." Human confirmed pulling in backlog items 00002 (shell-script test harness) and 00003 (SDK transitive dependency advisories) during P0 coaching. Item 00001 (Linux hardware verification) was attempted via a Multipass VM but hit host-level networking issues across 3 distinct attempts (fresh launch, graceful restart, force-stop+start, delete+recreate) — left in the backlog, not pulled into this feature, pending the human's separate investigation of the host issue.

Interpretation: two independent, self-contained changes to the single existing component. Neither modifies an interface contract, so no ADR was required (change-agent's own rule: ADRs are for interface-contract changes; test infrastructure and dependency patching are not).

Components affected: `structured-telemetry-mcp` (only component in this repo)

Contract changed: no
Schema changed: no
Migration proposed: no
Consumers affected: none
Blast radius: single component, no dependency-graph fan-out

## What was actually built

1. **npm audit advisory fix (was backlog 00003).** Turned out simpler than the backlog entry anticipated — no `@modelcontextprotocol/sdk` bump was needed (already on latest, 1.29.0, via the existing `^1.26.0` range). `npm audit fix` (no `--force`, no `package.json` changes, pure lockfile-level transitive bumps) resolved all 5 advisories: `hono`, `fast-uri`, `ip-address`, `qs`, `express-rate-limit`. One residual Low-severity, dev-only finding (`tsx`'s nested `esbuild`, Windows dev-server only) documented as an accepted risk in `quirks.md` — not re-filed to backlog given its narrow scope.

2. **bats test harness (was backlog 00002).** Both service scripts (`service-macos.sh`, `service-linux.sh`) gained the standard "only run main when executed directly" sourcing guard, enabling `bats` to source them and unit-test individual functions without triggering real `launchctl`/`systemd` calls. 23 new tests across `tests/bats/service-macos.bats` (12) and `tests/bats/service-linux.bats` (11), covering: `xml_escape()`, path resolution (`resolve_node_path`, `resolve_repo_dir`), `systemctl`/`node` detection, and `main()` argument dispatch. Wired into `.github/workflows/ci.yml` as a new `bats` job (ubuntu-latest + macos-latest, no node/npm dependency). Real install/uninstall against a live service remains manual/CI-matrix verification — explicitly out of scope per the original backlog entry, consistent with `0000010`'s declared testing strategy for these scripts.

## Rollback

Both changes are independently revertable via `git revert` with no data/schema implications. The `npm audit fix` commit only touches `package-lock.json` (no `package.json` changes) — reverting it simply restores the prior resolved versions. The bats harness commit only adds new files plus a no-op-at-runtime sourcing guard to the two scripts — reverting removes the guard and the new test files with zero behavioral impact on the scripts themselves.
