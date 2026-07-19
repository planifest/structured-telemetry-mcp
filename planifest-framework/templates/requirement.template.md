---
title: "Requirement: {{req-id}} - {{feature-name}}"
summary: "Detailed requirements for this specific functional feature."
status: "draft | active"
version: "0.1.0"
---
# Requirement: {{req-id}} - {{feature-name}}

**Skill:** [spec-agent](../skills/planifest-spec-agent/SKILL.md)
**Feature:** {{feature-id}}
**Source:** {{user story ID from design.md — e.g. US-001}}
**Priority:** must-have | should-have

---

## User Story

> One requirement doc = one user story. If this story implies more than 3 acceptance criteria, split it into two requirement docs.

As a [role], I [action], so that [outcome].

---

## Functional Requirements
- {{specific, testable requirement 1}}
- {{specific, testable requirement 2}}

## Acceptance Criteria
- [ ] {{criterion 1}}
- [ ] {{criterion 2}}

## Dependencies
- {{Any other components or requirements this depends on}}

<!-- INPUT VALIDATION — CONDITIONAL SECTION
     Include this section ONLY when the requirement reads content from an untrusted
     source (filesystem, hook stdin, environment variables, HTTP response, user input)
     AND uses that content in output visible to the model or user (banners, logs,
     displayed text, model context injection).
     
     If this requirement does not involve untrusted external input, delete this section.
     
     EXAMPLE (featureId read from a sentinel file, interpolated into a hook banner):
     
     ## Input Validation
     - [ ] Input source: filesystem read of `plan/.orchestrator-active`
     - [ ] Allowed characters: `[a-zA-Z0-9\-_.]` only — all other characters stripped
     - [ ] Maximum length: 80 characters — content beyond this limit is truncated
     - [ ] Failure behaviour: on read error or empty result, substitute default value `"unknown"` — do not halt
     - [ ] Logging policy: raw value is not logged; only the sanitised value appears in output
-->

## Input Validation

<!-- conditional: only include when this requirement reads untrusted external content into displayed or injected output. Delete if not applicable. -->

- [ ] Input source: {{filesystem path | hook stdin field | env var name | other}}
- [ ] Allowed character pattern: `{{e.g. [a-zA-Z0-9\-_.]}}` — all other characters stripped before use
- [ ] maximum length: {{N}} characters — content beyond this limit is truncated
- [ ] Failure behaviour: {{e.g. substitute default value "unknown" and continue | exit with code 0 | throw error}}
- [ ] Logging policy: {{raw value not logged | raw value logged at debug level only | sanitised value only in output}}

