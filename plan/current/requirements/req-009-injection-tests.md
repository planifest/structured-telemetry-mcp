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

No test in `tests/unit/column-allow-list.test.ts` (45 lines, 5 tests) passes injection-shaped input. The rejection tests that exist elsewhere use benign identifiers (`'not_a_real_field'`, `'timestamp'`, `'data'`). Nothing anywhere passes a quote, a semicolon, a comment marker, or a prototype key.

**Exactly two of those five tests are tautological, and they must be named precisely — an earlier draft of this requirement got this wrong.** The type is `readonly AllowedEventColumnKey[]`, where `AllowedEventColumnKey = keyof typeof ALLOWED_EVENT_COLUMNS` covers all seven keys, every one of which is mapped to a defined value (`src/query/column-allow-list.ts:9-19`).

| Test | Lines | Can it fail? |
|---|---|---|
| `maps every key to a real events column name` | `:11-20` | **Yes** — asserts specific mappings |
| `SORTABLE_FIELDS is exactly the 6 table-displayed columns` | `:22-26` | **Yes** — swapping `product_id` for `initiative_id` typechecks cleanly and fails this test |
| `SUGGESTIBLE_FIELDS is exactly the 6 filterable form fields` | `:28-32` | **Yes** — same reasoning |
| `every SORTABLE_FIELDS entry resolves via ALLOWED_EVENT_COLUMNS` | `:34-38` | **No** — every `AllowedEventColumnKey` is by construction a defined key. Type-guaranteed |
| `every SUGGESTIBLE_FIELDS entry resolves via ALLOWED_EVENT_COLUMNS` | `:40-44` | **No** — same reasoning |

The tautological pair is `:34-38` and `:40-44`. The membership tests at `:22-26` and `:28-32` are real coverage and **must be kept**.

This matters because DuckDB has no parameterised-identifier binding (0000017 R-001) — the allow-list *is* the entire defence for these two inputs, and it currently has no test that can fail on the property that matters: whether a hostile value is rejected.

This matters because DuckDB has no parameterised-identifier binding (0000017 R-001) — the allow-list *is* the entire defence for these two inputs. It is the one control in the system with no test that can fail.

## Functional Requirements

- Add tests passing genuinely injection-shaped values to **both** `sortField` (`event_log`) and `field` (`distinct_values`), over both the HTTP and MCP paths.
- The corpus must include at minimum: `'` (single quote), `"` (double quote), `;`, `--`, `/* */`, `UNION SELECT`, a backtick, a newline, `timestamp; DROP TABLE events`, `constructor`, `__proto__`, and `prototype`.
- Each case asserts **both**: a structured rejection naming the field, and that the events table is byte-for-byte unchanged afterwards (row count and content).
- The prototype keys are not decoration. `constructor` and `__proto__` test that the allow-list check is not implemented as a bare `obj[key]` lookup against a plain object, which would return an inherited function and pass a naive truthiness test.
- Replace the two type-guaranteed tests — **`:34-38` and `:40-44` specifically, named in the table above** — with tests that can fail. Do not touch `:11-20`, `:22-26` or `:28-32`; those assert real membership and would catch a swapped allow-list entry.
- The rejection must occur **before any SQL is built** (ADR-024), not be caught downstream by DuckDB. Assert on the rejection path, not merely on the absence of damage.

## Acceptance Criteria

- [ ] Every corpus value is rejected for both `sortField` and `distinct_values.field`, on both the HTTP and MCP paths, before any SQL string is constructed — with each rejection naming the field and quoting no value, and the events table unchanged in row count and contents afterwards
- [ ] `constructor`, `__proto__` and `prototype` are among the rejected values, proving the check is not a bare property lookup against a plain object
- [ ] Tests `:34-38` and `:40-44` are replaced, `:11-20` / `:22-26` / `:28-32` are retained, and deliberately weakening the allow-list makes at least one new test fail — verified by a real RED-before-GREEN cycle per the precedent 0000018 set for its P5 fixes

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
