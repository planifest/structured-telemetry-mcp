# Changelog — 0000010-macos-launchd-service — 19 Jul 2026

**Feature:** macOS + Linux Background Service + emit_event Envelope Fix (bundled scope)
**Pipeline run:** P0 Assess → P1 Spec → P2 ADRs → P3 Codegen → P4 Validate → P5 Security → P6 Docs → P7 Archive (P8/P9 to follow)
**PR:** pending — updated after PR is raised in Step 9

## What Was Built

Two bundled scopes, by explicit human decision (see `build-log.md`'s P0 entry for the full rationale):

1. **macOS + Linux background service.** The telemetry backend previously only had a boot-surviving service option on Windows (`nssm`). Adds `scripts/service-macos.sh` (user-scoped `launchd` LaunchAgent) and `scripts/service-linux.sh` (user-scoped `systemd --user` unit), both reachable via the same `npm run service:install|uninstall|status|restart` surface through a new cross-platform dispatcher, `scripts/service-manager.mjs`. Neither script escalates privileges or changes persistent account settings silently — both detect known failure modes (locked `~/Library/LaunchAgents`, disabled `systemd` lingering) and print exact remediation commands for the human to run themselves.

2. **`emit_event` envelope-rejection fix (R-009).** Root-caused by a sibling-repo (`planifest-framework`) investigation: the `emit_event` MCP tool argument was `z.unknown()`, giving calling models no structural schema — a common tool-calling failure mode was serializing the envelope to a string, which then failed with an opaque ajv error. Fixed by replacing the argument with a real `EmitEventEnvelope` Zod object schema and renaming the argument `event`→`envelope` (resolving a name collision with the envelope's own `event` discriminator field). Also adds 4 event types (`loop_iteration`, `phase_reversal_petitioned`/`_granted`/`_denied`) that `planifest-framework` already emits but this repo's schema was missing.

## Artifacts Produced

- `plan/current/design.md` — confirmed P0 design (standard-iterative, version 0.10.0)
- 12 requirement files (`req-001`–`req-012`), `scope.md`, `risk-register.md` (7 risks, 3 assumptions), `domain-glossary.md` (10 terms), `execution-plan.md`, `operational-model.md`, `slo-definitions.md`, `cost-model.md`
- `adr/ADR-013-emit-event-tool-argument-schema.md`, `adr/ADR-014-macos-linux-service-supervision.md`
- `security-report.md` — Low risk, 0 critical/high/medium findings
- `recommendations.md` — 7 items for future iterations
- 5 living docs at `docs/` (component-registry, dependency-graph, architecture-overview, decisions-index, api-index) — backfilled, none existed before this feature across 3 prior pipeline runs
- `docs/0000010--feature--macos-linux-service-and-emit-event-fix.md`
- 6 new per-component docs at `src/structured-telemetry-mcp/docs/` (purpose, interface-contract, dependencies, risk, scope, test-coverage) plus updates to the pre-existing `data-contract.md`, `quirks.md`, `tech-debt.md`

## Decisions

- **ADR-013:** `emit_event`'s tool argument gets a real Zod object schema (`EmitEventEnvelope`); argument renamed `event`→`envelope`. Related to, does not supersede, ADR-005 (JSON Schema/ajv remains the wire-validation source of truth).
- **ADR-014:** Background service supervision is always user-scoped (never a root daemon on either platform), and never silently escalates privileges or changes persistent account settings.

## Skipped Phases

None.
