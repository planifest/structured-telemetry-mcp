---
title: "Backlog Entry: 00012 - Loopback daemon has no auth, Origin, or Host validation"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "high"
---
# Backlog Entry: 00012 - Loopback daemon has no auth, Origin, or Host validation

**Source feature:** post-0.13.0 release review
**Source phase:** assessment (not a pipeline phase)

**Date filed:** 2026-08-03

---

## Problem

`src/server-http.ts:86-133` performs no `Origin` check, no `Host` check, no `Content-Type` check, and
no authentication of any kind. Binding to `127.0.0.1` prevents remote network access but does **not**
protect against the browser-mediated attacks below, because the developer's own browser is inside the
trust boundary.

**CSRF (write).** Any page the developer visits while the daemon runs can issue:

```js
fetch('http://127.0.0.1:3741/emit', {
  method: 'POST', mode: 'no-cors',
  headers: { 'Content-Type': 'text/plain' },   // CORS-simple: no preflight, no consent
  body: '{ ...valid event envelope... }'
});
```

`text/plain` is a CORS-simple content type, so no preflight is sent and the request proceeds. Arbitrary
forged telemetry lands in `~/.planifest/telemetry.db`, corrupting the record that Planifest pipeline
decisions are based on. The same primitive delivers the DoS in
[[00013-unbounded-request-body-kills-daemon]] from a browser tab.

**DNS rebinding (read).** With no `Host` validation, an attacker-controlled domain that re-resolves to
`127.0.0.1` becomes same-origin with the daemon, making `/query` responses fully readable. That
exposes the entire telemetry store, including whatever the framework writes into `data` — file paths,
error strings, prompt and ADR fragments.

Verified by inspection: no occurrence of `Origin`, `Host`, `cors`, or any auth/token check anywhere in
`src/server-http.ts`.

## Suggested Action

Defence in depth, cheapest first — all are small and none require a protocol change:

1. **Validate `Host`.** Reject unless it is `127.0.0.1:<PORT>` or `localhost:<PORT>`. This alone closes
   DNS rebinding.
2. **Reject cross-origin.** If an `Origin` header is present and is not the server's own origin, refuse
   the request. Browsers always send `Origin` on cross-origin requests, including CORS-simple ones.
3. **Require `Content-Type: application/json`** on `/emit` and `/query`. This removes the CORS-simple
   loophole, forcing a preflight that the daemon can then decline.
4. **Consider a local shared secret** — a token written to `~/.planifest/` at install time, readable
   only by the owning user and required as a header. Web pages cannot read that file, so this closes
   the class rather than individual instances. Weigh against the friction it adds for the stdio MCP
   servers and the log viewer, both of which would need to send it.

Note that `/ui` is served by the same daemon, so the log viewer itself must keep working under
whichever scheme is chosen — it is same-origin, so (1)-(3) do not affect it.

## Why Deferred

Discovered during a post-0.13.0 assessment, not during a pipeline phase. This is a security-design
decision (particularly item 4) that warrants an ADR rather than an opportunistic patch, and it should
be reviewed by the security agent at P5 when picked up.
