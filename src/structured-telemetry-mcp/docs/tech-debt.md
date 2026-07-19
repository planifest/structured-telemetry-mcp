# Tech Debt — structured-telemetry-mcp

## Resolved in 0000011-defects-and-query-telemetry-fix

- ~~`README.md`'s "Event Payloads" section only documents 9 of 21 pre-0.10.0 event types.~~ Fixed — all 12 missing types (`phase_skip` through `schema_migration_applied`) backfilled.
- ~~`src/structured-telemetry-mcp/docs/data-contract.md`'s sub-schema list has the same gap.~~ Partially applied already (the 5 types from 0.2.0 were already present) — the remaining 7 from `0000009` (`context_reset` through `schema_migration_applied`) are now backfilled too.

## Resolved in 0000010-macos-launchd-service

- ~~`package.json`'s `version` field was stale at `0.1.0`~~ while the true last-shipped version (per git tags and `component.yml`) was `0.3.0`. Fixed via `component.yml`/`product.yml` established as the enforced source of truth.
