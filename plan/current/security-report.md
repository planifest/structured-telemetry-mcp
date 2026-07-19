# Security Report - 0000010-macos-launchd-service

**Component:** structured-telemetry-mcp
**Scope:** macOS/Linux background service scripts (`scripts/service-macos.sh`, `scripts/service-linux.sh`, `scripts/service-manager.mjs`) and the `emit_event` tool-argument schema fix (`schemas/telemetry-event.schema.json`, `src/types/events.ts`, `src/validation/validate-event.ts`, `src/server-factory.ts`).

---

## Threat Model (STRIDE)

| Threat | Category | Severity | Mitigation |
|---|---|---|---|
| A malformed/absent `RepoRoot`, `node_path`, or log-path value gets interpolated unescaped into the generated plist XML (`scripts/service-macos.sh` `_generate_plist()`, lines ~124-160) — a path containing `&`, `<`, or `>` would produce invalid XML | Tampering | Low | Not mitigated with XML-escaping. Low severity because these values are derived from the local filesystem (`$HOME`, the script's own resolved location, `command -v node`) under the operator's own control, not from any remote or attacker-supplied input — exploitation would require the developer to have already cloned the repo into a maliciously-crafted path, which is self-inflicted, not a remote attack vector. Recommend escaping (`&`→`&amp;` etc.) as a robustness fix, not urgent. |
| `scripts/service-linux.sh`'s generated unit file (`ExecStart=$node_path $repo_dir/server-http.bundle.mjs`, line 111) is not quoted — a repo path containing a space breaks systemd's `ExecStart` argument parsing | Tampering / DoS | Low | Self-inflicted denial-of-service (the developer's own service fails to start with a confusing error) if the repo is cloned into a space-containing path. Not attacker-exploitable. Recommend quoting `ExecStart=%s %s` targets with `%q`-style escaping or wrapping in a shell shim as a robustness fix. |
| A caller sends an `emit_event` argument that isn't a plain object (string, `null`, array, wrong nesting) | Tampering | **Mitigated** | `EmitEventEnvelope.safeParse()` (`src/server-factory.ts`) rejects all six reproduction shapes from the RCA spec before `validateEvent()`/ajv ever runs — confirmed by `tests/regression/emit-handler.test.ts`'s 7-case suite (A–F plus the old-shape rejection test). |
| A caller adds unexpected top-level keys to the `emit_event` envelope (parameter-pollution style, incl. `__proto__` as a top-level key) | Elevation of Privilege / Tampering | **Mitigated** | `EmitEventEnvelope` is `.strict()` — any key not in the declared shape (including `__proto__`) is rejected outright, not silently dropped or merged. |
| The install scripts encounter a locked `~/Library/LaunchAgents` (macOS) or a disabled `systemd --user` lingering setting (Linux) and silently escalate privileges or change account-wide settings without consent | Elevation of Privilege | **Mitigated** | Both scripts only ever *print* the exact `sudo`/`loginctl enable-linger` remediation commands for the human to run themselves (confirmed by direct read of `scripts/service-macos.sh` `check_launchagents_writable()` and `scripts/service-linux.sh` `print_lingering_warning()`) — neither auto-executes a privileged or persistent-setting-changing command. This is the core design decision recorded in ADR-014, and the implementation matches it. |
| A malicious `data` payload of unbounded size is sent to `emit_event`, consuming memory/disk | Denial of Service | Low | Not newly introduced — `data: z.record(z.string(), z.unknown())` has no size cap, same as the pre-existing `z.unknown()` behaviour it replaces (no regression). Pre-existing condition, out of this feature's scope; flagging for future consideration, not blocking. |
| `scripts/service-manager.mjs` passes `action` (from `process.argv[2]`) into `spawnSync` as an array element, not via shell string interpolation | Tampering (command injection) | **Not applicable / mitigated by design** | `spawnSync(cmd, [path, action], { stdio: 'inherit' })` never sets `shell: true` — arguments are passed directly to the child process without shell parsing, so no injection is possible via `action` regardless of its content. The downstream shell scripts themselves validate `action` against a fixed `case` statement and reject anything unrecognised. |
| Repudiation — no signing or per-caller identity on ingested events | Repudiation | Low | Pre-existing, unchanged posture (informal single-local-user trust boundary, no auth model) — carried forward from ADR-005/0000008, not a new gap introduced by this feature. |
| Information disclosure via Zod validation error messages returned to the caller | Information Disclosure | Low | Zod issue messages (`shapeCheck.error.issues`) are generic structural messages ("Expected object, received string") — no stack traces, file paths, or internal state are exposed. Confirmed by direct inspection of `EmitEventEnvelope.safeParse()`'s error-mapping code in `src/server-factory.ts`. |

---

## Dependency Audit

No new dependencies were added by this feature. `zod` (already `^4.0.0`, resolved `4.3.6`) and `ajv`/`ajv-formats` (already `^8.17.1`/`^3.0.1`, resolved `8.18.0`) are unchanged, mainstream, actively-maintained packages — `npm audit` reports no advisories against either.

`npm audit --omit=dev` does report 5 advisories (3 moderate, 2 high) against `hono`, `qs`, and `ip-address` — **these are transitive dependencies of `@modelcontextprotocol/sdk` itself** (`@modelcontextprotocol/sdk` → `@hono/node-server` → `hono`; `express-rate-limit` → `ip-address`), not of any code touched by this feature, and not declared as direct dependencies of `structured-telemetry-mcp`. Pre-existing, out of this feature's scope — recommend a separate SDK-version-bump pass to pick up upstream fixes; not blocking 0000010.

---

## Secrets Management

No secrets are introduced by this feature. The generated plist (macOS) and systemd unit (Linux) files contain only local filesystem paths (node binary, bundle location, log paths) — no credentials, tokens, or API keys. No `.env` handling, no credential storage added.

---

## Authentication & Authorisation Review

Not applicable — this repo has no auth model (bound to `127.0.0.1`, no network exposure), unchanged from the posture established in 0000008 and re-confirmed in this feature's `plan/current/design.md`. The `emit_event`/`query_telemetry` MCP tools remain accessible to any process able to reach the local MCP server, which is the existing, accepted trust boundary — not altered by this feature.

---

## Input Validation Review

This feature's core deliverable *is* an input-validation improvement (R-009 fix). `emit_event`'s tool argument now passes through `EmitEventEnvelope.safeParse()` — a `.strict()` Zod object — before `validateEvent()`/ajv runs, closing the gap where `z.unknown()` gave calling models no structural guidance and let malformed shapes reach ajv with only an opaque error. Confirmed via 7 explicit regression test cases in `tests/regression/emit-handler.test.ts` (the six RCA reproduction shapes plus the old `{ event: ... }` argument-name rejection) and a full 25-event-type round-trip integration test (`tests/integration/emit-event.test.ts`).

---

## Network Policy

Unchanged. The backend remains bound to `127.0.0.1:3741`; the new service-supervision scripts (launchd/systemd) do not open any new port or network surface — they supervise the same local process the existing `npm start`/Windows service already run.

---

## Infrastructure as Code Review

Not applicable in the traditional cloud sense — the "infrastructure" introduced here is a macOS `launchd` plist and a Linux `systemd --user` unit file, both user-scoped (never a root daemon or system-wide unit, per ADR-014's explicit rejection of that alternative). Reviewed for the closest-applicable concerns:
- **Overly permissive scope:** Not applicable — user-scoped by design, no elevated privileges requested or required for the common install path.
- **Public exposure:** Not applicable — no network resource created.
- **Missing encryption:** Not applicable — no data in transit/at rest introduced by the service files themselves.
- **Missing audit trail:** Logs are written to `~/Library/Logs/` (macOS) and captured by `journalctl --user` (Linux) — consistent with the existing logging convention, not a new gap.
- **Hardcoded credentials:** None present.

---

## Cross-Reference: Risk Register

| Risk (`plan/current/risk-register.md`) | Status in implementation |
|---|---|
| R-001 — locked `~/Library/LaunchAgents` | Mitigated — pre-flight write-test + explained sudo fallback, confirmed in `scripts/service-macos.sh` |
| R-002 — Linux systemd design untested on real hardware | **Still open** — this is an operational/testing risk, not fixable by code review; requires manual verification on a real systemd distro before Phase 2 is considered done (tracked in `quirks.md`) |
| R-003 — lingering disabled by default | Mitigated — post-install + `status` lingering check with explicit warning, confirmed in `scripts/service-linux.sh` |
| R-004 — 3-way schema/Zod/EVENT_REQUIRED_DATA_FIELDS drift | Mitigated — all three landed together in one P3 commit; integration test asserts all 25 types round-trip, which would fail if any of the three drifted |
| R-005 — `emit_event` argument rename is breaking | Accepted, by design — reflected in the 0.10.0 version bump and documented in README/usage-guide; the old shape now fails loudly (tested) rather than silently misbehaving |
| R-006 — version-manifest drift | Mitigated — `component.yml`/`product.yml` established as source of truth this pass |
| R-007 — node path not guaranteed | Mitigated — both scripts resolve via `command -v node` (+ Homebrew fallbacks on macOS) at install time |

---

## Summary

**Overall risk rating: Low**

No critical, high, or medium findings. All identified items are either already mitigated by the implementation (confirmed by direct code inspection and passing tests) or are low-severity, self-inflicted-only conditions that don't cross a trust boundary.

Top actions before this is fully "done" (none block shipping the code, but should not be lost):
1. **Manually verify `scripts/service-linux.sh` on a real systemd-based distro** — this is a testing/operational gap (risk-register R-002), not a security defect, but it's the single most important open item from this pass.
2. Consider XML/shell-escaping the interpolated paths in `_generate_plist()` and the systemd `ExecStart` line as a robustness hardening — low severity, not exploitable by anyone but the local operator, but cheap to fix in a follow-up.
3. Track the pre-existing `@modelcontextprotocol/sdk` transitive-dependency advisories (`hono`, `qs`, `ip-address`) for a future SDK version bump — unrelated to this feature, not blocking.
