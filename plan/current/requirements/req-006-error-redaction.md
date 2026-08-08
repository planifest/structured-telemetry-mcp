---
title: "Requirement: req-006 - Error redaction with correlation ids"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-006 - Error redaction with correlation ids

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000019-loopback-daemon-hardening
**Source:** US-003
**Priority:** must-have

## User Story

As a security reviewer, I want error responses to carry a correlation id instead of engine text, so that no SQL fragment or stored value reaches a caller.

## Current defect

Three sites return the raw engine error to the caller:

| Site | Code |
|---|---|
| `src/server-http.ts:230` (`/query`) | `json(res, 400, { ok: false, errors: [\`query error: ${err}\`] })` |
| `src/server-http.ts:218` (`/emit`) | `json(res, 400, { ok: false, errors: [\`emit error: ${err}\`] })` |
| `src/server-factory.ts:204` (MCP `/query`) | `JSON.stringify({ ok: false, errors: [\`query error: ${err}\`] })` |

DuckDB binder errors embed the offending SQL statement. Conversion errors embed **stored row values** — a real `session_id` from the database was returned during the 0.13.0 assessment. The MCP site matters as much as the HTTP ones: it pushes the same leaked text straight into an agent's context.

## Functional Requirements

- No response body on any path ever contains engine text, a SQL fragment, a stack trace, or a value read from the database.
- Every error response carries a `correlationId` (UUID v4). The same id is written to stderr alongside the full error and stack, so a developer can trace a redacted client error to the server log.
- Status codes are separated by cause:
  - `400` — client input that failed validation. Names the offending field. Quotes no value.
  - `413` — body over cap (req-004).
  - `415` — wrong or missing `Content-Type` (req-003).
  - `403` — `Host`/`Origin` refusal (req-001, req-002).
  - `500` — engine or internal failure. Generic message plus `correlationId`, nothing else.
- The current behaviour of returning `400` for engine errors is wrong and must change: an engine failure is a `500`.
- Validation errors from `validateEvent` on `/emit` may continue to name fields and schema violations — those are the caller's own submitted structure, not stored data. They must not include the submitted values themselves.
- All three sites above are fixed together. Fixing only the HTTP pair leaves the MCP leak open.

## Acceptance Criteria

- [ ] `POST /query {"mode":"event_log","limit":"abc"}` returns a body containing **no** SQL fragment, no `LINE n:` text, and no DuckDB wording
- [ ] `POST /query {"mode":"event_log","session_id":123}` returns a body containing **no** stored `session_id` value — this is the exact case that leaked real data at 0.13.0
- [ ] The same two inputs over the MCP path leak nothing either
- [ ] Every error response includes a `correlationId`
- [ ] The same `correlationId` appears in the stderr log line for that request
- [ ] The stderr log line contains the full error and stack — redaction applies to the response only, never to the operator's log
- [ ] An engine failure returns `500`; a validation failure returns `400`
- [ ] A regression test asserts that for a deliberately type-confused filter, the response body matches none of: `SELECT`, `FROM`, `LINE `, `Binder Error`, `Conversion Error`, or any value present in the events table

## Dependencies

- req-005 supplies the structured field-level errors that make a `400` useful without quoting values.
- req-004's `413`/`400` bodies follow this requirement's shape.
- Observability: this requirement is the sole source of the correlation-id concept; see `operational-model.md`.

## Input Validation

- [ ] Input source: caught `Error` objects originating from DuckDB, the JSON parser, and the validation layer
- [ ] Allowed character pattern: not applicable — the rule is that **no** engine-derived string reaches the response, so there is no sanitisation pattern to apply, only suppression
- [ ] Maximum length: not applicable; response error text is a fixed generic string plus a UUID
- [ ] Failure behaviour: if correlation-id generation itself fails, still return a generic error — never fall back to returning the raw engine message
- [ ] Logging policy: full error and stack to stderr with the correlation id; the response carries the id alone
