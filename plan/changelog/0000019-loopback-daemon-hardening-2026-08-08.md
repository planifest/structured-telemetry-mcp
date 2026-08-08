# Changelog — 0000019-loopback-daemon-hardening — 08 Aug 2026

**Feature:** Loopback daemon hardening
**Pipeline run:** P0–P9 complete, no phases skipped
**PR:** https://github.com/planifest/structured-telemetry-mcp/pull/14

## What Was Built

Security hardening of the `structured-telemetry-mcp` loopback HTTP daemon
(`127.0.0.1:3741`) — the path both the log viewer and the stdio proxy use, which
was previously unguarded. Version 0.14.0 → 0.15.0. Single component, no schema
change. Twelve requirements folded from six post-0.13.0-review backlog entries
(00010–00014, 00020) plus a file-hygiene item.

- **Request boundary** (req-001–004): a `Host` allow-list closes DNS rebinding; a
  foreign-`Origin` rejection closes browser-mediated CSRF (an absent `Origin`
  still passes, so the non-browser stdio proxy and emission hooks are unaffected);
  `Content-Type: application/json` is required on writes, closing the CORS-simple
  no-preflight path; and a two-point request-body cap (a `Content-Length`
  pre-check plus a streaming byte counter that no chunked or forged-length request
  can bypass) plus a crash-safe `readBody` mean a single malformed request can no
  longer terminate the daemon via `uncaughtException`.
- **Error redaction** (req-006): DuckDB errors — which embedded SQL statements and
  real stored row values — are replaced by a generic message and a `correlationId`
  the operator can grep for in stderr, across all three leak sites (HTTP `/emit`,
  HTTP `/query`, and the MCP result path).
- **Shared query gate** (req-005): one validation definition, reused by the HTTP
  and MCP paths, with per-mode numeric ceilings. `distinct_values` changes from a
  silent clamp to an explicit rejection above its ceiling (a disclosed behaviour
  change).
- **Bounded reads** (req-007/008): `failure_sequence` and `drill_down` gain a row
  cap with additive `truncated`/`total_count`; the MCP tool-result text gets an
  independent character budget so a large result cannot flood an agent's context.
- **Test integrity** (req-009/010/011): genuine injection-shaped input is now
  exercised against the SQL-identifier allow-list, and XSS payloads are rendered
  in a real browser and asserted not to execute — each verified with a real
  RED-before-GREEN weakening cycle. `test-coverage.md`'s previously-unbacked
  "injection-shaped input rejected" claim is corrected.
- **File hygiene** (req-012): `*.local-only.*` is now gitignored and the two files
  that carried the convention in name but were tracked anyway are untracked.

## Artifacts Produced

`design.md`, `discovery.md`, `feature-brief.md`, twelve `requirements/req-0NN-*.md`,
`execution-plan.md`, `scope.md`, `risk-register.md`, `domain-glossary.md`,
`openapi-spec.yaml`, `operational-model.md`, `slo-definitions.md`, `cost-model.md`,
`adr/ADR-032-caller-provenance-without-shared-secret.md`, `security-report.md`,
`build-log.md`.

## Decisions

- **ADR-032 — Caller provenance without a shared secret:** the daemon adds
  `Host`/`Origin`/`Content-Type` provenance checks and deliberately **no** shared
  secret. A token in `~/.planifest/` defends only against browser pages the three
  checks already fully exclude, while giving nothing against a same-user process
  that can read `telemetry.db` off disk. Narrows, not removes, `component.yml`'s
  earlier "no auth model required" position.

## Security

Risk **Low**, no blockers. 0 Critical, 0 High. One Medium (pre-existing npm-audit
debt, off the request path — backlog 00030) and two Low (a fail-safe
prototype-chain lookup; an invalid identifier returning a redacted 500 rather than
a field-named 400 — backlog 00031). All eight verification targets confirmed
sound.

## Skipped Phases

None.
