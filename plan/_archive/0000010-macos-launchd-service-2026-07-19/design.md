# Design - 0000010-macos-launchd-service

## Feature
- Problem: (1) The telemetry backend (`server-http.bundle.mjs`) has no boot-surviving background-service option on macOS or Linux — only Windows has one (`scripts/service.ps1`), leaving developers to run it in a foreground terminal that dies on logout/reboot. (2) `emit_event`'s MCP tool argument has no structural schema (`z.unknown()`), so calling models have no scaffold to construct a valid envelope and silently fail with an opaque ajv error (`R-009`) — confirmed root-caused against this repo's live source, plus four framework-emitted event types (`loop_iteration`, `phase_reversal_petitioned`/`_granted`/`_denied`) are missing from the deployed schema entirely.
- Adoption mode: standard-iterative
- Feature ID: 0000010-macos-launchd-service
- Branch: feat/0000010-bckgrnd-srv-and-json-fix
- Release covers two bundled scopes (explicit human decision, overriding the RCA spec's own recommendation to ship separately — see `plan/current/build-log.md` for the full rationale): the macOS/Linux background service, and the `emit_event` envelope-rejection fix.

## Product Layer

### User Stories — Scope A: macOS + Linux Background Service
- US-001 (Phase 1, must-have): As a developer, I can run `npm run service:install` on macOS, so that the telemetry backend starts on login and restarts on crash.
- US-002 (Phase 1, must-have): As a developer, I can run `service:uninstall`/`status`/`restart` on macOS, so that I can manage the service the same way I already can on Windows.
- US-003 (Phase 1, must-have): As a developer whose `~/Library/LaunchAgents` is locked to root ownership (confirmed on a real machine), I get a clear error and a sudo-based fallback, so that setup doesn't fail silently.
- US-004 (Phase 1, should-have): As a developer following `getting-started.md`/`mac-setup.md`, I see the macOS service option documented alongside Windows.
- US-005 (Phase 2, must-have): As a developer, I can run `npm run service:install` on Linux, so that the backend starts on login and restarts on crash.
- US-006 (Phase 2, must-have): As a developer, I can run `service:uninstall`/`status`/`restart` on Linux, mirroring macOS/Windows.
- US-007 (Phase 2, must-have): As a developer on a headless/minimal box where `systemd --user` doesn't linger past logout, I get a clear explanation and the `loginctl enable-linger` fallback command.
- US-008 (Phase 2, should-have): As a developer, I see the Linux service option documented alongside Windows and macOS.

### User Stories — Scope B: emit_event Envelope Fix
- US-009 (must-have): As a Planifest agent calling `emit_event`, I get a real object-shaped tool schema (not `z.unknown()`), so a tool-calling model has a structural scaffold instead of guessing and serializing the envelope to a string.
- US-010 (must-have): As a Planifest agent, a malformed call (stringified/undefined/null/array/double-wrapped envelope) fails with a specific, self-diagnosable Zod error instead of ajv's opaque `"(root): must be object"`.
- US-011 (must-have): As `planifest-loop-runner`/reversal-protocol code (framework feature 0000016), I can emit `loop_iteration`, `phase_reversal_petitioned`, `phase_reversal_granted`, `phase_reversal_denied` and have them accepted — these four types are live in the framework but missing from this repo's deployed schema.
- US-012 (should-have): As a developer reading the tool's argument, I no longer confuse the tool parameter `event` with the envelope's own `event` discriminator field (renamed to `envelope`).

- Acceptance criteria confirmed: 8 (Scope A, from `feature-brief.md` Acceptance Criteria) + 8 (Scope B, from `emit-event-rca-and-fix-spec.md` §7 Definition of Done) = 16
- Constraints: Scope A — must not require sudo/root for the common case on either platform (sudo is an explicit fallback only); macOS must use `gui/$(id -u)` domain via `launchctl bootstrap`, not deprecated `launchctl load -w`; Linux must use `systemctl --user`, never a system-wide unit, and must detect+fail cleanly if `systemctl` is absent; node path must be resolved dynamically on both platforms, never hardcoded. Scope B — additive-only schema change (no migration file); `EVENT_REQUIRED_DATA_FIELDS`, schema `$defs`, and schema `event` enum must stay in sync for all 25 types; do not silently `JSON.parse()` a string argument as a fallback (masks the real client bug).
- Integrations: Scope A — none beyond the existing backend entrypoint (same CLI, no protocol change). Scope B — `planifest-framework`'s `planifest-loop-runner` skill (sibling repo, consumer of the four new event types).

## Architecture Layer
- Latency target: Scope A — n/a (install-time scripts, not a request path). Scope B — inherits existing `emit_event` p95 < 5ms target (schema validation added is in-process, not a network hop); unchanged.
- Availability target: Scope A — service auto-restarts on crash (`KeepAlive.SuccessfulExit: false` / `Restart=on-failure`), does not restart-loop on intentional stop. Scope B — n/a.
- Scalability target: unchanged from existing (DuckDB store, local process).
- Security: no auth — backend remains bound to `127.0.0.1`, no network exposure introduced by either scope (carried forward from 0000008's established posture, still valid). No authz model required. Data classification: internal dev/pipeline metadata (file paths, agent names, phase names, loop/reversal identifiers) — not PII, not regulated. The Scope B schema-argument fix is a *contract-clarity and input-validation* improvement (rejects malformed input earlier, with a clearer error), not a new security boundary.
- Data privacy: no regulated data; unchanged.
- Observability: this feature *is* an observability-pipeline fix (Scope B) plus ops tooling for the observability backend itself (Scope A) — no new logging/metrics/tracing strategy needed beyond existing stdout/log-file conventions (macOS: `~/Library/Logs/`; Linux: `journalctl --user` + optional file under `~/.local/state/`).
- Cost boundary: not constrained (local tool, no cloud costs).

## Engineering Layer
- Stack: Scope A — Bash (install scripts) + XML plist (macOS) + systemd unit file (Linux); Node runtime (already required); macOS `launchd` user LaunchAgent / Linux `systemd --user`; manual testing (`launchctl list`/`systemctl --user status` + `/health` curl + reboot/logout survival); build target: local. Scope B — TypeScript + Zod (tool argument schema) + existing ajv/JSON-Schema validation layer (`src/validation/validate-event.ts`); Vitest (existing test convention: `tests/unit/`, `tests/integration/`, `tests/regression/`).
- Components: `structured-telemetry-mcp` (existing, single component) — owns both the backend process (Scope A's install target) and the `emit_event`/`query_telemetry` MCP tools + schema (Scope B).
- Data ownership: unchanged — `structured-telemetry-mcp` owns all telemetry events (single DuckDB store). Neither scope changes data ownership.
- Deployment: Scope A adds macOS/Linux user-scoped service deployment alongside the existing Windows (`nssm`-based) and npm-start paths — no new deployment target, just new supervisors for the same process. Scope B — no deployment change, same MCP stdio/HTTP server.
- API versioning: Scope B is additive-but-contract-changing for the `emit_event` tool argument shape (wire-compatible callers sending correct objects are unaffected; callers relying on the old permissive `z.unknown()` are not, though none are known to exist) — reflected in the confirmed 0.10.0 version bump. Event schema itself stays additive-only (`schema_version: "1.0"` unchanged).

## Scope

### In
- Scope A: launchd install/uninstall/status/restart scripts (Phase 1), systemd equivalents (Phase 2), locked-`LaunchAgents` detection + sudo fallback, lingering detection + remediation guidance, docs updates to `getting-started.md`/`mac-setup.md`.
- Scope B: `EmitEventEnvelope` Zod schema replacing `z.unknown()`; tool argument rename `event` → `envelope`; four new event types (`loop_iteration`, `phase_reversal_petitioned`, `phase_reversal_granted`, `phase_reversal_denied`) added to schema `$defs`, enum, and `EVENT_REQUIRED_DATA_FIELDS`; full regression/integration test coverage per the RCA spec §5; README + `docs/usage-guide.md` updates; an ADR for the tool-argument schema redesign.
- Both: `package.json` version drift fix; `component.yml`/`product.yml` as the enforced version source going forward.

### Out
- A system-level (root) launchd daemon or root-level systemd unit — user-scoped only.
- Changing the backend's default port (3741) or DB location (`~/.planifest/telemetry.db`).
- Distro-specific packaging (`.deb`/`.rpm`).
- `ratchet_blocked` event type (recommended in framework's REC-006 but not yet emitted by any skill — speculative scope, explicitly deferred by the RCA spec).
- Re-running the framework-side (`planifest-framework`) verification that `phase_start`/`phase_end`/`loop_iteration` land correctly post-deploy — that's a follow-up step in the sibling repo, out of scope for this repo's pipeline run.

### Deferred
- Auto-detecting and fixing a root-owned `~/Library/LaunchAgents` automatically — deferred to "clear error + manual sudo remediation," blocked until a human confirms overriding a possible MDM control is safe.
- Auto-enabling lingering (`loginctl enable-linger`) without asking — deferred to "explain + print the exact command," blocked until a human decides that system-wide account setting change is acceptable on a given machine.

## Assumptions
- The backend continues to read `PLANIFEST_MCP_PORT` (default 3741) / `PLANIFEST_TELEMETRY_DB` (default `~/.planifest/telemetry.db`) — impact if wrong: unit/plist files need an env override block added.
- Phase 2 (Linux) targets systemd-based distros — impact if wrong (non-systemd, e.g. Alpine/OpenRC): script's own `command -v systemctl` check fails cleanly rather than silently misbehaving; no fallback init system is built this pass.
- No known caller currently sends `emit_event`'s argument as anything other than a plain object — impact if wrong: the new Zod gate would start rejecting a previously-"working" (by accident) caller; mitigated by shipping through this repo's own P4/P5 validation before release.

## Risks
- macOS: `~/Library/LaunchAgents` root-owned by MDM/endpoint-security policy (likelihood: medium — already observed on one real dev machine; impact: medium — install fails without the sudo fallback path; mitigation: pre-flight write-test + clear explanation + sudo fallback, already an acceptance criterion).
- Linux: systemd unit file design is entirely untested on real hardware — `linux-systemd-reference.md` is explicitly marked speculative (likelihood: medium; impact: medium — Phase 2 acceptance criteria could fail during codegen/validate; mitigation: verify on at least one real systemd distro before shipping Phase 2, already an acceptance criterion).
- Linux: lingering disabled is a common default on headless/dev boxes, causing silent service death on SSH logout (likelihood: medium; impact: medium — surprising failure mode if undetected; mitigation: post-install lingering check + explicit warning with remediation command, already an acceptance criterion).
- Scope B: the three enforcement points (Zod tool-argument enum, ajv schema `$defs`/enum, `EVENT_REQUIRED_DATA_FIELDS`) can drift out of sync if not updated together in one pass (likelihood: low — explicit step-by-step in the RCA spec's §4.3 and Definition of Done; impact: high — would silently re-break telemetry for a subset of event types, the exact failure mode this fix exists to close; mitigation: single PR lands all three together; integration test asserts all 25 types round-trip end-to-end).
- Version-manifest drift recurrence (`package.json` vs `component.yml` vs git tags) — already caught once this session (likelihood: low once corrected; impact: low, cosmetic/confusing rather than functional; mitigation: `component.yml`/`product.yml` established as the enforced source of truth this pass; `package.json` synced to match at ship time).

## Dependencies
- Upstream: existing `server-http.bundle.mjs` CLI entrypoint (Scope A); `@modelcontextprotocol/sdk`, `zod`, `ajv` (Scope B, all already project dependencies).
- Downstream: `planifest-framework`'s `planifest-loop-runner` and phase-reversal protocol (sibling repo, feature `0000016-pipeline-governance-and-loop-engineering`) — consumes the four new event types from Scope B; a follow-up verification step in that repo (out of scope here, see Scope › Out) closes the loop once this ships.

## Active Skills
None — no capability skills installed for this run (Bash/plist/systemd scripting and TypeScript/Zod schema work are both covered by the standard Planifest codegen-agent; no relevant capability skill identified for either stack at Skill Discovery).

## Skill Map
| Requirement | Best-fit Skill | Rationale |
|-------------|----------------|-----------|
| US-001–US-008 (Scope A: service install/uninstall/status/restart, both platforms) | planifest-codegen-agent | Bash script + plist/unit-file generation, no novel architectural decisions beyond what's already in the reference docs |
| US-003, US-007 (locked-dir / lingering detection + fallback UX) | planifest-codegen-agent | Same component, error-path logic — part of the same install-script implementation |
| US-004, US-008 (docs) | planifest-docs-agent | Living documentation updates to `getting-started.md`/`mac-setup.md` |
| US-009, US-010, US-012 (Scope B: Zod tool-argument schema, arg rename) | planifest-codegen-agent | TypeScript schema/handler change with a defined target shape from the RCA spec |
| US-011 (Scope B: 4 new event types across schema/enum/required-fields) | planifest-codegen-agent | Mechanical, well-specified schema extension (RCA spec §4.3) |
| Tool-argument schema redesign decision | planifest-adr-agent | RCA spec §6.4 explicitly calls for an ADR — real architectural decision with alternatives (Zod gate vs. relying on ajv alone) |
| Full test suite (regression/unit/integration per RCA spec §5) | planifest-codegen-agent (via planifest-test-writer/planifest-implementer sub-agents) | TDD cycle per requirement, following this repo's existing `tests/regression|unit|integration` convention |
| Security posture re-confirmation (no new auth surface) | planifest-security-agent | Standard P5 review — carried-forward posture should be re-verified, not just assumed, given Scope B changes a public tool contract |

## Repo Instructions
None — `planifest-overrides/instructions/` does not exist in this repo.

## Confirmation
Human confirmed this design before proceeding: yes
Date confirmed: 12 Jul 2026
