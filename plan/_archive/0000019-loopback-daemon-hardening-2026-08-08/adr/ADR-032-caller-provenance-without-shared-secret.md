---
title: "ADR 032: Caller Provenance Without a Shared Secret"
summary: "The loopback daemon gains Host allow-listing, Origin rejection, and a Content-Type requirement to close browser-mediated attacks, deliberately without a shared-secret credential — superseding component.yml's 'no auth model required' position, which was reasoned against a threat model this ADR does not share."
status: "accepted"
version: "0.1.0"
---
# ADR-032 - Caller Provenance Without a Shared Secret

**Skill:** [adr-agent](../skills/adr-agent-SKILL.md)
**Feature:** 0000019-loopback-daemon-hardening
**Component:** structured-telemetry-mcp
**Date:** 2026-08-08

## Context

`src/structured-telemetry-mcp/component.yml` has documented since 0000015: *"Does not authenticate callers — bound to 127.0.0.1, no auth model required, including for the new UI."* `component.yml`'s `contract.breakingChangePolicy` is `requires-adr`, so any reversal of that position needs an ADR before it lands — this is that ADR.

That original position was reasoned against a **multi-user** threat model: `scope.md`'s existing deferred item reads *"Authentication / multi-user UI access — blocked on: a need to run this for more than one person."* It is still correct on its own terms. What it did not consider is a **browser-mediated** threat: the daemon binds to `127.0.0.1`, but the developer's own browser sits inside that trust boundary. A page visited in the same browser that has `GET /ui` open can issue requests to the daemon, and `127.0.0.1` binding provides no defence against that — the request originates from localhost regardless of what page constructed it.

Two attacks follow directly, both reproduced during a post-0.13.0 review and filed as backlog 00012:

- **CSRF write.** `fetch('http://127.0.0.1:3741/emit', {method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain'}, body:'...'})` from any page the developer's browser visits. `text/plain` is a CORS-simple content type, so no preflight fires and no consent is required — the request proceeds and forged telemetry lands in `~/.planifest/telemetry.db`.
- **DNS rebinding read.** With no `Host` validation, an attacker-controlled domain that re-resolves to `127.0.0.1` becomes same-origin with the daemon in the browser's eyes, making `/query` responses — including whatever the framework writes into `data`: file paths, error strings, prompt and ADR fragments — fully readable.

This ADR decides two things together, because they were evaluated as one trade-off at P0's Scope Lock Challenge: **what to check**, and **whether to add a credential**.

## Decision

The daemon adds three provenance checks, applied before routing and before the request body is read:

1. **`Host` allow-list.** Accepts only `127.0.0.1:<port>` or `localhost:<port>`, compared against the daemon's actually-bound port. Closes DNS rebinding completely — a rebound domain can never present an allow-listed `Host`.
2. **`Origin` rejection.** A request carrying an `Origin` header that is not the daemon's own is refused. A request with **no** `Origin` header is accepted. This is the load-bearing asymmetry: the stdio proxy (ADR-009) and the Planifest emission hooks are non-browser HTTP clients and send no `Origin` at all, while every browser — including one mounting the CSRF attack above — always sends one on a cross-origin request.
3. **`Content-Type: application/json` required on writes.** Closes the specific no-preflight path the CSRF example exploits: the three CORS-simple content types (`text/plain`, `application/x-www-form-urlencoded`, `multipart/form-data`) are refused, forcing any cross-origin write attempt into a preflight the daemon then declines via check 2.

**No shared secret is added.** A token written to `~/.planifest/` at install time and required as a request header was considered (backlog 00012, suggested action 4) and is deliberately not adopted. The reasoning is in the Alternatives table below; in short, the token defends against exactly the same attacker the three checks above already fully exclude, while doing nothing against a different local process that can simply read `telemetry.db` off disk.

This narrows, rather than removes, `component.yml`'s original claim. The daemon still authenticates no credential — no token, password, or key, and this ADR does not introduce one. What changes is that caller **provenance** is now checked. Multi-user access control remains explicitly out of scope and unaffected: there is still exactly one local user, and this ADR does not attempt to distinguish between humans.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Status quo — no checks at all | Zero implementation cost; matches the original 0000015 reasoning | Leaves the CSRF write and DNS-rebinding read fully open; the original reasoning never considered a browser-mediated attacker, so "no need" was never actually evaluated against this threat | The threat is real, reproduced, and cheap to close — declining to close it is not a neutral default, it is an unexamined gap |
| Host/Origin/Content-Type checks, no shared secret (chosen) | Closes both reproduced attacks completely; zero friction for the stdio proxy and emission hooks, which send no `Origin`; no secret-provisioning, rotation, or storage problem; the static `/ui` page has no secret store to begin with (ADR-018) | Does not defend against a different local process on the same machine that can read requests or forge them without going through a browser | The excluded threat (a hostile local process) is not the threat this ADR addresses, and a shared secret would not close it either — see the next row |
| Checks plus a local shared secret (backlog 00012 action 4) | Defence-in-depth; a second, independent barrier if one check has a bug | A token at `~/.planifest/`, however permissioned, is readable by the same OS user that owns `telemetry.db` — a hostile process running as that user reads the database file directly and never needs the token at all. The token adds real cost — the stdio proxy and every emission hook must read and send it, and the static `/ui` page has nowhere to store a secret except injected into the served HTML, where any future same-origin XSS recovers it — for a threat it does not close | The token's defended threat model (a co-resident hostile process) already has unrestricted filesystem access to the asset the token is meant to protect. It adds friction and a new leak surface without closing a gap the other three checks leave open |
| Full multi-user authentication (login, sessions, per-user tokens) | Would also address a future multi-user access scenario | Solves a problem this feature does not have — one local developer, one local daemon — and was already correctly deferred at 0000015 pending "a need to run this for more than one person" | Out of scope; conflating it with the browser-mediated threat here is exactly the mistake this ADR's Context section identifies and corrects |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | `src/server-http.ts` gains the three checks ahead of every route handler (req-001, req-002, req-003). `component.yml`'s `exceptions` block is revised to state the narrowed claim once this ADR is accepted — not before (see Consequences). No other component is affected; the stdio proxy, the Planifest emission hooks, and the log viewer itself all require no code change, since every one of them already sends no foreign `Origin` and already sends `Content-Type: application/json` (verified at P0 and cited in full by req-002 and req-003's own Dependencies: `emit-phase-start.mjs:219`, `emit-phase-end.mjs:208`, `context-pressure.mjs:235`, `http-query-service.ts:42`, `http-repo.ts:16`, `src/ui/index-html.ts:258`) |

## Consequences

**Positive:**
- Closes both reproduced attacks (CSRF write, DNS-rebinding read) completely, using checks that cost a header comparison per request and add no persistent state, no provisioning step, and no secret-rotation problem.
- Every verified legitimate caller — the stdio proxy, the three emission hooks, and the log viewer itself — continues to work with no code change on the client side.

**Negative:**
- `component.yml`'s exceptions entry becomes more nuanced than the single line it replaces: "no credential-based authentication, but caller provenance is checked" is a harder claim to state briefly than "no auth model required," and a future reader skimming only the summary line risks missing the distinction this ADR exists to draw.
- The decision not to add a shared secret means a genuinely hostile **local** process — one running as the same OS user, with no browser involved — is unaffected by any of this feature's changes. That was true before this ADR and remains true after it; this ADR does not claim otherwise, but it is worth stating plainly rather than leaving implicit.

**Risks:**
- If a future legitimate client is added that *does* need to send a browser-style `Origin` header (for example, a future in-browser integration hosted on a different origin), the Origin-rejection check as specified would refuse it, and that client would need an explicit exception rather than the checks being loosened wholesale. Mitigated by req-002 documenting the exact accepted/refused corpus, so extending the allow-list later is a scoped, reviewable change rather than a reopening of this ADR's reasoning.
- The `Host` check's correctness depends on comparing against the daemon's actually-bound port (`server.address()`) rather than the configured `PORT` constant; getting this wrong would lock out the ephemeral-port E2E test harness (0000016 R-002, port 0). Mitigated by req-001 stating this explicitly with a dedicated acceptance criterion (design R-008).

## Related ADRs

- ADR-009 (0000008) - depends-on (the stdio proxy's HTTP-over-stdio design is what makes the no-`Origin`-header case a real, load-bearing client rather than an edge case)
- ADR-018 (0000015) - related-to (the static `/ui` page's lack of a secret store is part of why a shared secret was rejected in the Alternatives table)
- ADR-024 (0000017) - related-to (a different provenance problem — identifier allow-listing against SQL injection — solved by a similar allow-list mechanism, not by this ADR)

## Supersedes

- The `component.yml` exceptions entry originally written at 0000015: *"Does not authenticate callers — bound to 127.0.0.1, no auth model required, including for the new UI."* That entry is revised once this ADR is accepted to state the narrowed position from the Decision section above.

## Superseded By

None.
