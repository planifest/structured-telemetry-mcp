# Change Summary

Change request: `query_telemetry`'s bottleneck query family accepts any string as `group_by` without validating it against the real 7-value allow-list. An invalid value (e.g. `event_type`, which is a real column but not a valid `group_by` dimension) silently produces `undefined` as the SQL `GROUP BY` column, which DuckDB rejects — surfacing to callers as an opaque `"backend query failed: 400"` with the real cause lost.
Interpretation: narrowest fix — validate `group_by` against the existing `BottleneckGroupBy` allow-list in `dispatchQuery` before dispatching, mirroring the validation already applied to every `mode`-based branch in the same function. No change to valid-input behaviour, no interface/contract change.
Components affected: structured-telemetry-mcp (single component)
Contract changed: no
Schema changed: no
Migration proposed: no
Consumers affected: none
Blast radius: none — single-component repo, no dependents on the unvalidated behaviour (confirmed via docs/dependency-graph.md)
