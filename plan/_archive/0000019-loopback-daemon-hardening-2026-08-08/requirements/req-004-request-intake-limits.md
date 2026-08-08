---
title: "Requirement: req-004 - Request intake limits and crash safety"
summary: "Detailed requirements for this specific functional feature."
status: "draft"
version: "0.1.0"
---
# Requirement: req-004 - Request intake limits and crash safety

**Skill:** [spec-agent](../../../planifest-framework/skills/planifest-spec-agent/SKILL.md)
**Feature:** 0000019-loopback-daemon-hardening
**Source:** US-001
**Priority:** must-have

## User Story

As an operator, I want malformed or oversized requests rejected with a structured error, so that a single bad request cannot terminate the daemon.

## Current defect (verified against the current tree, not the 0.13.0-era backlog line numbers)

`readBody` at `src/server-http.ts:166-173`:

```ts
req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
```

There is no `Content-Length` check, no byte cap, and no socket timeout. `Buffer.concat(...).toString('utf8')` throws `ERR_STRING_TOO_LONG` above `MAX_STRING_LENGTH`, and `Buffer.concat` itself throws above `MAX_LENGTH`. Critically that throw happens **inside the `end` listener**, not in the promise executor's synchronous body, so it neither rejects the promise nor is caught by the `try` at `:205` (`/emit`) or `:225` (`/query`). It reaches the `uncaughtException` handler at `:72-75`, which calls `process.exit(1)`. One request kills the daemon.

## Functional Requirements

- A maximum request body size is enforced. Default **4 MB**, overridable via `PLANIFEST_MAX_BODY_BYTES` for tests.
- **Two independent enforcement points, both required:**
  1. Reject before reading when `Content-Length` is present and exceeds the cap.
  2. Count bytes in the `data` handler and `req.destroy()` once the running total exceeds the cap — this is what catches a chunked request with absent or forged `Content-Length`. A `Content-Length`-only check is not sufficient and does not satisfy this requirement (design R-006).
- The body of the `end` listener is wrapped in `try/catch`; any throw calls `reject(err)` so it surfaces as a normal rejected promise the existing route-level `try` handles.
- A request/socket timeout is set so a slow-body ("slow loris") connection cannot hold a connection open indefinitely. Default **30 s**, overridable via `PLANIFEST_REQUEST_TIMEOUT_MS`.
- An over-cap request receives `413`; a body that is not valid JSON receives `400`. Neither terminates the process.
- The `uncaughtException` handler at `:72-75` is **left as-is**. This requirement stops the request path from reaching it; changing that handler's policy is explicitly out of scope.

## Test corpus

**Over-cap, three delivery shapes — each must be refused independently:** honest `Content-Length`; no `Content-Length` (chunked transfer); forged small `Content-Length` with an over-cap actual body. The second and third are what prove the streaming counter fires on its own; a `Content-Length`-only implementation passes the first and fails these two.
**Also in the fuzz corpus:** a body large enough to trigger `ERR_STRING_TOO_LONG` pre-fix, malformed JSON within the cap, a connection that sends headers then stalls, and a legitimate body just under the cap.

## Acceptance Criteria

- [ ] All three over-cap delivery shapes are refused with `413`, and a body just under the cap succeeds
- [ ] After **every** case in the fuzz corpus, `GET /health` still returns `200` — zero process exits, satisfying NFR-003. This is the requirement's headline criterion
- [ ] Malformed JSON within the cap returns `400` (not `500`, not an exit), and a stalled connection is closed by the timeout

## Dependencies

- One integrated pass with req-001, req-002, req-003 (design R-002). The header checks must run *before* this requirement's body reading, so ordering within the handler matters.
- req-006 (error redaction) governs the shape of the `413`/`400` bodies produced here.

## Input Validation

- [ ] Input source: HTTP request body stream, and the `Content-Length` request header
- [ ] Allowed character pattern: not applicable — the body is byte-counted, not pattern-matched; JSON validity is checked after the cap
- [ ] Maximum length: 4 MB default (`PLANIFEST_MAX_BODY_BYTES`); exceeded input causes `req.destroy()`, never truncate-and-continue, because a truncated JSON body could parse into a different valid document
- [ ] Failure behaviour: `413` for over-cap, `400` for unparseable within cap, both per req-006 including a `correlationId` (the request has already begun processing by this point, unlike a `403`); connection destroyed on over-cap; process must survive in every case
- [ ] Logging policy: byte count and remote address to stderr; the body content itself is never logged
