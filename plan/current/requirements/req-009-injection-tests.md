---
title: "Requirement: req-009 - Injection tests that can actually fail"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-009 - Injection tests that can actually fail

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000019-loopback-daemon-hardening
**Source:** US-009
**Priority:** must-have

## User Story

As a security reviewer, I want injection-shaped input actually exercised against `sortField` and `distinct_values.field`, so that the allow-list claim is backed by a test.

## Current defect

`src/structured-telemetry-mcp/docs/test-coverage.md:38` claims `sortField` handles *"non-allow-listed/injection-shaped input rejected"*. Nothing in the suite passes injection-shaped input.

All five tests in `tests/unit/column-allow-list.test.ts` (45 lines) assert only that the allow-list constants contain the values they literally contain — for example *"SORTABLE_FIELDS is exactly the 6 table-displayed columns"*. Because `SORTABLE_FIELDS` is typed `readonly AllowedEventColumnKey[]`, those assertions cannot fail while TypeScript compiles. The rejection tests that do exist use benign identifiers (`'not_a_real_field'`, `'timestamp'`, `'data'`). No test anywhere passes a quote, a semicolon, a comment marker, or a prototype key.

This matters because DuckDB has no parameterised-identifier binding (0000017 R-001) — the allow-list *is* the entire defence for these two inputs. It is the one control in the system with no test that can fail.

## Functional Requirements

- Add tests passing genuinely injection-shaped values to **both** `sortField` (`event_log`) and `field` (`distinct_values`), over both the HTTP and MCP paths.
- The corpus must include at minimum: `'` (single quote), `"` (double quote), `;`, `--`, `/* */`, `UNION SELECT`, a backtick, a newline, `timestamp; DROP TABLE events`, `constructor`, `__proto__`, and `prototype`.
- Each case asserts **both**: a structured rejection naming the field, and that the events table is byte-for-byte unchanged afterwards (row count and content).
- The prototype keys are not decoration. `constructor` and `__proto__` test that the allow-list check is not implemented as a bare `obj[key]` lookup against a plain object, which would return an inherited function and pass a naive truthiness test.
- Replace the two tautological assertions in `column-allow-list.test.ts` with tests that can fail. Asserting a typed constant contains its own declared members is not coverage.
- The rejection must occur **before any SQL is built** (ADR-024), not be caught downstream by DuckDB. Assert on the rejection path, not merely on the absence of damage.

## Acceptance Criteria

- [ ] Every value in the corpus above is rejected for `sortField`, on both HTTP and MCP paths
- [ ] Every value in the corpus above is rejected for `distinct_values.field`, on both paths
- [ ] Each rejection names the offending field and quotes no value (per req-006)
- [ ] After the full corpus runs, the events table row count and contents are unchanged
- [ ] `constructor`, `__proto__` and `prototype` are each rejected — proving the check is not a bare property lookup
- [ ] The two tautological tests in `column-allow-list.test.ts` are gone, replaced by tests that fail if the allow-list is weakened
- [ ] Deliberately weakening the allow-list check makes at least one new test fail — verified by a real RED-before-GREEN cycle, matching the precedent 0000018 set for its P5 security fixes
- [ ] Rejection happens before SQL construction, not at the engine

## Dependencies

- ADR-024 defines the shared allow-list this requirement tests.
- req-006 governs the shape of the rejection body.
- req-011 corrects the `test-coverage.md` claim once these tests exist.

## Input Validation

- [ ] Input source: `sortField` on `event_log` queries and `field` on `distinct_values` queries, arriving via HTTP JSON body or MCP tool argument
- [ ] Allowed character pattern: membership in `SORTABLE_FIELDS` / `SUGGESTIBLE_FIELDS` respectively — an exact allow-list match, never a pattern or a denylist
- [ ] Maximum length: bounded implicitly by allow-list membership; any value not on the list is rejected regardless of length
- [ ] Failure behaviour: reject with `400` naming the field, before any SQL string is constructed
- [ ] Logging policy: the rejected identifier goes to stderr only, never into the response
