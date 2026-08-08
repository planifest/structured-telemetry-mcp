---
title: "Requirement: req-002 - Cross-origin request rejection"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-002 - Cross-origin request rejection

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000019-loopback-daemon-hardening
**Source:** US-004
**Priority:** must-have

## User Story

As a developer, I want cross-origin requests refused, so that a page I visit cannot forge telemetry into my store.

## Functional Requirements

- When an `Origin` header is **present** and does not equal the daemon's own origin, the request is refused with `403` before any route handler runs.
- The daemon's own origin is `http://127.0.0.1:<actual-port>` or `http://localhost:<actual-port>`.
- When an `Origin` header is **absent**, the request proceeds. This is the load-bearing rule for ADR-009: the stdio proxy and the Planifest emission hooks are non-browser clients that send no `Origin`, and refusing them would silently stop telemetry (design R-001).
- No CORS response headers are added. The daemon does not opt in to cross-origin access; it refuses it. Adding `Access-Control-Allow-Origin` would defeat the requirement.
- The check runs before body reading.

## Acceptance Criteria

- [ ] A `fetch` from a page at `https://evil.example.com` to `POST /emit` is refused with `403` and **no event is written** — verified by asserting the events table row count is unchanged
- [ ] The same forged request using `Content-Type: text/plain` (the CORS-simple no-preflight path from backlog 00012) is refused
- [ ] A request with **no** `Origin` header succeeds — covering the stdio proxy and emission hooks
- [ ] A request with `Origin: http://127.0.0.1:<PORT>` succeeds — covering the log viewer's own `/query` calls
- [ ] `GET /ui` loads and its subsequent `/query` calls work end-to-end in the browser
- [ ] No `Access-Control-Allow-Origin` header appears on any response
- [ ] The refusal body names `origin` and leaks no SQL, stored data, or engine text

## Dependencies

- One integrated pass with req-001, req-003, req-004 (design R-002).
- ADR-032 (P2) accepted before implementation.
- Relies on the P0-verified fact that no legitimate caller sends a foreign `Origin`: the three framework hooks, `src/http-query-service.ts`, `src/http-repo.ts` and `src/ui/index-html.ts` are the complete set of in-repo callers.

## Input Validation

- [ ] Input source: `Origin` request header (`req.headers.origin`)
- [ ] Allowed character pattern: absent, or exactly `http://127.0.0.1:<actual-port>` / `http://localhost:<actual-port>` — no wildcard, no suffix matching, no `null` origin acceptance
- [ ] Maximum length: 255 characters — longer values refused, not truncated
- [ ] Failure behaviour: respond `403` with `{ok:false, errors:[{field:"origin", message:"..."}]}` and end the response
- [ ] Logging policy: the raw rejected `Origin` is written to stderr only, never echoed into the response body
