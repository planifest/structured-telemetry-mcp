# Tech Debt — structured-telemetry-mcp

## Pre-existing, surfaced during 0000010-macos-launchd-service

- **`README.md`'s "Event Payloads" section only documents 9 of 21 pre-0.10.0 event types.** Stops at `self_correction`; the 12 types added between 0.2.0 and 0.3.0 (`phase_skip` through `schema_migration_applied`) were never backfilled. This feature adds its own 4 new types (0.10.0) to the section but does not backfill the pre-existing gap — flagged for the P6 docs-agent pass.
- **`src/structured-telemetry-mcp/docs/data-contract.md`'s sub-schema list has the same gap** — the same 12 event types from 0000009 were never added there either. This feature's data-contract.md update fixes the stale "14 event types" count references and adds its own 4 new sub-schemas, but does not backfill the 12. Flagged for P6.
- **`package.json`'s `version` field was stale at `0.1.0`** while the true last-shipped version (per git tags and `component.yml`) was `0.3.0`. Fixed as part of this feature's version-manifest work (`component.yml`/`product.yml` established as the enforced source of truth); `package.json` syncs at P9 ship.
