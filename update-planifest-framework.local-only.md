# update-planifest-framework.local-only.sh

Refreshes this repo's local `planifest-framework` folder from the
latest release. This repo lives **two levels down** from `d/`
(`d/planifest/framework`).

## Usage

Run it from anywhere — it resolves paths relative to its own location,
not your current directory:

```bash
./update-planifest-framework.local-only.sh
```

## What it does

1. Looks for the latest release at `../../_latest-planifest-framework-release/planifest-framework` (relative to the script).
2. Deletes this repo's existing `planifest-framework` folder, if present.
3. Copies the release's `planifest-framework` folder into this repo.

## Requirements

- `d/_latest-planifest-framework-release/planifest-framework` must exist.
  Generate/refresh it first with `_scripts/release-latest-planifest-framework.sh`.

## Warning

This is destructive to this repo's local `planifest-framework` folder —
any local edits inside it are deleted and replaced. Commit or stash
first if needed.
