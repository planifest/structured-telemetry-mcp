# Change Summary

Change request: A scoped `query_telemetry` call that returns zero rows is indistinguishable from "no data at all" for that scope, even when real events exist under a different event type than the query family reads. Add a hint to the response when this happens.
Interpretation: applied to every query builder across the three aggregate query families (`bottlenecks`, `failures`, `token-efficiency` — 10 functions total) via one shared helper, since all of them share the identical failure mode, not just the specific bottleneck call site that was originally reported. `event_log` excluded (already returns real matching events, nothing to hint at). No interface/contract break — the new `hint` field is additive and only appears on the zero-row, scoped-query path.
Components affected: structured-telemetry-mcp (single component)
Contract changed: no (additive field only)
Schema changed: no
Migration proposed: no
Consumers affected: none
Blast radius: none — single-component repo, no dependents
