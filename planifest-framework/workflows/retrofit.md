---
name: retrofit
description: Onboard an existing codebase into the confirmed design framework - reads the codebase, infers architecture, and reconciles with a feature brief. Use this when adding Planifest to a project that already has code.
---

# Retrofit

Onboard an existing codebase into the confirmed design framework.

## Prerequisites

- Existing code in `src/`
- A feature brief at `plan/current/feature-brief.md` describing the intended changes
- Component manifests (`component.yml`) in each existing component - use the [component manifest template](../templates/component.template.yml) and [guide](../templates/component-guide.md)

## Steps

1. **Load the orchestrator skill**
2. **Read the codebase** - the orchestrator runs this structured scan (when `ctx_batch_execute` is available, run all six steps as a single batch call):
   1. **Scan for entry points:** `package.json`, `go.mod`, `requirements.txt`, `Cargo.toml`, `Makefile`, `Dockerfile`, `docker-compose.yml` — reveal the stack
   2. **Identify components:** each directory with its own build/test configuration is a candidate component; create a `component.yml` for each
   3. **Map data ownership:** find database connections, ORM configurations, migration files; determine which component owns which tables/collections
   4. **Discover API contracts:** find route definitions, controller files, gRPC proto files; draft an OpenAPI spec from what exists (if applicable)
   5. **Detect patterns:** identify auth middleware, logging, error handling, testing patterns already in use; record as existing constraints in the design
   6. **Surface tech debt:** note inconsistencies, missing tests, deprecated dependencies, security concerns; record in the risk register

   Findings are written to `plan/current/discovery.md` (see `discovery.template.md`'s Retrofit subsection for the exact field shape) and reviewed by the human before coaching.
3. **Reconcile** - compare the feature brief against the discovered reality:
   - What already exists that the brief describes?
   - What conflicts between the brief and the codebase?
   - What gaps remain?
4. **Coach** - Phase 0 coaching, but informed by codebase reality:
   - The human may need fewer questions (codebase already answers them)
   - Or more questions (codebase reveals conflicts)
5. **Proceed** - once the Design is confirmed, execute the pipeline as normal (Phases 1-6)

## Notes

- The spec-agent also operates in retrofit mode - it reads the codebase before producing artifacts
- Existing architecture decisions should be captured as ADRs, not re-decided
- The adoption mode is recorded in the confirmed design: `adoption_mode: retrofit`

