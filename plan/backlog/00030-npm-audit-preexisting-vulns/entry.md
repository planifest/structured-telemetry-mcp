---
title: "Backlog Entry: 00030 - Pre-existing npm audit vulnerabilities"
summary: "A discovered-but-out-of-scope item deferred for pickup at a future P0."
status: "open"
severity: "medium"
---
# Backlog Entry: 00030 - Pre-existing npm audit vulnerabilities

**Source feature:** 0000019-loopback-daemon-hardening
**Source phase:** P5 (security review, finding M1)

**Date filed:** 2026-08-08

---

## Problem

`npm audit` reports 6 production / 9 total advisories. The P5 security review of
0000019 confirmed these are **not introduced by this feature** and are **not on
the loopback daemon's request path** — so they did not block the 0000019 ship —
but they remain outstanding dependency debt.

## Suggested Action

- Run `npm audit` to enumerate the current advisories and their transitive paths.
- Apply `npm audit fix` where it is non-breaking; for any that require a major
  bump, weigh against `planifest-framework/standards/library-standards/_version-policy.md`.
- Re-run the full suite (545 Vitest + 25 E2E) after any dependency change.

## Why Deferred

Not attributable to 0000019 and off the request path, so out of this feature's
scope. A dependency-hygiene pass is its own small change (Change Pipeline or a
dependency-bump fast path), not something to fold into a security-hardening
feature at ship time.
