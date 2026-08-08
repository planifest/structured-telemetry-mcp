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

## Mitigated this feature (0000017)

- R-001 — `sortField` (`event_log`) and `field` (`distinct_values`) are client-controlled values interpolated as SQL column identifiers, not bound values, and DuckDB has no parameterized-identifier binding — a SQL-injection-via-identifier vector. Mitigated by one shared, exported allow-list module (`src/query/column-allow-list.ts`, ADR-024) validated before any interpolation in both `event-log.ts` and the new `distinct-values.ts`; regression tests assert rejection of non-allow-listed/injection-shaped input on both.
- R-002 — all three requirements (auto-refresh, filter combobox, sortable headers) modify the same shared state-management functions in `src/ui/index-html.ts` (`readStateFromUrl`, `writeStateToUrl`, `applyStateToForm`, `readFormIntoFilters`, `FILTER_KEYS`); resolved by building the frontend as one integrated pass instead of parallel subagent edits (only the backend allow-list work was parallelized).

## Accepted (by design, 0000017)

- R-003 — filter-combobox suggestions for `product_id` show "unknown"/no suggestions for historical rows and any emitter not yet updated, until backlog #00002 lands; carried forward unchanged from 0000015's R-006. Combobox falls back to plain free-text entry when suggestions are empty.
- R-004 — poll-failure behavior during an active auto-refresh session was extended by inference from the pre-existing "degrade gracefully, never block" principle rather than being pre-confirmed scope; accepted by the human without a from-scratch confirmation. Implemented: last successful results stay visible (table never blanks), a small non-blocking failure indicator shows, and polling keeps retrying on the next interval.

Security review (P5) noted one Medium finding: `distinct_values` marginally eases enumeration of distinct field values, layered on 0000015's already-accepted no-auth/local-only Medium finding (R-007 above) — not a new exposure. Zero Critical/High findings overall.

## Mitigated this feature (0000018)

- R-001 (this feature's numbering) — backup ownership vs. DuckDB's single-writer lock: resolved by running the backup in-process on the daemon's own connection (ADR-029), never a second connection to `telemetry.db`.
- R-002 — `doctor`'s pre-existing write-test check already opens a second DuckDB connection, exposed to the same single-writer lock; backup-staleness reporting (req-007) avoids inheriting this by reading a sidecar JSON file instead of the live database.
- R-005 — refuse-to-start's exit posture: resolved by ADR-030, exiting zero, which both `launchd`'s `SuccessfulExit: false` and `systemd`'s `Restart=on-failure` already correctly interpret as "stay stopped" — no supervision config change was actually required for this specific mechanism, contrary to the initial P0 assumption. ADR-031 keeps the originally-scoped `ThrottleInterval`/`StartLimitBurst` config as defense-in-depth for unrelated crash loops.
- R-008 — `EXPORT DATABASE` format durability across DuckDB versions: decided via ADR-028 rather than left as an unconfirmed assumption; self-verifying in production since every backup includes a mandatory scratch-restore check.
- **Security review (P5) findings, both fixed same-day:** unescaped single-quote in the `EXPORT`/`IMPORT DATABASE` path literals (`src/backup/backup-service.ts` — CWE-88-adjacent, local-trust-boundary only), and no reentrancy guard on the backup timer (`src/server-http.ts`). Both verified fixed with real RED-before-GREEN test cycles, not just review — see `plan/_archive/0000018-telemetry-data-integrity-2026-08-08/security-report.md`. Overall security risk: Medium → Low same-day; zero Critical/High/Medium findings remain.

## Accepted (by design, 0000018)

- R-003 (this feature's numbering) — an operator can still destroy the WAL by hand despite the daemon never touching it itself; mitigated only by the startup message's wording and `docs/restore-procedure.md`'s explicit warning, not eliminable without an auto-copy-aside the human explicitly declined.
- R-004 — a machine whose database is already poisoned gets neither a running daemon nor scheduled backups until a human intervenes (decision D means the daemon refuses to start at all). Accepted as the cost of never silently switching a user's dataset.
- R-006 — events emitted while the daemon is down (refusing to start, or between deploy stop/start) are lost, not queued — client-side buffering is out of scope.
- R-009 — backup export duration was not empirically measured against production-realistic data volumes (only small test datasets). Not blocking at current scale (~15–20MB); tracked as a follow-up, filed to the backlog at P6 (see `plan/backlog/`).
