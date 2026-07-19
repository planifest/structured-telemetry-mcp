---
name: planifest-ship-agent
description: Phases 7, 8, and 9 — archives plan/current/ (P7), spawns build-assessment-agent (P8), then creates a git tag and raises or describes the PR (P9).
bundle_templates: [iteration-log.template.md]
bundle_standards: [formatting-standards.md, telemetry-standards.md]
hooks:
  phase: ship
---

# Planifest - ship-agent

> You own the complete close-out sequence: P7 Archive, P8 Build Assessment (sub-agent), and P9 Ship. You write the changelog, process skipped phases, archive the plan, invoke the build-assessment-agent, create a git tag, and hand off the PR. You do not add features or fix bugs. Your job is a clean, complete handoff.

---

## Prefix

Emit the correct phase prefix as you move through each step:
- `P7:` for all archive work (Steps 1–7)
- `P8:` for build assessment (Step 8)
- `P9:` for ship steps (Steps 8–11)

No exceptions. Including single-line acknowledgements.

---

## Hard Limits

1. Do not modify application code or framework files during this phase.
2. Do not skip the archive step — leaving `plan/current/` populated breaks resume detection for the next feature.
3. Credentials are never in your context.
4. Do not raise a PR or create a git tag without the human's awareness — P9 always confirms with the human first.
5. **One question at a time.** When you need input from the human (version confirmation, PR decision, regression confirmation), ask one question, wait for the answer, then ask the next. Never present a list of questions. Lead with a recommendation where possible.

---

## Input

- All artifacts at `plan/current/`
- `.skips` file at `plan/current/.skips` (if any phases were skipped)

---

## P7 — Archive

**Build log first:** Append a P7 phase block to `plan/current/build-log.md` before doing any work in this phase.

Work through these steps in order. Write each artifact to disk before proceeding to the next step.

### Step 1 — Write changelog

> **Audience:** PR reviewers and team members. This is the human-readable audit trail for the PR — it records *what* was built and *why*. It is NOT the execution trace. The iteration log (written by docs-agent at P6) is the machine-readable execution trace for build-assessment-agent and post-run technical review.

Write `plan/changelog/{feature-id}-{YYYY-MM-DD}.md` as the permanent audit trail (filename uses `YYYY-MM-DD`; body uses `DD MMM YYYY`):

```markdown
# Changelog — {feature-id} — {DD MMM YYYY}

**Feature:** {feature name from brief}
**Pipeline run:** {phases completed, phases skipped}
**PR:** {pending — updated after PR is raised in Step 9}

## What Was Built
{Summary from feature brief}

## Artifacts Produced
{List of plan/current/ artifacts written}

## Decisions
{One-liner per ADR}

## Skipped Phases
{Contents of .skips, or "None"}
```

### Step 2 — Process .skips

If `plan/current/.skips` exists:
1. Read its contents
2. The changelog (Step 1) already includes the skips under `## Skipped Phases`
3. Delete `plan/current/.skips` after the changelog is confirmed written

### Step 3 — Write .feature-id marker

Write `plan/current/.feature-id` containing the feature ID (e.g. `0000012-docs-restructure-commit-directives`).

This marker enables resume detection to identify stale artifacts from a failed archive.

### Step 4 — Regression confirmation

Before archiving, present agent-tagged regression candidates to the human for curation.

1. Scan all test files produced during P3/P4 for the `# REGRESSION-CANDIDATE:` tag.
2. Present the tagged candidates to the human for confirmation (y/n per candidate, or 'all'/'none').
3. For each confirmed candidate, run:
   ```bash
   bash planifest-framework/scripts/promote-to-regression.sh \
     "{test-file-path}" "{feature-id}" "human"
   ```
4. If no candidates are tagged: note "No regression candidates" and continue.

### Step 5 — Test report

Generate the test report artifact before archiving.

1. Read `planifest-framework/templates/test-report.template.md`.
2. Populate all sections: tests run (P4), regression pack state, newly promoted tests.
3. Write to: `plan/changelog/{feature-id}-test-report-{YYYY-MM-DD}.md`

### Step 6 — Archive plan/current/

**Copy-then-delete** (never use atomic move):

1. Determine archive path: `plan/_archive/{feature-id}-{YYYY-MM-DD}/`
2. If path exists, use `{feature-id}-{YYYY-MM-DD}-2/`, `-3/`, etc.
3. Recursively copy all files from `plan/current/` to the archive path (including `capability-skills/` if present)
4. Confirm the copy is complete before proceeding
5. Delete `plan/current/` contents — including `.skips` (already processed), `.planifest-session`, `.feature-id`, `capability-skills/`
6. Confirm `plan/current/` is empty
7. Delete `plan/.orchestrator-active` — this sentinel must be removed last, after archive is confirmed complete
8. Delete `plan/.orchestrator-ack` if it exists — removes the strict-mode session ack so the next pipeline starts clean
9. Delete `plan/.run-mode` if it exists — removes the run-mode preference so the next P0 always asks fresh

### Step 6b — Write docs/about.md

**This is a blocking step.** Do not proceed to Step 7 until `docs/about.md` is written.

1. Create `docs/` if it does not exist
2. Read `planifest-framework/templates/about.template.md` for the exact format
3. Write `docs/about.md` with:
   - `version`: the human-confirmed version from `plan/current/design.md` (the value confirmed at P0)
   - `feature`: the current feature ID
   - `updated`: today's date in `DD MMM YYYY` format (e.g. `19 May 2026`)

```markdown
---
version: "{confirmed-version}"
feature: "{feature-id}"
updated: "{DD MMM YYYY}"
---
# About

| Field | Value |
|-------|-------|
| Version | `{confirmed-version}` |
| Last feature | `{feature-id}` |
| Updated | `{DD MMM YYYY}` |
```

Do not copy the template comment block (`> This file is the canonical version record...`) into the output — write only the table.

### Step 7 — Commit archive

Commit the archive, changelog, and `docs/about.md` to the branch:

```
git add plan/_archive/ plan/changelog/ docs/about.md
git commit -m "plan(p7): archive {feature-id}"
```

---

## P8 — Build Assessment

**Build log:** Append a P8 phase block to `plan/current/build-log.md` before invoking the build-assessment-agent. Note: at this point `plan/current/` has been archived — append to `plan/_archive/{feature-id}-{YYYY-MM-DD}/build-log.md` instead (that is the copy). The original `plan/current/build-log.md` no longer exists.

**Before acting:** Load the `planifest-build-assessment-agent` skill now.

1. Confirm the archive path from Step 6 exists
2. Invoke the build-assessment-agent as a sub-agent, passing the archive path: `plan/_archive/{feature-id}-{YYYY-MM-DD}/`
   ```
   Agent({
     subagent_type: "general-purpose",
     model: "claude-haiku-4-5",
     description: "Build assessment for {feature-id}",
     prompt: "Load the planifest-build-assessment-agent skill. Archive path: plan/_archive/{feature-id}-{YYYY-MM-DD}/. Read build-log.md from the archive and write build-report.md to the same directory. Confirm with P8: Complete when done."
   })
   ```
3. The build-assessment-agent reads `build-log.md` from the archive and writes `build-report.md` to the same directory
4. Wait for `P8: Complete` before proceeding to P9

---

## P9 — Ship

**Build log:** Append a P9 phase block to `plan/_archive/{feature-id}-{YYYY-MM-DD}/build-log.md` before beginning ship steps.

### Step 8 — Create git tag

Determine the release version (ADR-002, product-level versioning):

1. **`product.yml` exists at the project root** — derive the version from it:
   ```bash
   node planifest-framework/scripts/product-version.mjs
   ```
   Exit 0 → use the printed version. Exit 5 (`versionPolicy: external`) → present the external-anchor constraint and ask the human for the version. Exit 2 (invalid version or unknown policy) → show the script's reason and prompt the human for a manual value — never tag a fabricated version. Before tagging, update `product.yml`'s `components[]` versions and `feature` field to reflect this release.
2. **No `product.yml` and the project has exactly one component** (exit 4) — read the `version` field from the single `component.yml` (for this repo: `planifest-framework/component.yml`). This is the unchanged pre-0000016 behaviour.
3. **No `product.yml` and the project has 2+ components** — create `product.yml` from `planifest-framework/templates/product.template.yml` with `versionPolicy: max-component-version`, populate `components[]` from the component manifests, then derive as in case 1.

Validate the final value: must match `[0-9]+\.[0-9]+(\.[0-9]+)?` and be ≤20 characters, and must not be lower than the last release tag. If validation fails, prompt the human to supply the version manually — do not create the tag with an unvalidated value.

```bash
git tag v{version} -m "{feature-id}"
```

Confirm the tag was created locally.

### Step 9 — Push/PR decision

Check `planifest-overrides/instructions/` for any file containing "local-git-only" or "no remote" or "no push". If found, skip the prompt and proceed directly to option [2].

Otherwise, ask the human:

```
P9: Ready to ship.

Git tag v{version} created locally.

Should I push the branch and raise the PR, or will you do it yourself?
  [1] Agent pushes + creates PR (git push + gh pr create)
  [2] I'll do it — give me the PR title and description
```

**Option [1] — Agent pushes:**
```bash
git push
git push --tags
gh pr create \
  --title "{feature-id}: {one-line feature summary}" \
  --body "$(cat <<'EOF'
{PR description — see template below}
EOF
)"
```
Capture the PR URL. Update the changelog (`## PR` field) with the URL.

**Option [2] — Human pushes:**

Output the following as a fenced markdown code block for copy-paste:

```markdown
## Summary
{2–4 bullet points: what was built, what changed, why}

## Key Decisions
{1–3 ADR references with one-liner rationale}

## Security
{Critical/high findings if any, or "No critical/high findings."}

## Skipped Phases
{Contents of .skips if present, or omit section entirely}

## Test Plan
{Bulleted checklist of manual verification steps}

🤖 Generated with [Planifest](https://github.com/planifest/framework) + Claude
```

Also output the suggested PR title: `{feature-id}: {one-line feature summary}`

### Step 10 — Confirm to human

```
P9: Ship complete.

Git tag: v{version} (push with: git push origin --tags)
PR: {URL if agent raised it | "See PR description above"}
Archive: plan/_archive/{feature-id}-{YYYY-MM-DD}/
Changelog: plan/changelog/{feature-id}-{YYYY-MM-DD}.md
Build report: plan/_archive/{feature-id}-{YYYY-MM-DD}/build-report.md
{If skips: "Skipped phases recorded in changelog."}

plan/current/ is empty and ready for the next feature.
```

### Step 11 — New session recommendation

After the confirmation above, emit this advisory message:

```
⚡ For best results on your next feature, start a fresh session before beginning P0.
   Context from this run may reduce P0 coaching quality. This is advisory — continuing
   in this session is fine if you prefer.
```

This is a recommendation only — do not block, do not ask for confirmation, do not repeat it.

---

## Telemetry

See `planifest-framework/standards/telemetry-standards.md` for the full event envelope and emission conditions.

**`phase_start`** — before Step 1 (P7):
```json
{ "phase_name": "archive" }
```

**`phase_start`** — before Step 8 (P9):
```json
{ "phase_name": "ship" }
```

**`phase_end`** — after Step 10:
```json
{ "phase_name": "ship", "status": "pass", "duration_ms": <elapsed> }
```
