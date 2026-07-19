# Recommendations - 0000010-macos-launchd-service

Suggested improvements for future iterations. Not blocking this feature's completion.

1. **Verify `scripts/service-linux.sh` on real systemd hardware before treating Phase 2 as fully done.** No Linux machine was available during implementation — the script was written directly from `plan/current/linux-systemd-reference.md`'s speculative design plus a careful read of `systemd --user` semantics. It's the single most important open item from this feature (risk-register R-002).

2. **Backfill the pre-existing README.md/data-contract.md event-payload documentation gap.** 12 event types added in `0000009-ship-phase-enum` were never documented in either file (surfaced by this feature's P4 traceability pass and P6 docs review, not caused by it). This feature adds its own 4 new types to both docs but doesn't backfill the older 12 — see `src/structured-telemetry-mcp/docs/tech-debt.md`.

3. **Consider XML/shell-escaping the interpolated paths in `scripts/service-macos.sh`'s `_generate_plist()` and the Linux unit's `ExecStart` line.** Flagged Low severity in `plan/current/security-report.md` — not exploitable by anyone but the local operator (a repo cloned into a path containing `&`/`<`/`>`/spaces would produce a malformed plist or unit file), but cheap to harden in a follow-up.

4. **Consider a shell-script test harness (e.g. `bats` or `shunit2`) for `scripts/service-*.sh` in a future iteration.** This feature's testing strategy for those scripts is manual verification only (per `plan/current/design.md`'s own declared stack), consistent with there being no existing shell-test convention in this repo — but as the service-script surface grows, automated coverage would catch regressions the current manual checklist can miss.

5. **Track the `@modelcontextprotocol/sdk` transitive-dependency advisories** (`hono`, `qs`, `ip-address` — 3 moderate, 2 high per `npm audit`) for a future SDK version bump. Unrelated to this feature's own code; not introduced by it.

6. **Re-run a `planifest-framework` pipeline phase with the fixed `emit_event` tool once this ships**, to close the R-009 loop for real (confirm `phase_start`/`phase_end`/`loop_iteration` actually land) rather than relying on this repo's own tests alone. This is explicitly a sibling-repo follow-up, out of scope for this repo's pipeline.

7. **`product.yml` was created ahead of the framework's own "2+ components" threshold**, at explicit human request. If this repo stays single-component long-term, consider whether maintaining both `product.yml` and `component.yml` in lockstep is worth the friction versus falling back to `component.yml` alone — revisit if it starts drifting.
