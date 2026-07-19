---
title: "Migration: retroactive-release-tags"
type: "git-operation"
description: "Tag historical commits with their release version tags."
status: "complete"
created: "2026-05-18"
completed: "2026-05-18"
feature: "0000012-docs-restructure-commit-directives"
---
# Migration: retroactive-release-tags

> Processed by the agent. Tags are created locally only — the human pushes them with `git push origin --tags`.

---

## Context

The repository had no git tags for releases prior to this migration. Tags are applied retroactively to the commits on `main` that represent each release.

---

## Step 1 — Read git log

Run:

```bash
git log --oneline main
```

Scan the output for any commits whose message explicitly names a version (e.g. `planifest framework v0.10`). Use these as anchors. For the remaining versions, infer from PR sequence, branch names, and commit dates. Where inference is ambiguous, propose the mapping to the human for a single confirmation before proceeding.

> Do not ask the human to fill in a table manually. Read the history, propose the mapping, ask once for confirmation.

---

## Step 2 — Propose and confirm mapping

Present the proposed mapping as a table. Ask the human to confirm or correct it. Wait for one confirmation before tagging.

---

## Step 3 — Validate SHAs

For each SHA in the confirmed mapping, validate it matches `[0-9a-f]{7,40}`. If any SHA does not match, do not tag that entry — report the invalid entry to the human.

---

## Step 4 — Create tags

For each confirmed and validated entry, run:

```bash
git tag {version} {sha} -m "{version}"
```

Run all tag commands. Confirm each tag was created successfully.

---

## Step 5 — Human pushes tags

```
All tags created locally. Push with:

  git push origin --tags

Verify on the remote that all tags appear.
```

---

## Step 6 — Mark migration complete

```bash
mkdir -p planifest-framework/migrations/_done
mv planifest-framework/migrations/retroactive-release-tags.md \
   planifest-framework/migrations/_done/retroactive-release-tags.md
git add planifest-framework/migrations/
git commit -m "chore(migrations): complete retroactive-release-tags"
```

---

## Completed run — 2026-05-18

| Version | Commit SHA | Commit message |
|---------|-----------|----------------|
| v0.10 | `4ea0e42` | planifest framework v0.10 (#31) |
| v0.11 | `5fd5c3b` | Feat/ext skill fixes (#33) |
| v0.12 | _(this branch, pending merge)_ | 0000012-docs-restructure-commit-directives |

Tags pushed by human after branch merge.
