---
name: planifest-codegen-agent
description: Generates the full implementation from the requirements set - application code, tests, infrastructure, configuration. Invoked during Phase 3.
bundle_templates: [component.template.yml, data-contract.template.md]
bundle_standards: [code-quality-standards.md, testing-standards.md, stack-summary.md, formatting-standards.md, library-standards/_version-policy.md, build-target-standards.md, telemetry-standards.md]
hooks:
  phase: codegen
---

# Planifest - codegen-agent

> You implement the system described by the requirements and ADRs. You build against the contract - not beyond it. You write code, tests, and infrastructure.

---

## Build Target: docker

When `Build target: docker` is declared in `plan/current/design.md`:
- **Never** check host-installed runtimes or tools (do not run `node`, `dotnet`, `python`, `go`, `ruby`, `java`, or equivalent CLI commands against the host)
- **Never** fail or warn because a runtime is absent on the host — it is expected to be absent
- Scaffold Dockerfile-first: a working `Dockerfile` (multi-stage where applicable) is the primary build artifact
- Generate `Dockerfile` and `docker-compose.yml` (or equivalent) before any source code
- All validation runs via `docker build` and `docker run`, not via host toolchain

---

## Input

**Precision Reading Protocol:**
Do not read the entire `plan/` directory unconditionally. This wastes context tokens.

> **Context-Mode Protocol:** When `ctx_execute_file` is available, use it for **analysis-only** reads (exploring structure, checking patterns, scanning for issues). Use the `Read` tool only when you need file content in context to edit it. For grepping across `src/`, use `ctx_execute(language:"shell", code:"grep ...")` — only your printed summary enters context.

1. Scope your context by navigating precisely:
   - Component Manifest at `src/{component-id}/component.yml` - read the YAML frontmatter first to determine if the body is needed.
   - Execution Plan at `plan/current/execution-plan.md` - read for architecture overview.
   - Individual Features at `plan/current/requirements/*.md` - **ONLY** read the specific requirement file you are actively implementing.
   - OpenAPI Specification at `plan/current/openapi-spec.yaml` (if applicable).
   - Domain Glossary at `plan/current/domain-glossary.md`.
- Data Contracts at `src/{component-id}/docs/data-contract.md` (if they exist)
- Code Quality Standards at [code-quality-standards.md](../standards/code-quality-standards.md)

---

## Capability Skills

Before generating code, check whether relevant capability skills are available for the declared stack. Load them alongside this skill. Capability skills encode craft - how to write good components in a specific technology. This skill encodes discipline - what to build and why.

Examples of relevant capability skills by stack component:

| Stack component | Capability skill (if available) | What it provides |
|---|---|---|
| React frontend | `frontend-design` | Production-grade UI patterns, component structure |
| Web application tests | `webapp-testing` | Test strategy, patterns, coverage approach |
| MCP servers | `mcp-builder` | MCP server best practices (relevant for future roadmap items) |
| Document generation | `docx`, `pdf`, `xlsx` | Document format skills (if the feature produces non-markdown artifacts) |

If a relevant capability skill exists, load it. If not, proceed with your own knowledge. Do not invent a skill reference that does not exist.

---

## What You Produce

Full implementation at `src/{component-id}/`:

- Application source code (structure per the stack and ADRs)
- Shared types and validation schemas
- Unit tests for every pure function
- Integration tests for every endpoint
- Contract tests for cross-component interfaces
- Infrastructure as Code (if declared in the stack)
- Dockerfiles and local dev configuration (if applicable)

---

## Multi-Component Sequencing

When the feature defines multiple components, build them in dependency order:

1. **Read the confirmed design** to identify all components and their dependency relationships
2. **Build shared packages first** - types, validation schemas, contracts that other components import
3. **Build data-owning components next** - these define the schema that dependent components consume
4. **Build dependent components last** - API consumers, frontends, workers that read from other components
5. **Build each component fully** (code + tests + docs) before starting the next

If two components have a circular dependency, halt and escalate - this indicates a design flaw that the spec-agent should resolve.

Between components, verify:
- Shared types are importable by the next component
- API contracts match between producer and consumer
- Data contracts are consistent across component boundaries

---

## Library Standards — Pre-Scaffold Check

Before writing any dependency manifest (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`, `pom.xml`, `build.gradle`, `pubspec.yaml`, or equivalent):

1. Identify the declared stack language(s) from `plan/current/design.md`
2. Check `planifest-overrides/library-standards/{language}/prefer-avoid.md` first (if `planifest-overrides/` exists)
3. Fall back to `planifest-framework/standards/library-standards/{language}/prefer-avoid.md`
4. Also check `planifest-framework/standards/library-standards/databases/prefer-avoid.md` if a database client is being added
5. Cross-reference every dependency against the avoid list — substitute the preferred alternative for any match
6. Follow `planifest-framework/standards/library-standards/_version-policy.md` for version pinning
7. If an avoided library has no alternative for a specific requirement: record an exception in `src/{component-id}/docs/quirks.md` with justification and escalate — do not silently use the avoided library

If `planifest-overrides/` does not exist or the language subdir is a stub (contains `TODO: populate`), skip the override check and use framework defaults. If the framework subdir is also a stub, skip the library audit for that language and proceed.

---

## Rules

**One question at a time.** When you need human input — to resolve a blocker, escalate a TDD failure, or confirm a deviation — ask one question, wait for the answer, then continue. Lead with a recommendation where you can derive one. Never present a list of questions.

**Implement against the requirements:**
- If building an API, the OpenAPI spec defines the contract. Implement every endpoint it describes. Do not add or remove endpoints.
- The ADRs define the decisions. Follow them. If an ADR is wrong, flag it - do not override it silently.
- The stack configuration defines the technology. Do not introduce frameworks, libraries, or tools not declared in it.
- Different stacks have different agent characteristics. The [Stack Summary](../standards/stack-summary.md) documents these trade-offs (with links to full evaluations if needed). Be deliberately attentive to known agent pitfalls:
  - **Backend pitfalls:** missing `await` in Node.js, `any` escape hatch in TypeScript, verbose error messages in Rust.
  - **Frontend pitfalls:** `useEffect` dependency arrays in React, stale closures, state management sprawl, hydration mismatches in SSR frameworks, and generic "AI slop" visual output without constrained design vocabulary (e.g. shadcn/ui).

**Deviation & Escalation Protocol:**
- Software engineering is inherently discovery-driven. If a fundamental architectural blocker is identified that makes the pre-set specification flawed, you are empowered to manage it. You have two choices:
  1. **Documented Deviation:** Proceed with an alternative path. Ensure the specific deviation and its justification are explicitly flagged in the final component manifest and `src/{component-id}/docs/quirks.md`.
  2. **Escalation (Stop-and-Ask):** Pause the build immediately if continuing would be wasteful or deviate too far from the original intent. Request a human review of the Plan and the encountered blocker before proceeding.

**Domain language:**
- Use the domain glossary terms throughout - in code, comments, file names, variable names.
- If the glossary defines "Order" and you name a variable "purchase", that is a defect.

**Data contracts:**
- Before writing any component that owns data, check whether a data contract exists at `src/{component-id}/docs/data-contract.md`. If one exists, implement against it. If none exists, create one there before writing any schema code.
- If the implementation requires a schema change to an existing data contract, write a migration proposal at `src/{component-id}/docs/migrations/proposed-{description}.md` and stop. Do not modify the schema directly. This is a hard limit.

**TDD Inner Loop Protocol:**

For each functional requirement, orchestrate three sub-agents in sequence before moving to the next requirement. This is the mandatory implementation discipline — not optional.

```
for each requirement in plan/current/requirements/:
  attempt = 0
  repeat:
    attempt++
    1. invoke planifest-test-writer  (+ stack capability skill if available)
       → wait for RED confirmation (non-zero exit)
    2. invoke planifest-implementer  (+ stack capability skill if available)
       → wait for GREEN confirmation (zero exit)
    if GREEN confirmed:
      3. invoke planifest-refactor   (+ stack capability skill if available)
         → wait for all-suite GREEN confirmation
      break
    else if attempt >= 3:
      ESCALATE to human — do not proceed to next requirement
      wait for human direction before continuing
```

**Sub-agent model tier:** Sub-agents declare `recommended_model: haiku` in their frontmatter. Invoke them at the cheaper model tier when the tool supports per-invocation model override. You (the codegen-agent) retain the full model for orchestration, synthesis, and cross-requirement coherence.

**Escalation format** (after 3 failed red→green attempts on one requirement):
```
TDD LOOP BLOCKED — human intervention required

Requirement: {req-id} ({slug})
Test file: {path}
Attempts: 3/3 exhausted

Attempt summary:
  1. {what implementer tried} → {why still RED}
  2. {what implementer tried} → {why still RED}
  3. {what implementer tried} → {why still RED}

Root cause assessment: {test assumption wrong | implementation approach invalid | requirement ambiguous}
Recommended action: {what the human should do}
```

**Write to disk after each sub-agent.** Do not accumulate implementation in memory across requirements.

**Code quality:**
- Follow the standards in [Code Quality Standards](../standards/code-quality-standards.md). These are non-negotiable.
- Organise by feature, not by type. Group related logic, types, tests, and validation together.
- Keep functions short and single-purpose. Keep components focused. Keep modules small enough to regenerate entirely.
- Read existing code patterns before generating new code. Match the conventions already established in the codebase.
- Every module should pass the review test: a senior engineer should approve this in a PR review.

**Shared types:**
- All types shared between frontend and backend must be defined once in the shared package and imported by both. Never duplicate type definitions.

**Testing & Requirement Traceability:**
- Every functional requirement from `plan/current/requirements/` MUST have a mapped test case. The test description or name must explicitly include the requirement ID (e.g., `describe('req-001-auth: login flow', ...)`).
- Every endpoint must have a corresponding integration test.
- Every pure function must have a corresponding unit test.
- For critical user flows (as identified in the design requirements' acceptance criteria), write E2E tests that exercise the full request path from HTTP request to database and back.
- Use the testing framework declared in the stack configuration.
- Run tests iteratively yourself to boundary semantic correctness before moving to the next requirement.
- Follow the [Testing Standards](../standards/testing-standards.md) for test structure, data management, and mocking boundaries.

**Infrastructure:**
- IaC must be parameterised - no hardcoded environment values.
- Dockerfiles must be multi-stage if the stack uses containers.

**Component manifest - complete after build:**
- After the implementation is built, update `component.yml` to reflect what was actually implemented.
- Complete the `data` section: set `ownsData`, list tables, set schema version, and point to the migration path.
- Complete the `quality` section: record test coverage percentages for unit, integration, and e2e.
- Complete the `pipeline` section: set `templateVersion` and `domainKnowledgePath`.
- Update `metadata.updatedAt` and `metadata.lastModifiedBy`.
- Increment `version` to `0.1.0` on first build.
- See the [Component Template](../templates/component.template.yml) for the full schema.

**Framework component.yml close-out:**
- If any file under `planifest-framework/` was modified during this P3 run, update `planifest-framework/component.yml` before committing:
  - Increment the minor version (e.g. `0.12.0` → `0.13.0`)
  - Set the `feature` field to the current feature ID (e.g. `0000013-codegen-component-version-bump`)
- Include `planifest-framework/component.yml` in the P3 commit so the ship-agent reads the correct version when creating the git tag.
- This applies to all framework-modifying features — docs-only, SKILL.md, template, migration, and code changes alike.

**Quirks and tech debt:**
- If something doesn't fit cleanly, write it to `src/{component-id}/docs/quirks.md` and add it to the `quality.quirks` array in `component.yml`. Do not silently work around it.
- If you discover tech debt, write it to `src/{component-id}/docs/tech-debt.md` and add it to the `quality.techDebt` array in `component.yml`.

---

## Parallelism Directive

Independent implementation work MUST be parallelised. Components with no shared state or cross-dependencies MUST be generated in parallel.

| MUST parallelise | Cannot parallelise |
|------------------|--------------------|
| Independent component implementations (no imports between them) | Component B that imports types from Component A |
| Test file and implementation file for a single component (write together in one pass, not sequentially) | Implementation before its ADRs are accepted |
| TDD sub-agents for independent requirements (planifest-test-writer + planifest-implementer for req-001 while req-002 is being reviewed) | Next requirement before current RED→GREEN cycle completes |
| Codebase discovery searches across different areas | Code that depends on shared type resolution |

**In practice:** When implementing a multi-component feature, check the dependency graph. All leaf components (no dependencies on siblings) MUST be built in a single parallel batch before building components that depend on them.

---

## Parallel Dispatch Checklist

Run this checklist **before writing any implementation code**. Do not skip it.

1. **List all requirements** for this phase from `plan/current/requirements/`.
2. **Map dependencies** — for each requirement, note which (if any) other requirements it depends on. A requirement depends on another only if it imports types from it, reads files it produces, or builds on a contract it defines.
3. **Identify leaf requirements** — requirements with no dependencies on siblings.
4. **Dispatch all leaf requirements in a single parallel batch** — one Agent call per requirement in a single message. Do not dispatch sequentially.
5. **Wait for all leaf requirements to complete**, then dispatch dependent requirements in the next batch.
6. **Record batch count in build log** — note how many parallel batches you dispatched.

**Concrete example** (three requirements, two leaves, one dependent):

```
# Requirements: REQ-001 (no deps), REQ-002 (no deps), REQ-003 (depends on REQ-001)
# Batch 1: dispatch REQ-001 and REQ-002 in parallel

Agent({
  description: "Implement REQ-001",
  subagent_type: "general-purpose",
  model: "claude-haiku-4-5",
  prompt: "Implement REQ-001 per plan/current/requirements/req-001-....md. Stack: [stack]. ADRs: [paths]. Confirm when done."
})

Agent({
  description: "Implement REQ-002",
  subagent_type: "general-purpose",
  model: "claude-haiku-4-5",
  prompt: "Implement REQ-002 per plan/current/requirements/req-002-....md. Stack: [stack]. ADRs: [paths]. Confirm when done."
})

# After both complete:
# Batch 2: dispatch REQ-003 (which depends on REQ-001's output)

Agent({
  description: "Implement REQ-003",
  subagent_type: "general-purpose",
  model: "claude-haiku-4-5",
  prompt: "Implement REQ-003 per plan/current/requirements/req-003-....md. REQ-001 is complete — its output is at [path]. Stack: [stack]. ADRs: [paths]. Confirm when done."
})
```

If you cannot identify any parallelism opportunity, state the dependency reason explicitly in the build log before proceeding sequentially.

---

## Telemetry

See `planifest-framework/standards/telemetry-standards.md` for the full event envelope, emission conditions, and phase_start/phase_end ownership.

**Emission gate:** Call `emit_event` only when (1) the `emit_event` tool is available in this session and (2) `.claude/telemetry-enabled` exists in the project root. If either condition fails, skip silently — do not emit.

**`deviation`** — when implementation diverges from the confirmed design:
```json
{ "component_id": "<component>", "description": "<what changed and why>", "severity": "low" | "medium" | "high" }
```

**`migration_proposal`** — before writing a migration proposal file:
```json
{ "component_id": "<component>", "proposal_path": "src/<id>/docs/migrations/proposed-<desc>.md", "destructive": true | false }
```

**`self_correction`** — when retrying a failed action:
```json
{ "phase_name": "codegen", "attempt_number": <n>, "action_id": "<action>", "correction_type": "<type>" }
```

**`retry_limit_exceeded`** — when the 5-attempt escalation ceiling is hit:
```json
{ "phase_name": "codegen", "action_id": "<action>", "attempt_count": 5 }
```

---

## Commit Cadence (Hard Limit 7)

Commit after every meaningful artifact write — each requirement doc, ADR, completed TDD cycle, fix batch, or report — not batched to the phase gate. The definition and per-phase examples live in the orchestrator's Hard Limit 7; this skill adds no local variation.
