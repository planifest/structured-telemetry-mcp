---
title: "Backlog Entry: 00011 - Query error responses leak SQL text and stored row data"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "high"
---
# Backlog Entry: 00011 - Query error responses leak SQL text and stored row data

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

`src/server-http.ts:126` (and `:114` for `/emit`) returns the raw engine error to the caller:

```js
json(res, 400, { ok: false, errors: [`query error: ${err}`] });
```

DuckDB error messages embed the offending statement, and binder errors embed **stored row values**.
Both reproduced against a live 0.13.0 daemon:

```
POST /query {"mode":"event_log","limit":"abc"}
-> 400 {"ok":false,"errors":["query error: Error: Binder Error: Referenced column \"NaN\" was not
   found because the FROM clause is missing\n\nLINE 9:       LIMIT NaN\n ..."]}
```

```
POST /query {"mode":"event_log","session_id":123}
-> 400 "Conversion Error: Could not convert string '20654da2-5bf5-435f-90d1-a129a3291735' to INT32
   when casting from source column session_id\n\nLINE 7:  AND session_id = $session_id"
```

The second response contains a **real session_id from the database**. A type-confused filter is
therefore a primitive for reading stored values one at a time, and it also discloses the query
structure and schema.

This matters more than it would on a typical service because the daemon has no authentication or
origin checking (see [[00012-http-daemon-no-auth-or-origin-check]]): error bodies are readable in
cross-origin situations where full query results would not be, so this converts into a genuine
cross-origin read primitive rather than staying an information-disclosure nuisance.

## Suggested Action

- Log the full error (with stack) to stderr for operators.
- Return a generic body to the client: `{ok:false, errors:["query failed"], correlationId:"<uuid>"}`,
  and put the same correlation id in the server log so a developer can still trace it.
- Return `500` for engine/internal errors; reserve `400` for genuine client input errors, which should
  be caught by validation ([[00010-query-parameter-validation-gaps]]) and reported as a field-level
  message that names the field but quotes no data.
- Audit `/emit` (`server-http.ts:114`) for the same pattern.

Regression test: assert that a deliberately type-confused filter returns a response body containing
**no** SQL fragment and **no** value drawn from the events table.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. Should be scoped together
with [[00010-query-parameter-validation-gaps]] — same handler, same change, and proper validation
removes most of the paths that currently reach the leaking branch.
