---
title: "Backlog Entry: 00013 - Unbounded request body kills the daemon (remote DoS)"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "high"
---
# Backlog Entry: 00013 - Unbounded request body kills the daemon (remote DoS)

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

`readBody` (`src/server-http.ts:65-72`) buffers the entire request body with no `Content-Length`
check, no byte cap, and no socket timeout. Two independent kill paths:

- `Buffer.concat(chunks).toString('utf8')` (line 69) throws `ERR_STRING_TOO_LONG` above
  `buffer.constants.MAX_STRING_LENGTH`; `Buffer.concat` itself throws above `MAX_LENGTH`.
- Before either, unbounded RSS growth reaches a V8 OOM abort.

The critical detail is **where** that throw happens. Line 69 executes inside the `req.on('end', ...)`
listener, not inside the promise executor's synchronous body. A throw there does **not** reject the
promise and is **not** caught by the `try` at line 121. It reaches `uncaughtException`
(`server-http.ts:51-54`), which calls `process.exit(1)`.

Reproduced:

```
UNCAUGHT_EXCEPTION reached: Cannot create a string longer than 0x1fffffe8 characters
=> throw in end-listener escaped try/catch AND reached uncaughtException: true
```

Failure scenario: `curl -X POST http://127.0.0.1:3741/query --data-binary @2.5GB.bin`. The daemon
exits; every stdio MCP server forwarding through `HttpQueryService` / `HttpEventRepository` fails
until someone restarts it. Over loopback this takes seconds. Combined with
[[00012-http-daemon-no-auth-or-origin-check]] it is reachable from any web page the developer visits.

Worse, under launchd `KeepAlive` the exit produces a restart, and per
[[00008-daemon-durability-unreplayable-wal]] an unclean exit is exactly the condition that can strand
data in an unreplayable WAL.

## Suggested Action

1. Reject early when `Content-Length` exceeds a cap (a few MB is generous for this API).
2. Count bytes in the `data` handler and `req.destroy()` once the cap is exceeded, so a chunked request
   with no/forged `Content-Length` cannot bypass step 1.
3. Wrap the `end` handler body in `try/catch` and `reject(err)`, so parse/allocation failures surface
   as a normal rejected promise the existing `try` can handle.
4. Set a socket/request timeout so a slow-loris style body cannot hold a connection open indefinitely.
5. Separately, reconsider `uncaughtException -> process.exit(1)` (see
   [[00008-daemon-durability-unreplayable-wal]]) — a single malformed request should never be able to
   terminate the process.

Regression test: post a body over the cap and assert the daemon returns `413` and is **still alive**
afterwards.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. Small and self-contained;
sits naturally alongside [[00010-query-parameter-validation-gaps]] and
[[00011-query-errors-leak-sql-and-data]] as one HTTP-boundary hardening change.
