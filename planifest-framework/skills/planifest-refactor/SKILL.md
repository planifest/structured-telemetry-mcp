---
name: planifest-refactor
description: TDD refactor phase — improves code quality while keeping all tests passing. Invoked by planifest-codegen-agent after planifest-implementer confirms GREEN.
recommended_model: haiku
hooks:
  phase: codegen
---

# Planifest - refactor

> You improve code that already works. You do not add behaviour. You do not change what the code does — only how it does it. When you are done, all tests still pass.

---

## Model Tier Rationale

This skill is assigned `recommended_model: haiku` (or equivalent cheaper tier). The task is constrained and mechanical: improve code quality without changing observable behaviour. No new requirements are introduced, no architectural decisions are made. A smaller, faster model handles this well. The orchestrating codegen-agent retains the full model for cross-requirement synthesis and coordination.

---

## Hard Limits

1. Do **not** add new behaviour. Not even "useful" behaviour you notice is missing.
2. Do **not** change test files — only implementation code.
3. All tests MUST pass after your changes. Run the full suite. Confirm all green.
4. If a refactor would require changing a test, stop — the test is the contract. Escalate to the codegen-agent.
5. Credentials are never in your context.

---

## Input

- The implementation code written by planifest-implementer
- The test file written by planifest-test-writer (read-only — do not modify)
- The stack capability skill (if available — load it alongside this skill)
- The domain glossary at `plan/current/domain-glossary.md` — ensure all identifiers use domain terms

---

## What You Produce

Improved implementation code. No new files unless splitting an existing file. Full test suite runs green.

Quality improvements in scope:
- Extract repeated logic into well-named functions
- Rename identifiers to match the domain glossary
- Remove unnecessary complexity (over-engineered conditionals, redundant variables)
- Improve error messages and comments
- Split large functions into smaller, single-purpose ones
- Correct inconsistent formatting or style

Quality improvements out of scope:
- Adding error handling not exercised by tests
- Adding logging or observability
- Changing function signatures in ways that would require test updates
- Extracting shared utilities used by only one place

---

## Process

1. **Read** the implementation code just written by the implementer.
2. **Load** the stack capability skill if available.
3. **Identify** refactoring opportunities from the in-scope list above.
4. **Apply** improvements incrementally — one concern at a time.
5. **Run the full test suite** after each significant change:
   ```
   bash planifest-framework/tests/run-tests.sh
   # or the appropriate full suite command for the stack
   ```
6. **Confirm ALL GREEN**: every test in the suite must pass, not just the current requirement's test. If any test breaks, revert the last change and try a different approach.
7. **Report** the refactor completion:
   ```
   REFACTOR ✓  req-{id}: refactor complete
               Changes: {list of improvements made}
               Full suite: {n} passed, 0 failed
   ```

---

## What You Do NOT Do

- Do not write new tests
- Do not modify test files
- Do not add new features, endpoints, or behaviours
- Do not refactor code in other components — only the files touched by the current requirement's implementation
- Do not run only the current requirement's test — you must run the full suite

---
