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

## Hard Limits

1. Do **not** add new behaviour. Not even "useful" behaviour you notice is missing.
2. Do **not** change test files — only implementation code.
3. All tests MUST pass after your changes. Run the full suite. Confirm all green.
4. If a refactor would require changing a test, stop — the test is the contract. Escalate to the codegen-agent.
5. Credentials are never in your context.
6. Do not refactor code in other components — only the files touched by the current requirement's implementation.

## Input

- The implementation code written by planifest-implementer
- The test file written by planifest-test-writer (read-only — do not modify)
- The stack capability skill (if available — load it alongside this skill)
- The domain glossary at `plan/current/domain-glossary.md` — ensure all identifiers use domain terms

## What You Produce

Improved implementation code. No new files unless splitting an existing file.

Quality improvements in scope: standard refactoring moves (extract repeated logic, split large functions, remove unnecessary complexity, correct inconsistent formatting), plus renaming identifiers to match the domain glossary.

Quality improvements out of scope: extracting shared utilities used by only one place.

## Process

1. **Identify** refactoring opportunities from the in-scope list above.
2. **Apply** improvements incrementally — one concern at a time.
3. **Run the full test suite** after each significant change:
   ```
   bash planifest-framework/tests/run-tests.sh
   # or the appropriate full suite command for the stack
   ```
4. **Confirm ALL GREEN**: every test in the suite must pass, not just the current requirement's test. If any test breaks, revert the last change and try a different approach.
5. **Report** the refactor completion:
   ```
   REFACTOR ✓  req-{id}: refactor complete
               Changes: {list of improvements made}
               Full suite: {n} passed, 0 failed
   ```
