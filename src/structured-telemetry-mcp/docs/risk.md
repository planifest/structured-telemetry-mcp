# Risk — structured-telemetry-mcp

Component-scoped view of `plan/current/risk-register.md` (0000010) plus carried-forward items from `component.yml`'s cumulative `risk.items` list. See those files for full likelihood/impact/mitigation detail.

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

See `plan/current/security-report.md` for the full STRIDE threat model, which found no critical/high/medium findings for this feature.
