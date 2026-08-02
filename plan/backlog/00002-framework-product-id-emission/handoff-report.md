---
title: "Handoff Report: product_id Emission — for a planifest-framework release"
summary: "Implementation-ready specifics for wiring product_id into every telemetry emission path, for use as the P0 brief on the planifest-framework product's own pipeline."
status: "ready-for-p0"
---
# Handoff Report: `product_id` Emission

**Target product:** `planifest-framework` (NOT `structured-telemetry-mcp` — separate product, separate version/feature sequence)
**Source feature:** `0000015-telemetry-log-viewer-ui` (structured-telemetry-mcp), which added the `product_id` field to the shared schema but could not populate it without touching framework internals
**Backlog entry:** [entry.md](entry.md) (2026-08-01) — this report supersedes it as the implementation reference; `entry.md` remains the short pointer record
**Date compiled:** 2026-08-02
**Status:** No schema/contract work needed on the framework side — the field already exists and is optional. This is pure additive wiring.

---

## Why this matters

`structured-telemetry-mcp`'s new log-viewer UI (`GET /ui`) lets a human filter events by `product_id` to distinguish which repo/project emitted them — useful because one telemetry backend (`$HOME/.planifest/telemetry.db`) can serve multiple projects. Every event emitted **today**, and every event emitted **going forward until this lands**, has `product_id` absent and renders as `"unknown"` in the UI. The filter exists; nothing populates the field it filters on.

## What already exists (do not touch)

- `schemas/telemetry-event.schema.json` (structured-telemetry-mcp) — `product_id` is already a defined, optional, top-level envelope property:
  ```json
  "product_id": {
    "type": "string",
    "description": "Identifies the emitting repo/project — the git repo root path (git rev-parse --show-toplevel), falling back to the raw cwd if not inside a git repo. Optional; NULL/absent displays as \"unknown\"."
  }
  ```
- `src/db/schema.ts`, `duckdb-event-repository.ts`, `src/query/event-log.ts` (structured-telemetry-mcp) already read/store/filter on this column. Shipped in 0000015.
- No backfill of historical rows is planned or wanted (ADR-017) — leave those permanently `"unknown"`.

**This work is additive-only: populate a field that already has a home. No new schema migration, no new ADR needed on the telemetry-mcp side.**

## Exactly what needs to change, file by file

### 1. Three hook scripts under `planifest-framework/hooks/telemetry/`

Each of these builds an `event` object literal that gets POSTed to `${BACKEND_URL}/emit`. None currently sets `product_id`. All three already resolve `cwd` from hook stdin input (`input?.cwd ?? process.cwd()`), so the derivation has a ready input.

**`planifest-framework/hooks/telemetry/emit-phase-start.mjs`**
- `cwd` already resolved at line 159: `cwd = input?.cwd ?? process.cwd();`
- Event object built at lines 174–185. Add `product_id` field there.

**`planifest-framework/hooks/telemetry/emit-phase-end.mjs`**
- `cwd` already resolved at line 145: `cwd = input?.cwd ?? process.cwd();`
- Event object built at lines 159–174. Add `product_id` field there.

**`planifest-framework/hooks/telemetry/context-pressure.mjs`**
- `cwd` already resolved at line 140: `cwd = input?.cwd ?? process.cwd();`
- Event object built at lines 162–180. Add `product_id` field there.

**Derivation to add** (new small helper, shared or duplicated per file — these hooks are already independently self-contained, e.g. each duplicates `recordTelemetryFailure`, so following that existing pattern of per-file duplication over a shared import is consistent with how these three files are already written):

```js
import { execFileSync } from "node:child_process";

function getProductId(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return cwd;
  }
}
```

Then in each event object literal, add one line, e.g. in `emit-phase-start.mjs`:
```js
const event = {
  schema_version: "1.0",
  event: "phase_start",
  session_id: sessionId,
  product_id: getProductId(cwd),   // <-- new
  phase: PHASE,
  ...
};
```

**Constraints to preserve (do not regress):**
- Silent-on-error / never-block behavior (ADR-005) — `getProductId` must never throw past its own `try/catch`; a `git` binary absent or a non-repo cwd must fall back to raw `cwd`, not abort emission.
- No added latency budget beyond the existing 3s fetch abort — `git rev-parse --show-toplevel` is a local, sub-millisecond operation; no async/network involved, safe to call synchronously before the fetch.
- Field is optional in the schema — omitting it on failure is fine, but the fallback-to-cwd path means it should realistically always be present.

### 2. Canonical envelope template — `planifest-framework/standards/telemetry-standards.md`

This is the **single point of truth** for agent-driven (in-conversation) `emit_event` calls — every phase skill's `## Telemetry` section is documented as copying the "full envelope" from here (see standards doc line 73: *"The snippets in each skill's `## Telemetry` section show the `data` field content only — the full envelope above always wraps it."*).

Current template (`telemetry-standards.md`, "Event Envelope" section, ~line 58):
```json
{
  "schema_version": "1.0",
  "event": "<event_name>",
  "agent": "<skill-name e.g. planifest-validate-agent>",
  "phase": "<phase e.g. validate>",
  "tool": "<tool e.g. claude-code>",
  "model": "<active model id>",
  "mcp_mode": "none | workspace | context | workspace+context",
  "session_id": "<session id>",
  "timestamp": "<ISO 8601 UTC>",
  "data": { }
}
```

Add one line:
```json
  "product_id": "<git repo root, or cwd if not a git repo>",
```

Because every phase skill (`planifest-orchestrator`, `planifest-spec-agent`, `planifest-adr-agent`, `planifest-codegen-agent`, `planifest-validate-agent`, `planifest-security-agent`, `planifest-docs-agent`, `planifest-change-agent` — the 8 files matched by `grep -rl emit_event planifest-framework/skills/`) references this template rather than hardcoding its own copy of the envelope, updating it here is expected to be sufficient — **verify at P1/P2 whether any of the 8 skill files inline a literal copy of the envelope instead of just referencing this doc**, since if so those literal copies need the same one-line addition individually.

The agent constructing an inline `emit_event` call would derive `product_id` the same way (`git rev-parse --show-toplevel` from its own cwd, fallback to cwd) — since this happens in-conversation (not a subprocess hook), this is a `Bash`/shell-out call the skill makes itself, same derivation logic as the hooks above, just invoked differently (agent tool call vs. `execFileSync`).

### 3. No schema change needed

Confirmed: `schemas/telemetry-event.schema.json` in `structured-telemetry-mcp` already declares `product_id` as optional and does not restrict its format beyond `type: string`. `additionalProperties: false` is set at the envelope's top level (line 18) but `product_id` is already listed as a defined property (line 65-68), so no schema edit is required on either side.

## Suggested requirements shape for P1 (spec-agent)

| # | Requirement | Acceptance criteria sketch |
|---|---|---|
| 1 | `product_id` derivation helper in each of the 3 telemetry hooks | Given a cwd inside a git repo, emitted event's `product_id` equals `git rev-parse --show-toplevel` output for that cwd; given a cwd outside any git repo, `product_id` equals the raw cwd; a missing/failing `git` binary does not throw or block emission |
| 2 | Canonical envelope template updated with `product_id` | `telemetry-standards.md`'s Event Envelope section includes `product_id`; audit of the 8 skill files' `## Telemetry` sections confirms none hardcode a stale envelope copy missing the field (or those found are updated too) |
| 3 | Regression coverage | Extend or add to `planifest-framework/tests/regression/` — one test per hook confirming `product_id` appears in the POSTed event body under both the git-repo and non-git-repo cwd cases |

## Non-goals (explicitly out of scope, per source ADR-017)

- No backfill of historical rows — leave existing `NULL`/absent rows as `"unknown"` permanently.
- No change to `structured-telemetry-mcp`'s schema, DB layer, or UI — all already ships/reads `product_id` correctly as of 0000015.
- No new telemetry event types.

## Effort estimate

Small — 3 hook files (~5 lines each), 1 doc template (~1 line + an 8-file grep-and-verify pass), regression test additions. No architectural decisions, no ADRs anticipated (this is closing a gap in an already-decided design), no destructive/schema work, no human approval gate expected beyond the framework's own normal P0 confirmation.
