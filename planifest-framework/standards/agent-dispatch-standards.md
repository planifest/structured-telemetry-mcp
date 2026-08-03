---
title: "Agent Dispatch Standards"
version: "1.0.0"
---
# Agent Dispatch Standards

Canonical home for model tier selection and parallelism/dispatch mechanics, shared by the orchestrator and every phase skill that spawns subagents.

---

## Model Tier Decision Table

**Consult this table before spawning every subagent.** Resolve the tier to a concrete model name for the active tool, then pass it explicitly.

| Task type | Tier | Rationale |
|-----------|------|-----------|
| Codebase discovery (grep, find, ls, file listing) | Cheaper | No synthesis required |
| Single-file read with no synthesis | Cheaper | Mechanical retrieval |
| Formatting / spelling / lint checks | Cheaper | Pattern matching, no reasoning |
| Validation (lint, typecheck, test runner) | Cheaper | Tool execution, not reasoning |
| Web research — fetching a single known reference doc | Cheaper | Retrieval, minimal synthesis |
| Documentation writing (no novel decisions) | Cheaper | Structured output from known inputs |
| Web research with synthesis across multiple sources | Primary | Reasoning across conflicting sources |
| Code generation | Primary | Multi-file reasoning, correctness required |
| Security review | Primary | Adversarial reasoning, high-stakes |
| Architecture decisions (ADR writing) | Primary | Consequential, requires judgement |
| Requirements writing (spec) | Primary | Ambiguity resolution, domain reasoning |
| Phase 0 coaching | Primary | Dialogue, gap assessment |
| Build assessment (P8) | Cheaper | Read-only summarisation from a structured log |

**Tier-to-model mapping by tool** (update when tools release new models):

| Tool | Primary tier | Cheaper tier |
|------|-------------|-------------|
| Claude Code | claude-sonnet-4-6 (or latest Sonnet) | claude-haiku-4-5 (or latest Haiku) |
| Cursor | gpt-4o | gpt-4o-mini |
| Codex (OpenAI) | o1 | o1-mini |
| GitHub Copilot | gpt-4o | gpt-4o-mini |
| Windsurf | claude-sonnet-4-6 | claude-haiku-4-5 |
| Cline | (inherits from host tool) | (inherits from host tool) |

**How to apply:** Before calling `Agent(...)`, look up the task in the table. Pass `model: {resolved model name}` as a parameter. Record the tier in the build log for P8.

---

## Parallelism Rules

**Default posture: parallel.** Sequential dispatch requires an explicit dependency justification. **Dependency test:** can task B start before task A's output is available? If you cannot state why it must wait, dispatch both in parallel (single message, multiple Agent tool calls).

### MUST parallelise

| Pattern | Example |
|---------|---------|
| Multiple independent codebase searches | Grepping for hook files + scanning skill dirs simultaneously |
| Web research across independent tools/sources | Hook support for Windsurf + Hook support for Cline — same request, different sources |
| Independent document reads | Reading 3 skill files that do not reference each other |
| Background test runner while writing docs | Run `run-tests.sh` in background while docs-agent produces output |
| Multi-component security reviews (no shared state) | Reviewing component A and component B in parallel |
| Independent requirement files (no cross-references) | Writing req-001 through req-008 in a single parallel batch |

### Cannot parallelise

| Pattern | Reason |
|---------|--------|
| Phase N work before Phase N-1 artifacts exist | Hard phase dependency |
| ADR writing before requirements are complete | ADR content depends on spec output |
| Codegen before ADRs are accepted | ADRs may constrain implementation choices |
| P8 before P7 archive is confirmed | Report needs the archive path |
| Tasks where B reads A's output | Sequential by definition |

**Record in build log:** After each phase, record the parallel task batch count. If it is 0 for a phase where parallelism was possible, the P8 efficiency observation will flag it.

---

## Agent Dispatch Template

Agent spawning is level-2 parallelism (the Agent tool for independent sub-tasks that each need their own tool access and context) — level-1 (multiple native tool calls in one message) is covered by Parallelism Rules above. Spawn when a task is self-contained enough to brief to a colleague in one paragraph; stay inline when it needs ongoing dialogue, shared mutable state, or is too small to justify the overhead.

**Concrete parallel dispatch skeleton** (send both `Agent()` calls in a single message so they execute concurrently):

```
Agent({ description: "Implement REQ-001: {one-liner}", subagent_type: "general-purpose", model: "claude-haiku-4-5",
  prompt: "Requirement: plan/current/requirements/req-001-{slug}.md. ADR: plan/current/adr/ADR-00N-{slug}.md. Stack: {constraint}. Task: {what to build}. Confirm: files modified, what changed." })

Agent({ description: "Implement REQ-002: {one-liner}", subagent_type: "general-purpose", model: "claude-haiku-4-5",
  prompt: "Requirement: plan/current/requirements/req-002-{slug}.md. ADR: plan/current/adr/ADR-00N-{slug}.md. Stack: {constraint}. Task: {what to build}. Confirm: files modified, what changed." })
```

**Self-contained prompt rule:** include the requirement file path, relevant ADR paths, stack declaration or relevant constraint, and what "done" looks like. Do NOT rely on shared conversation history — the spawned agent has no memory of this session.

**Model tier for spawned agents:** see the Model Tier Decision Table above.
