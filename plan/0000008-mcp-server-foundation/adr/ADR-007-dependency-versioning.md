# ADR-007: Always Use Latest Stable npm Packages

**Status:** Accepted  
**Date:** 2026-04-13  
**Author:** Martin Mayer

---

## Context

During Phase 3 build, devDependencies were pinned to ranges that resolved to outdated versions (`typescript@5`, `vitest@3`, `esbuild@0.25`, `@types/node@22`). When upgraded to latest (`typescript@6`, `vitest@4`, `esbuild@0.28`, `@types/node@25`), a TypeScript 6 breaking change surfaced: Node.js built-in types are no longer implicitly included and now require `"types": ["node"]` in `tsconfig.json`. This was a one-line fix, caught immediately, and is a good example of why staying current matters: the longer a codebase drifts behind, the more breaking changes accumulate before the next upgrade.

---

## Decision

All npm dependencies — runtime and development — MUST be set to the latest stable release at the time of the pipeline run. Version ranges use `^` (compatible minor/patch) but the initial installed version must be latest, not whatever npm resolves by default.

---

## Rationale

- **Security:** Outdated packages accumulate CVEs. Latest stable minimises exposure.
- **Correctness:** TypeScript and tooling major versions carry breaking changes. Staying current means fixes are small and immediate rather than large and deferred.
- **Ecosystem alignment:** The MCP SDK, DuckDB bindings, and Zod evolve quickly. Outdated tooling versions may misrepresent their APIs.
- **Agent code generation:** Agents (including this one) are trained on recent versions. Generating code against old APIs introduces subtle divergence between training knowledge and runtime behaviour.

---

## Consequences

**Positive:**
- Security posture is as strong as npm can make it.
- Breaking changes are caught at build time, not after months of drift.
- Generated code matches the API surface the agent was trained on.

**Negative:**
- Major version upgrades occasionally require one-line fixes (e.g. `tsconfig.json` for TypeScript 6).
- Requires `npm outdated` check at the start of every pipeline run.

**Risks:**
- A dependency may publish a breaking minor/patch (semver violation). Mitigated by CI running on every push.

---

## Applying This Rule

At the start of every codegen pipeline run:
1. Run `npm outdated` — any entry in the "Latest" column that differs from "Current" is a violation.
2. Upgrade with `npm install <pkg>@latest` for each outdated package.
3. Run `npm run typecheck && npm test` to catch breakage immediately.
4. Document any required fixes in `docs/quirks.md` if non-trivial.

---

## Related ADRs

- ADR-001 (Stack Choice) — declares the language and runtime; this ADR governs how versions within that stack are managed.
