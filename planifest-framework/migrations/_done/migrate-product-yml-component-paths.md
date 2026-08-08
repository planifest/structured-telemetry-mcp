# Migration — product.yml components[] version → path

**Target:** `product.yml` at the project root
**Scope:** the root `product.yml` file only — not `plan/`, `docs/`, or `planifest-framework/`
**Safe to skip:** No, if `versionPolicy: max-component-version` — `product-version.mjs` will fail (exit 2) at every P9 tag attempt until migrated. Yes, if `versionPolicy` is `explicit` or `external` (`components[]` is never read for those) or the file is already in the new shape.

---

## Background

Before 2026-08-08, `product.yml`'s `components[]` cached each component's version inline (`{id, version}`). That copy went stale the moment a component's own `component.yml` bumped its version outside a P9 ship — `product-version.mjs` under `versionPolicy: max-component-version` had no way to detect the drift, and would silently derive a stale product version. `components[]` now holds `{id, path}` pointers to each component's own `component.yml`; `product-version.mjs` reads the live version at derivation time instead. See `docs/decisions-index.md`'s Feature 0000016 ADR-002 entry.

Any project whose `product.yml` still uses the old `{id, version}` shape will hit a hard failure the next time `product-version.mjs` runs under `max-component-version` (exit 2: no `path` on a `components[]` entry) — not silent breakage, but a blocked P9.

---

## What This Migration Does

1. Check whether `product.yml` exists at the project root. If absent, report "No product.yml at project root — nothing to migrate" and archive (Step 5).
2. Read `versionPolicy`. If `explicit` or `external`, report "versionPolicy is `{policy}` — components[] is not read for version derivation, nothing to migrate" and archive.
3. If `max-component-version`, parse `components[]`. If every entry already has a `path` key (no `version` key), report "Already migrated" and archive.
4. For each `components[]` entry that has a `version` key instead of a `path` key:
   - Search the project (excluding `node_modules/`, `.git/`) for a `component.yml` whose top-level `id:` field matches this entry's `id`.
   - **Exactly one match:** propose that file's path (relative to project root) as the new `path` value.
   - **Zero matches:** flag as unresolvable — do not guess a path.
   - **Multiple matches:** list all candidate paths — do not guess which one; the human picks.

---

## Present Findings

One entry at a time:

```
[product.yml] components[] entry: id "{id}"
Current: version: "{cached-version}"
{if exactly one match} Proposed: path: "{detected-path}" (component.yml's own version field currently reads "{live-version}", {matches | does not match} the cached value)
{if zero matches} No component.yml with id "{id}" found under the project root — supply the path manually or remove this entry if the component no longer exists.
{if multiple matches} Multiple component.yml files declare id "{id}": {list}. Which one? (enter path, or 'skip')

Apply? (y/n/[manual path]/skip)
```

Apply confirmed changes: replace the entry's `version:` line with `path: "{confirmed-path}"`. Leave `id` untouched. Do not touch the top-level `version`/`feature` fields — those stay whatever they last were; they are informational display fields under this policy and get refreshed at the next P9, not by this migration.

After all entries are resolved, run `node planifest-framework/scripts/product-version.mjs` from the project root as a sanity check and report its output (or its exit code and stderr, if it fails) to the human — do not silently swallow a failure here, since an unresolvable entry left unmigrated will surface exactly this way.

---

## Migrator Instructions

1. Show each entry per the format above.
2. Ask: `Apply? (y/n/manual/skip)`
3. Apply confirmed changes.
4. Report: `{n} entries migrated, {m} skipped, {k} unresolved`.
5. Run the sanity check above and report its result.

Move this file to `planifest-framework/migrations/_done/migrate-product-yml-component-paths.md` when complete or explicitly skipped by the human.
