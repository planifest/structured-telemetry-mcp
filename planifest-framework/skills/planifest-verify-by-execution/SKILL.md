---
name: planifest-verify-by-execution
description: Verifies acceptance criteria by actually running the software — browser click-throughs, real API calls, CLI invocations, log/DB checks — never by reading test output alone. Loaded by the P4 validate-agent after CI passes.
bundle_templates: [loop-state.template.md]
bundle_standards: [testing-standards.md, telemetry-standards.md, build-target-standards.md]
hooks:
  phase: validate
---

# Planifest - verify-by-execution

> Tests passing proves the tests pass. You prove the *software does what the acceptance criteria say* by running it and observing behaviour. Loaded by the validate-agent after CI checks pass, when the `verify_by_execution` toggle is `report-only` or `on`.

---

## The One Rule

**Reading test output alone never counts as verification.** Every criterion you verify must be backed by an observation you made of the running software. If you cannot run it, the criterion is `not-verifiable` with a reason — never silently passed.

## Method Selection

For each acceptance criterion in `plan/current/requirements/`, pick the observation method by target type:

| Target | Method | Observation evidence |
|--------|--------|---------------------|
| Web UI | Browser MCP click-through of the criterion's flow | What was clicked, what rendered (accessibility-tree/read-page output beats screenshots for text) |
| HTTP API | Real request against the running service (respecting Build target: docker — run in-container) | Request sent, status + body received |
| CLI / script | Invoke it with the criterion's inputs | Command, exit code, output |
| Side effects (files, DB, logs) | Inspect the artifact the behaviour should have produced | Path/query + found state |
| Hook / gate behaviour | Trigger the guarded action and observe pass/block | Trigger, exit code, message |

Start whatever the software needs (dev server, container) per the project's run conventions; tear down afterwards. Never verify against production systems or with production credentials.

## Per-Criterion Outcomes

| Outcome | Meaning | Consequence |
|---------|---------|-------------|
| `verified` | Observed behaviour matches the criterion | — |
| `failed` | Ran it; behaviour contradicts the criterion | Feeds P4's existing self-correction loop (cap 5, unchanged) — a behavioural failure is a validation failure even with green tests |
| `not-verifiable` | Cannot be executed here (needs prod credentials, external hardware, human judgement) | Recorded with the reason; surfaced in the P4 gate summary — never silently passed |

## Report

Write `plan/current/verification-report.md`:

```markdown
# Verify-by-Execution Report
**Toggle:** report-only | on
**Software exercised:** {what was started/run, how}

| Requirement | Criterion | Method | Outcome | Observation evidence |
|-------------|-----------|--------|---------|---------------------|
| REQ-001 | {criterion} | {api-call} | verified | {status 201, body …} |
```

## Telemetry

Per `telemetry-standards.md` gate: emit `loop_iteration` per verification pass (loop_id `verify_by_execution`).
