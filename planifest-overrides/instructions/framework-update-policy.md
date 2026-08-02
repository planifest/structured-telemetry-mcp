# Framework Update Policy

**Uncommitted changes under `planifest-framework/` are a dependency update, not a feature — commit them directly, do not route them through the P0–P9 pipeline.**

`planifest-framework/` is vendored build tooling (the Planifest framework itself), not part of this repo's shipped product (`structured-telemetry-mcp`). It has its own independent version and feature-numbering sequence, separate from this product's. Treat a change confined to `planifest-framework/` the same way you'd treat bumping a `package.json` dependency — not as application code requiring requirements, ADRs, codegen, security review, etc.

## Rule

When `git status` shows uncommitted changes under `planifest-framework/` (and optionally its companion CI file `.github/workflows/planifest.yml`) that are unrelated to the active feature's own diff:

1. Do not fold them into the active feature's pipeline artifacts (design.md, requirements, ADRs, build-log) — they are a separate concern.
2. Stage only the framework-related paths (`planifest-framework/`, `.github/workflows/planifest.yml`) — never mix them into the same commit as product code changes (`src/`, `schemas/`, `tests/`, `docs/`, `plan/`).
3. Commit directly with a plain, descriptive message — `Planifest framework update` (or similarly plain; no need to describe every internal change). No orchestrator phases, no `plan/current/` artifacts, no build-log entry required for this commit.
4. Push it on whatever branch is currently active — it does not need its own branch or PR. It is fine for a framework update to ride along inside a product feature's branch/PR.
5. If the human asks to actually *develop* a new framework feature (not just commit an already-made update), that is different — it goes through the framework's own pipeline as its own product, on its own numbering sequence.

## Why

Established 2026-08-01 after a session accumulated ~180 files of in-progress `planifest-framework` changes (a framework-internal feature, `0000021-framework-context-bloat-audit`) alongside unrelated product work. The orchestrator initially over-treated this as requiring its own product/feature lifecycle before committing. Human clarified: this is routine tooling maintenance, equivalent in weight to a dependency version bump — commit it plainly and move on, every time a new framework version needs to land.
