# Feature: 0000010 — macOS/Linux Background Service + emit_event Envelope Fix

**Version:** 0.10.0
**Date:** 2026-07-19
**Branch:** feat/0000010-bckgrnd-srv-and-json-fix

Bundled scope, by explicit human decision: the macOS/Linux background service (originally scoped) plus the `emit_event` envelope-rejection fix (R-009), a candidate surfaced mid-flight by a sibling-repo investigation. See `plan/current/build-log.md` for the full rationale.

---

## What Changed

### macOS/Linux background service (req-001–008)

The telemetry backend (`server-http.bundle.mjs`) previously only had a boot-surviving background-service option on Windows (`scripts/service.ps1`, via `nssm`). This feature adds equivalents for macOS and Linux, all reachable through the same `npm run service:install|uninstall|status|restart` command surface (ADR-014):

- **macOS** (`scripts/service-macos.sh`): a user LaunchAgent (`~/Library/LaunchAgents/com.planifest.telemetry-mcp.plist`), loaded via `launchctl bootstrap`/`enable` in the `gui/$(id -u)` domain — never the deprecated `launchctl load -w`, never a system-wide LaunchDaemon. Detects a locked `~/Library/LaunchAgents` (seen on a real dev machine, likely MDM/endpoint-security policy) and prints exact `sudo` remediation commands rather than escalating silently.
- **Linux** (`scripts/service-linux.sh`): a `systemd --user` unit (`~/.config/systemd/user/planifest-telemetry-mcp.service`), never a system-wide unit. Detects a missing `systemctl` and fails cleanly. Detects disabled session lingering and warns with the exact `loginctl enable-linger` remediation command — **untested against real systemd hardware** (no Linux machine was available during implementation; tracked as risk-register R-002).
- **`scripts/service-manager.mjs`**: a small cross-platform dispatcher so `npm run service:*` picks the right platform script automatically.

### emit_event envelope-rejection fix (req-009–012, R-009)

Root-caused by a sibling-repo (`planifest-framework`) investigation: `emit_event`'s tool argument was `z.unknown()`, giving calling models zero structural information — a common tool-calling failure mode was a model serializing the envelope to a string, which ajv then rejected with an opaque `"(root): must be object"`. Separately, four event types the framework actually emits (`loop_iteration`, `phase_reversal_petitioned`, `phase_reversal_granted`, `phase_reversal_denied`) were missing from the deployed schema entirely.

Fixed (ADR-013):
- `emit_event`'s tool argument replaced with a real `EmitEventEnvelope` Zod object schema mirroring the JSON Schema envelope shape — gives calling models a structural scaffold; rejects malformed shapes with a specific error before ajv ever runs.
- Tool argument renamed `event` → `envelope`, resolving a name collision with the envelope's own `event` discriminator field (this is the intentional breaking change behind the 0.10.0 version bump).
- Four new event types added to the schema, `EVENT_REQUIRED_DATA_FIELDS`, and the Zod enum, all landed together to avoid the three enforcement points drifting out of sync.
- `ajv`/JSON Schema remains the source of truth for the `data` payload (ADR-005 unchanged) — Zod is an argument-shape gate only.

---

## Files Changed

| File | Change |
|---|---|
| `scripts/service-macos.sh` | New — macOS launchd install/uninstall/status/restart |
| `scripts/service-linux.sh` | New — Linux systemd --user install/uninstall/status/restart |
| `scripts/service-manager.mjs` | New — cross-platform `npm run service:*` dispatcher |
| `package.json` | `service:*` scripts repointed to `service-manager.mjs` |
| `schemas/telemetry-event.schema.json` | 4 new event enum values; 4 new `$defs`; added to `data.anyOf` |
| `src/types/events.ts` | 4 new `EventType` union members; 4 new interfaces; added to `EventData` union |
| `src/validation/validate-event.ts` | 4 new entries in `EVENT_REQUIRED_DATA_FIELDS` |
| `src/server-factory.ts` | `EmitEventEnvelope` Zod schema (exported); `emit_event` argument `event`→`envelope`; Zod shape-gate before `validateEvent()` |
| `tests/unit/server-factory.test.ts` | `envelope` rename across existing cases; new `EmitEventEnvelope` shape-introspection test |
| `tests/regression/emit-handler.test.ts` | `envelope` rename; 6 RCA reproduction cases (A–F) + old-shape rejection test |
| `tests/regression/event-types.test.ts` | 4 new event types, valid-payload cases |
| `tests/regression/cross-field-validation.test.ts` | 4 new event types, missing-required-field cases |
| `tests/integration/emit-event.test.ts` | New: all 25 event types round-trip through the real MCP handler |
| `README.md` | `envelope` rename in docs; new "Background Service" section (all 3 platforms); 4 new event payload entries; `phase` enum `ship` value added (pre-existing drift, fixed in passing) |
| `docs/usage-guide.md` | `envelope` rename; troubleshooting note for the `(root): must be object` failure mode; 4 new event payload entries |
| `src/structured-telemetry-mcp/component.yml` | Responsibilities, exceptions, contract, scope, risk, quality (test counts), pipeline.featureMode (corrected `retrofit`→`standard-iterative`), metadata updated |
| `src/structured-telemetry-mcp/docs/data-contract.md` | 4 new event sub-schemas; stale "14 event types" count references fixed to 25 |
| `src/structured-telemetry-mcp/docs/quirks.md` | New — documented deviations (manual testing for shell scripts, missing setup docs, untested Linux script, ADR-005 library-audit exception) |
| `src/structured-telemetry-mcp/docs/tech-debt.md` | New — pre-existing doc-backfill gaps surfaced (not fixed) by this feature |
| `product.yml` | New — version-manifest source of truth (created at explicit human request; template's own guidance says it's optional for single-component repos) |

---

## Full Event Type Reference (25 types as of 0.10.0)

All 21 types from `0000009-ship-phase-enum` remain unchanged (see `docs/0009--feature--ship-phase-enum.md` for their required fields). Four new types added by this feature:

| Event type | Required data fields |
|---|---|
| `loop_iteration` | `loop_id`, `iteration`, `cap`, `decision`, `toggle_level` |
| `phase_reversal_petitioned` | `report`, `filing_phase`, `binding_artifact` |
| `phase_reversal_granted` | `report`, `classification`, `cascade_size`, `budget_remaining` |
| `phase_reversal_denied` | `report`, `classification`, `cascade_size`, `budget_remaining` |

Phase enum (9 values, unchanged): `orchestrator`, `spec`, `adr`, `codegen`, `validate`, `security`, `docs`, `change`, `ship`

---

## Known Gaps (not fixed by this feature, tracked for follow-up)

- `scripts/service-linux.sh` untested on real systemd hardware (risk-register R-002).
- `README.md`/`data-contract.md` event-payload docs still missing backfill for the 12 event types added in `0000009` (pre-existing, surfaced but not fixed — see `src/structured-telemetry-mcp/docs/tech-debt.md`).
- Back in `planifest-framework`: once this ships, re-run a pipeline phase there with `emit_event` available and confirm `phase_start`/`phase_end`/`loop_iteration` land — closes the R-009 loop for real, out of scope for this repo's own pipeline.
