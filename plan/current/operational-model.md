---
title: "Operational Model - 0000019-loopback-daemon-hardening"
summary: "Runbook triggers, on-call expectations and alerting thresholds."
---
# Operational Model - 0000019-loopback-daemon-hardening

## On-call model

None. This is a user-scoped local daemon supervised by launchd (macOS), `systemd --user` (Linux) or nssm (Windows). The operator is the developer running it, and the diagnostic surface is `npm run doctor` plus the daemon's stderr log. There is no rotation, no paging, and no alerting infrastructure to configure — stating that explicitly so the absence reads as a decision rather than an oversight.

## What changes operationally

This feature introduces one genuinely new operational concept: **a legitimate request can now be refused.** Before it, any request that reached the daemon was attempted. After it, four checks can turn a caller away before its body is read.

That creates a new diagnostic question — *"why did my client stop working?"* — and the runbook below exists to answer it.

## Runbook triggers

| Symptom | Likely cause | First action |
|---|---|---|
| Telemetry stops appearing for pipeline runs, daemon healthy | An emission hook is being refused at the boundary — the R-001 case | Check stderr for `403`/`415` lines naming the hook's request. Confirm the hook sends `Content-Type: application/json` and no foreign `Origin` |
| Log viewer loads but shows no events | The viewer's `/query` calls are refused, or the shared gate is rejecting its payload | Browser devtools network tab: read the status. `403` means Host/Origin; `415` means Content-Type; `400` names the offending field |
| Log viewer will not load at all | `Host` refusal on `GET /ui` — most likely reached via a hostname other than `127.0.0.1` or `localhost` | Use `http://127.0.0.1:<PORT>/ui` exactly. A custom hosts-file alias is refused by design (req-001) |
| MCP `query_telemetry` returns a truncated result unexpectedly | req-008's text budget hit on a large result | Narrow the query as the truncation notice suggests; the HTTP path still returns the full bounded result |
| A query returns fewer rows than expected with `truncated: true` | req-007's row cap | Expected behaviour. Narrow by session or time range; `total_count` reports the true total |
| Client receives `500` with a correlation id and nothing else | An engine or internal failure — redaction working as designed | Grep stderr for the correlation id to get the full error and stack |
| Client receives `413` | Body over the 4 MB cap | Legitimate payloads should not approach this. Investigate what the client is sending before raising `PLANIFEST_MAX_BODY_BYTES` |
| Daemon exits unexpectedly | **Should not happen after this feature.** NFR-003 targets zero exits under hostile input | Capture the stderr line and treat as a defect against req-004, not as an operational event |

## Diagnostics this feature adds

- **Correlation ids** (req-006) are the primary new diagnostic. Every error response carries one; the full error and stack are written to stderr against the same id. The workflow is: take the id from the client, grep the daemon log.
- **Named-field errors** (req-005) mean a `400` states which parameter was wrong without quoting its value. Enough to fix the caller, not enough to leak data.

## Alerting thresholds

None configured, deliberately. A rising rate of `403`/`415` responses after this ships is the checks doing their job, so alerting on error rate would alert on success. The one condition worth watching — a daemon process exit — is already handled by the platform supervisor's restart behaviour and by 0000018's supervision circuit-breaker (ADR-031, `ThrottleInterval` / `StartLimitBurst`), which is defence-in-depth against a crash loop.

## Environment variables introduced

| Variable | Default | Purpose |
|---|---|---|
| `PLANIFEST_MAX_BODY_BYTES` | 4194304 (4 MB) | Request-body cap (req-004) |
| `PLANIFEST_REQUEST_TIMEOUT_MS` | 30000 | Slow-body connection timeout (req-004) |
| `PLANIFEST_MCP_TEXT_BUDGET` | 100000 | Character budget for assembled MCP tool-result text (req-008) |

All three exist primarily so tests can drive the limits at small values. Production defaults are the values above, and the runbook advises investigating a client before raising any of them.

## Known operational gap

Backlog 00028 is an operational dependency, not merely a code one. If the emission hooks do not treat a non-2xx `/emit` response as a failure worth writing a marker for, the first row of the runbook table above becomes *silent* — telemetry stops with no marker and no prompt, and the symptom is noticed only when someone goes looking for data that is not there. The daemon side is correct either way; the visibility is not this component's to guarantee.
