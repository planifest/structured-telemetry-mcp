---
title: "Requirement: req-001 - Host header allow-list"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-001 - Host header allow-list

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000019-loopback-daemon-hardening
**Source:** US-005
**Priority:** must-have

## User Story

As a developer, I want `Host` validated, so that a rebound DNS name cannot read my telemetry.

## Functional Requirements

- Every request to the daemon — `GET /health`, `GET /ui`, `POST /emit`, `POST /query`, and the 404 fallthrough — is checked against a `Host` allow-list before any route handler runs.
- The allow-list accepts exactly `127.0.0.1:<PORT>` and `localhost:<PORT>`, where `<PORT>` is the daemon's actual listening port (`PLANIFEST_MCP_PORT`, default 3741).
- A request whose `Host` header is absent, malformed, or not on the allow-list is refused with `403` and a structured body naming `host` as the offending field. It carries no correlation id, because nothing was executed and there is nothing to trace.
- The check runs before body reading, so a rejected request never buffers a byte.
- Port comparison uses the *actual bound port* reported by `server.address()`, not the configured `PORT` constant, so an ephemeral-port test harness (`port 0`, per 0000016 R-002) is not locked out.

## Test corpus

**Refused:** `evil.example.com`, `127.0.0.1:<wrong-port>`, `localhost:<wrong-port>`, absent header, `127.0.0.1.evil.com`, `127.0.0.1:<PORT>.` (trailing dot), a value over 255 characters.
**Accepted:** `127.0.0.1:<actual-port>`, `localhost:<actual-port>`.
Applied across all five routes: `/health`, `/ui`, `/emit`, `/query`, and the 404 fallthrough.

## Acceptance Criteria

- [ ] Every refused-corpus value yields `403` on every one of the five routes, and `readBody` is never entered on that path
- [ ] Every accepted-corpus value routes normally on every route, including against a server bound on an ephemeral port via `port 0`
- [ ] The refusal body names `host`, carries no correlation id, and contains no SQL, stored data, or engine text

## Dependencies

- Must land as one integrated pass with req-002, req-003 and req-004 — all four edit the same request-entry path in `src/server-http.ts` (design R-002).
- **ADR-032 accepted** (P2, 2026-08-08) — this reverses `component.yml`'s documented "no auth model required" position under `breakingChangePolicy: requires-adr`. The decision is settled; this requirement's code is what P3 lands to make it real.

## Input Validation

- [ ] Input source: `Host` request header (`req.headers.host`)
- [ ] Allowed character pattern: must match `^(127\.0\.0\.1|localhost):<actual-port>$` exactly — no normalisation, no case-insensitive host matching beyond the literal two values, no trailing-dot acceptance
- [ ] Maximum length: 255 characters — a longer value is refused outright rather than truncated, since truncation could turn a disallowed host into an allowed prefix
- [ ] Failure behaviour: respond `403` with `{ok:false, errors:[{field:"host", message:"..."}]}` and end the response; never continue to a handler
- [ ] Logging policy: the raw rejected `Host` value is written to stderr only, never echoed into the response body
