---
title: "ADR 030: Refuse-to-Start Exits Zero"
summary: "The daemon exits with code 0 when it refuses to start due to an unusable database (locked or unreplayable WAL) — matching planifest-framework's own ADR-005 (0000003) hook precedent, and mechanically correct against both platforms' current supervision configs, which already restart-on-non-zero-only."
status: "accepted"
version: "0.1.0"
---
# ADR-030 - Refuse-to-Start Exits Zero

**Skill:** [adr-agent](../skills/adr-agent-SKILL.md)
**Feature:** 0000018-telemetry-data-integrity
**Component:** structured-telemetry-mcp
**Date:** 2026-08-08

## Context

design.md flagged this explicitly: "requires an ADR at P2 resolving whether ADR-005's exit-zero principle extends from hooks to a supervised daemon" (risk-register.md R-005; execution-plan.md Q-002). That reference is to **`planifest-framework`'s own ADR-005** (framework feature 0000003) — "hooks must never block the session or exit non-zero, regardless of emission outcome" (`planifest-framework/standards/telemetry-standards.md:34`) — a decision about short-lived enforcement hook scripts, **not** this product's own ADR-005 (`docs/decisions-index.md`: "Schema Validation Strategy"), which is an unrelated decision in a different numbering sequence. This ADR resolves whether that framework hook principle should also govern the daemon's refuse-to-start exit code.

Reading the actual supervision configs this feature touches (confirmed against source, not assumed):

- **macOS** (`scripts/service-macos.sh:177-180`): `KeepAlive → SuccessfulExit: false`. Per `launchd.plist(5)`, this key means launchd restarts the job **only when its previous exit was unsuccessful** (non-zero) — a clean `exit(0)` is treated as an intentional stop and is *not* respawned.
- **Linux** (`scripts/service-linux.sh:117`): `Restart=on-failure`. Per `systemd.service(5)`, this restarts the unit **only** on a non-zero exit code, an uncaught signal, or a timeout — a clean `exit(0)` is *not* restarted.

Both platforms' existing configs, read correctly, already key their restart decision off exit code in the same direction: **restart on failure, not on a clean exit.** This means the 2026-08-03 crash loop was not caused by a supervision misconfiguration — it was caused by the daemon *not* exiting cleanly (an uncaught exception or non-zero exit) on the unopenable-database condition, which both `SuccessfulExit: false` and `Restart=on-failure` correctly interpreted as "this failed, try again."

This reframes decision C from P0 ("supervision configuration changes... because 'refuse to start' is unachievable from the daemon's exit code alone") — the exit code is not merely relevant, it is the primary mechanism both platforms already rely on, provided it is used correctly.

## Decision

The daemon exits with code **0** when req-004's refuse-to-start check determines the store is genuinely unusable (locked, or an unreplayable WAL). This is deliberate, not a fallback: it signals "intentionally stopped," which both `KeepAlive.SuccessfulExit: false` (macOS) and `Restart=on-failure` (Linux) already correctly interpret as "do not respawn," with **no plist or unit change required for this specific mechanism to work**.

This is consistent with — not merely borrowed from — `planifest-framework`'s ADR-005 hook precedent: both cases use exit-zero to mean "this process is not going to do more work right now, and that is by design, not a crash."

req-005's supervision-config additions (launchd `ThrottleInterval`; systemd `StartLimitIntervalSec`/`StartLimitBurst`) remain in scope per decision C, but are re-scoped by this ADR from *primary mechanism* to **defense-in-depth**: they bound the damage if some other, unrelated code path in the daemon exits non-zero or crashes on the same class of condition (e.g. a future change accidentally throws instead of calling the clean-exit path). Decision C's confirmed deliverable — the plist/unit changes — is unchanged; only the story of *why* they matter is corrected.

A genuine runtime error while serving (distinct from refuse-to-start) keeps its existing non-zero/crash behavior — this ADR narrows only the specific "unusable store at startup" path.

## Alternatives Considered

| Alternative | Pros | Cons | Why Rejected |
|-------------|------|------|-------------|
| Exit non-zero on refuse-to-start | Conventional "something is wrong" signal; some monitoring tooling expects non-zero for failure states | Both `SuccessfulExit: false` and `Restart=on-failure` interpret a non-zero exit as "try again" — this would keep the daemon looping under both platforms' current, unmodified configs, reproducing the exact incident this feature exists to prevent | Mechanically wrong given the actual supervision semantics in this codebase today |
| Exit zero (chosen) | Matches both platforms' existing restart conditions with no config change needed for this mechanism; consistent with the framework's own established exit-zero-for-intentional-stop precedent (ADR-005, 0000003) | A future maintainer unfamiliar with `SuccessfulExit`/`Restart=on-failure` semantics could misread "exit 0" as "success," obscuring that a real problem occurred | The tradeoff is a documentation/comment burden (addressed by req-004's diagnostic message and this ADR itself), not a functional one |

## Affected Components

| Component | Impact |
|-----------|--------|
| structured-telemetry-mcp | The daemon's startup exit path (req-004) must call `process.exit(0)` on refuse-to-start, not throw or exit non-zero |

## Consequences

**Positive:**
- Achieves "stay stopped, no restart loop" using the exit code alone, with the existing plist/unit `SuccessfulExit`/`Restart=on-failure` settings, on both platforms, without requiring those settings to change.
- Consistent with the framework's own precedent for what exit-zero means in this codebase's supervision context, rather than introducing a second, conflicting convention.

**Negative:**
- Exit-zero-as-failure is a nonstandard convention outside this codebase; any external monitoring that naively treats "exit 0" as "healthy" would be misled without reading req-004's printed diagnostic message.

**Risks:**
- If this ADR's reading of `launchd.plist(5)`/`systemd.service(5)` semantics is wrong, or launchd's undocumented default throttle behaves differently in practice, the daemon could still loop. Mitigated by req-005's throttle/circuit-breaker remaining in scope as defense-in-depth (this ADR re-scopes it, does not remove it), and by P4 validate-agent explicitly testing the respawn-count acceptance criterion under a real supervised install on both platforms, not just unit-testing the exit code in isolation.

## Related ADRs

- ADR-031-supervision-circuit-breaker-defense-in-depth - depends-on (this ADR determines what role the circuit-breaker plays)
- planifest-framework ADR-005 (0000003) - related-to (exit-zero-for-intentional-stop precedent; different numbering namespace from this product's own ADR-005)

## Supersedes

None. Amends the reasoning behind design.md's P0 decision C without reversing its deliverable.

## Superseded By

None.
