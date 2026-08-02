# Risk — structured-telemetry-mcp

Component-scoped view of the most recent feature's risk register (currently `plan/_archive/0000015-telemetry-log-viewer-ui-2026-08-01/risk-register.md`) plus carried-forward items from `component.yml`'s cumulative `risk.items` list. See those files for full likelihood/impact/mitigation detail.

## Open risks (as of 0.10.0)

| ID | Risk | Status |
|----|------|--------|
| R-002 | Linux systemd unit design untested on real hardware | **Open** — blocks calling Phase 2 (Linux service) fully done until verified on a real systemd distro |
| — | `express` missing from `package.json` dependencies — build fails if not present | Open (pre-existing, 0000008) |
| — | AJV recompilation — schema additions only active after daemon restart | Open (pre-existing, 0000008c) |

## Mitigated this feature (0000010)

- R-001 — locked `~/Library/LaunchAgents` on macOS: pre-flight write-test + explained sudo fallback, implemented in `scripts/service-macos.sh`.
- R-003 — `systemd --user` lingering disabled by default: post-install + `status` check with explicit warning, implemented in `scripts/service-linux.sh`.
- R-004 — 3-way schema/Zod/`EVENT_REQUIRED_DATA_FIELDS` drift: all three landed together in one commit; integration test asserts all 25 types round-trip.
- R-006 — version-manifest drift (`package.json` vs `component.yml` vs git tags): `component.yml`/`product.yml` established as the enforced source of truth.
- R-007 — node binary path not guaranteed across machines: resolved dynamically via `command -v node` (+ Homebrew fallbacks on macOS) at install time in both service scripts.

## Accepted (by design)

- R-005 — `emit_event` argument rename (`event`→`envelope`) is an intentional breaking change, reflected in the 0.10.0 version bump. No known callers outside `planifest-framework`, which is updated as a coordinated follow-up.

## Mitigated this feature (0000015)

- R-001 — `event_log`'s scope-filter check was enforced in two places (`event-log.ts` and `server-factory.ts`); resolved by removing the duplicate entirely rather than keeping two call sites in sync.
- R-004 — `product_id` migration approval blocking downstream work: resolved by sequencing the migration first and getting human approval before building the dependent query/UI work.

## Accepted (by design, 0000015)

- R-005 (this feature's numbering) — `product_id` values are absolute filesystem paths, which can reveal local usernames. Low risk given the existing no-auth/127.0.0.1-only posture; would need re-evaluation if that posture ever changes.
- R-006 — historical rows (and any row from an emitter not yet updated) permanently show `product_id` as "unknown" — no backfill is possible or attempted (ADR-017).
- R-007 (security review finding) — removing `event_log`'s mandatory scope filter lowers the effort to page through the whole table from "guess one of 25 known event types" to "one request." The actual trust boundary (no-auth, local-only) is unchanged; this is not a new access-control break, just less friction. Revisit if this server is ever exposed beyond localhost.

See `plan/_archive/0000015-telemetry-log-viewer-ui-2026-08-01/security-report.md` for the full STRIDE threat model — overall risk rating Low, one Medium finding (R-007 above), no Critical/High findings.
