---
title: "Domain Glossary - 0000019-loopback-daemon-hardening"
summary: "Ubiquitous language for this feature - agents and humans use these terms."
---
# Domain Glossary - 0000019-loopback-daemon-hardening

Terms already established in this codebase are carried forward; new terms introduced by this feature are marked **new**.

## Carried forward

| Term | Meaning |
|---|---|
| **Daemon** | The single persistent backend process (`src/server-http.ts`) that owns the DuckDB connection and serves `/health`, `/emit`, `/query` and `/ui` on `127.0.0.1:3741` |
| **stdio proxy** | An MCP server speaking stdio to an agent tool that forwards `emit`/`query` calls to the daemon over HTTP (ADR-009). A non-browser client: sends no `Origin` header |
| **Log viewer** | The static, read-only browser page served at `GET /ui`, embedded as a template-literal string in `src/ui/index-html.ts` with no build step (ADR-018) |
| **Allow-list** | The fixed set of permitted column identifiers in `src/query/column-allow-list.ts` (`SORTABLE_FIELDS`, `SUGGESTIBLE_FIELDS`). DuckDB has no parameterised-identifier binding, so this is the sole defence for identifier-valued inputs (ADR-024, 0000017 R-001) |
| **MAX_LIMIT** | Not one number. Two module-local constants, neither exported: `src/query/event-log.ts:19` is 1000, `src/query/distinct-values.ts:20` is 20. The 1000 value is the ceiling this feature applies to the newly bounded modes. Exceeding a ceiling is a **rejection**, not a clamp (`event-log.ts:40-41` throws; `docs/usage-guide.md:667` documents it) |
| **Data-at-risk window** | Events written since the last WAL checkpoint — bounded to 60 seconds or 100 writes by 0000018. Lost on an unclean kill |
| **Refuse-to-start** | The daemon's behaviour when the database is locked or its WAL unreplayable: print the recovery procedure and exit 0, never touching the WAL (ADR-030) |
| **buildId** | SHA-256 fingerprint of `server-http.bundle.mjs`, exposed on `GET /health`, letting `deploy` detect a stale running daemon at an unchanged version string (0000018) |
| **Degrade-and-keep-serving** | The established failure posture for background work (checkpoint, backup): warn to stderr, never crash, never stop accepting writes |

## New in this feature

| Term | Meaning |
|---|---|
| **Request boundary** | The checks applied to an inbound HTTP request before any route handler runs: `Host`, `Origin`, `Content-Type`, and body size. The subject of this feature. Distinct from *validation*, which happens after a body is read and parsed |
| **Browser-mediated attack** | An attack in which the developer's own browser is the vehicle — a page they visit issues requests to the loopback daemon, which is inside the browser's trust boundary. The threat model this feature addresses. Explicitly **not** a multi-user access-control problem |
| **CORS-simple** | A request whose content type is `text/plain`, `application/x-www-form-urlencoded` or `multipart/form-data` — the only types a cross-origin `fetch` can send without triggering a preflight. Requiring `application/json` forces a preflight the daemon declines (req-003) |
| **DNS rebinding** | An attacker-controlled domain that re-resolves to `127.0.0.1`, becoming same-origin with the daemon and making `/query` responses readable. Closed by `Host` validation (req-001) |
| **Correlation id** | A UUID returned to the caller in place of engine text, written alongside the full error and stack to stderr, so a redacted client error remains traceable by an operator (req-006) |
| **Shared validation gate** | One validation definition applied to both the HTTP and MCP query paths, replacing today's arrangement where the MCP path checks `QueryShape` and the HTTP path checks nothing (req-005) |
| **Streaming byte counter** | Body-size enforcement counted in the `data` handler and terminated with `req.destroy()`, independent of `Content-Length` — the enforcement point that cannot be bypassed by a chunked or forged-length request (req-004) |
| **Text budget** | The character cap on assembled MCP tool-result text, distinct from the row cap on a query. Bounds what reaches an agent's context window rather than what reaches daemon memory (req-008) |
| **Tautological test** | An assertion that cannot fail while the code compiles. The genuine instances here are `column-allow-list.test.ts:34-38` and `:40-44`, which assert every entry of a `readonly AllowedEventColumnKey[]` resolves in `ALLOWED_EVENT_COLUMNS` — true by construction, since the type *is* that object's keys. Removed by req-009. Note the contrast with `:22-26` and `:28-32`, which look similar but compare membership against literal lists and would catch a swapped field; those are real coverage and are kept |
| **RED-before-GREEN verification** | Confirming a new test actually fails against broken behaviour by temporarily weakening the control, rather than only observing it pass. The precedent 0000018 set for its P5 security fixes; required by req-009 and req-010 |
| **Local-only file** | A working file matching `*.local-only.*` that is intended to stay on the developer's machine and never be committed (req-012) |

## Flagged for the human

No concept in this feature lacked a clear name. Two terms were deliberately chosen to prevent conflation rather than invented:

- **Request boundary** vs **validation** — the backlog entries used both loosely. Separating them matters because the boundary checks must run *before* body reading (req-001 to req-004) while validation necessarily runs after (req-005), and getting that order wrong reintroduces the DoS.
- **Browser-mediated attack** vs **authentication** — `component.yml` deferred "authentication / multi-user UI access" against a multi-user threat model. This feature addresses a different threat with the same-sounding vocabulary, which is precisely why ADR-032 must state what it supersedes and what it does not.
