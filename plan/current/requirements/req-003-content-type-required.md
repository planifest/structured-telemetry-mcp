---
title: "Requirement: req-003 - Content-Type required on writes"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-003 - Content-Type required on writes

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000019-loopback-daemon-hardening
**Source:** US-006
**Priority:** must-have

## User Story

As a developer, I want `Content-Type: application/json` required on writes, so that the CORS-simple no-preflight loophole is closed.

## Functional Requirements

- `POST /emit` and `POST /query` require a `Content-Type` whose media type is exactly `application/json`.
- Parameters are tolerated and ignored: `application/json; charset=utf-8` is accepted. Comparison is on the media type only, lowercased, with surrounding whitespace trimmed.
- Any other media type — notably the three CORS-simple types `text/plain`, `application/x-www-form-urlencoded`, `multipart/form-data` — is refused with `415`.
- A missing `Content-Type` on a POST is refused with `415`.
- `GET /health` and `GET /ui` are unaffected — they carry no request body.
- The check runs before body reading.

**Why this closes the loophole:** the three CORS-simple content types are the only ones a cross-origin `fetch` can send without triggering a preflight. Requiring `application/json` forces a preflight the daemon then declines, so a forged write cannot reach the handler even if `Origin` were somehow absent.

## Acceptance Criteria

- [ ] `POST /emit` with `Content-Type: text/plain` is refused with `415` and no event is written
- [ ] `POST /emit` with `Content-Type: application/x-www-form-urlencoded` is refused with `415`
- [ ] `POST /emit` with no `Content-Type` is refused with `415`
- [ ] `POST /emit` with `application/json` succeeds
- [ ] `POST /emit` with `application/json; charset=utf-8` succeeds
- [ ] `POST /emit` with `APPLICATION/JSON` succeeds (case-insensitive media type)
- [ ] `POST /query` behaves identically on all of the above
- [ ] `GET /health` and `GET /ui` succeed with no `Content-Type` header
- [ ] All three framework telemetry hooks, the stdio proxy and the log viewer continue to work unmodified

## Dependencies

- One integrated pass with req-001, req-002, req-004 (design R-002).
- P0 verification that every legitimate caller already sends this header: `emit-phase-start.mjs:219`, `emit-phase-end.mjs:208`, `context-pressure.mjs:235`, `src/http-query-service.ts:42`, `src/http-repo.ts:16`, `src/ui/index-html.ts:258`. **No client change is required by this requirement** — if P3 finds a caller that would break, that is a signal the P0 verification was incomplete and must be reported, not patched around.

## Input Validation

- [ ] Input source: `Content-Type` request header (`req.headers['content-type']`)
- [ ] Allowed character pattern: media type must equal `application/json` after lowercasing, trimming, and discarding everything from the first `;`
- [ ] Maximum length: 255 characters — longer values refused, not truncated
- [ ] Failure behaviour: respond `415` with `{ok:false, errors:[{field:"content-type", message:"..."}]}` and end the response
- [ ] Logging policy: the raw rejected value is written to stderr only, never echoed into the response body
