---
title: "Requirement: req-008 - Deploy Build-Identity Assertion"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-008 - Deploy Build-Identity Assertion

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Source:** US-001
**Priority:** must-have

## User Story

As an engineer deploying a fix, I want the deploy to fail loudly when the running daemon is not the build I just made, so that I never test against stale code believing it is current.

## Functional Requirements

- **Finding, confirmed against source:** `/health` currently returns only `{ ok: true, version: VERSION }` (`src/server-http.ts:91`), where `VERSION` is read from `package.json` (line 34). `scripts/service-macos.sh`'s `verify_service()` (lines 226-243) only checks that `curl -s "$HEALTH_ENDPOINT"` returns *any* successful response — it does not inspect the body at all, so it cannot distinguish an old process from a new one at the same version, which is exactly what happened on 2026-08-03. `scripts/service-manager.mjs`'s `deploy` action (lines 37-70) builds, then (on macOS/Linux) shells out to `service-{macos,linux}.sh restart` and forwards its exit code — it has no independent post-restart check of its own.
- Add a build-identity fingerprint: a SHA-256 hash of `server-http.bundle.mjs`'s built content, computed once at build time. Embed it into the running process (e.g. read the bundle's own hash at startup, or inject it as a generated constant during the build step) and expose it as a new, additive field on `/health`'s response — e.g. `{ ok: true, version: VERSION, buildId: "<hash>" }`. This is additive only; no existing `/health` consumer breaks.
- Lift the build-identity comparison into `scripts/service-manager.mjs`'s `deploy` action (decision B — preferably here rather than duplicated per platform script): after the platform restart script reports success, compute the hash of the just-built `server-http.bundle.mjs` on disk, fetch `/health`, and compare the returned `buildId` against the freshly-computed hash. Exit non-zero if they differ, printing both identities (the hash `deploy` just computed and the `buildId` `/health` returned) so the mismatch is legible, not just "deploy failed."
- This comparison must catch a same-version redeploy — i.e. it must not short-circuit on `version` matching alone. Compare `buildId` regardless of what `version` says.
- Windows' `deploy.ps1` path is separate code (service-manager.mjs line 50-56, delegates entirely to `deploy.ps1`) — decision B requires this same build-identity check to be added there too, not just on the macOS/Linux path this finding was grounded against.
- Handle the case where the running daemon predates this feature (reports no `buildId` field, per assumption A-004 in risk-register.md) — treat a missing `buildId` as "cannot compare" and degrade to a warning (not a false pass, not a hard failure) that recommends a manual restart to pick up an identity-reporting build.

## Acceptance Criteria

- [ ] Deploying a rebuilt daemon at the *same* `package.json` version as the previously running one is detected as a mismatch (different `buildId`), and `deploy` exits non-zero, naming both the newly-built hash and the previously-reported `buildId`
- [ ] Deploying an actually-new, successfully-restarted daemon whose `buildId` matches the just-built bundle's hash results in `deploy` exiting zero
- [ ] The check is exercised and passes on all three platform paths: macOS (`service-manager.mjs` → `service-macos.sh restart`), Linux (`service-manager.mjs` → `service-linux.sh restart`), and Windows (`deploy.ps1`)
- [ ] A daemon predating this feature (no `buildId` in its `/health` response) produces a warning, not a false "identities match" pass and not a hard failure that blocks deploy entirely
- [ ] `/health`'s existing `{ ok, version }` shape is unchanged for any consumer that does not read the new `buildId` field

## Dependencies

- Depends on req-009 (orphan port detection) sharing the same `deploy` code path in `scripts/service-manager.mjs` — implement both in a coordinated pass since they both extend the post-restart verification step.
- No dependency on req-004/005/006/007 — independent of the daemon-durability and backup work, per design.md's Waves note that 00019 (this story) is sequenced *first* specifically because until deploy is trustworthy, no other fix in this feature can be verified as actually running.
