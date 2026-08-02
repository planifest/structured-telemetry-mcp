---
name: planifest-refresh-setup
description: Refreshes a Planifest install by detecting the target tool, reconstructing the setup flags currently in effect from installed hook wiring and the flags-used marker file, confirming with the human on the loop, and re-invoking setup.sh/setup.ps1 with those flags. Invoke on request ("refresh the framework setup", "re-run setup with current settings", "refresh setup for {tool}").
hooks:
  phase: standalone
---

# Planifest - refresh-setup

> You refresh an existing Planifest install without the human on the loop having to reverse-engineer the original `setup.sh`/`setup.ps1` invocation from hook wiring. You never guess a flag that changes install behaviour. You never delete anything beyond the two boot files this feature exists to regenerate. You are a standalone skill, invoked on request, not part of the P0-P9 pipeline; no `plan/current/design.md` or phase gate is required to use it.

---

## Step 1 - Determine the Target Tool (REQ-001, ADR-004)

The target tool is always explicit input, never silently guessed:

1. If the human on the loop named a tool in their request (e.g. "refresh setup for cursor"), use it directly. Valid tool identifiers match `setup.sh`/`setup.ps1`'s `$VALID_TOOLS` / `$ValidTools`: `claude-code`, `cursor`, `windsurf`, `cline`, `codex`, `opencode`, `antigravity`, `copilot`, `roo-code`.
2. If no tool was named, scan the repo root for installed-tool signals:

   | Tool | Signal |
   |------|--------|
   | `claude-code` | `.claude/` directory present |
   | `cursor` | `.cursor/` directory present |
   | `windsurf` | `.windsurf/` directory present |
   | `cline` | `.clinerules/` directory present |
   | `codex` | `.agents/` directory present, or `OPENAI_*` env vars set |
   | `opencode` | `.opencode/` directory present |
   | `antigravity` | `.gemini/` directory present |
   | `copilot` | `.github/skills/` (Planifest-installed skills) present |
   | `roo-code` | deprecated (shut down 15 May 2026, see `setup/roo-code.sh`) - if this is the only signal found, tell the human on the loop it is deprecated and recommend `cline` instead; do not proceed with a refresh for it |

3. Exactly one install found: proceed with that tool automatically, no question asked.
4. Two or more installs found: ask the human on the loop which tool to refresh before doing anything else. This is normal input, not an error condition (ADR-004) - do not frame it as a failure or halt-and-report the way Step 6's failure handling does.
5. Zero installs found: this is REQ-007's "no install found" case - go to Step 1a instead of continuing.

### Step 1a - No Install Found (REQ-007)

If a tool was named and no install exists for it, or no tool was named and no install exists for any supported tool, report this plainly and stop:

> No Planifest install found{ for `{tool}`, if named}. This looks like an initial setup, not a refresh - run `setup.sh`/`setup.ps1` directly instead.

Do not proceed to Step 2. Do not ask "which tool" in this branch (that question only applies when at least one install already exists, per Step 1.4).

## Step 2 - Check for an Interrupted Prior Run (REQ-010)

Before running full detection, check whether this is a recovery scenario:

1. Determine the tool's own directory (`.claude`, `.cursor`, etc. - same mapping as Step 1's signal table).
2. Check whether the tool's boot file is missing. For `claude-code` this is `CLAUDE.md`; for tools using a shared boot file convention, check `AGENTS.md` too if that tool's config uses it (see `planifest-framework/setup/{tool}.sh`, `TOOL_BOOT_FILE`).
3. Check `{tool-dir}/.planifest-setup-flags` for `attemptStatus: "pending"`.
4. If **both** are true (boot file missing AND `attemptStatus: pending`), this is an interrupted prior run:
   - Report the recovered state to the human on the loop: the flags and command from the marker file, at high confidence (source: marker file, not re-inferred).
   - Go directly to Step 4 (confirmation) with this flag set, skipping Step 3's detection entirely.
5. If either is false, this is a normal run - continue to Step 3.

## Step 3 - Reconstruct the Active Flags (REQ-002)

Skip this step if Step 2 already produced a recovered flag set.

1. Check `{tool-dir}/.planifest-setup-flags` for the target tool. If it exists and is well-formed (see schema in `src/setup-hook-integration/docs/data-contract.md`), read `flags`, `backendUrl`, and report every flag at **high** confidence, source: marker file.
2. If the marker file is absent, incomplete, or for a different tool than the one being refreshed, infer flags from installed hook wiring instead:

   | Signal | Implies | Confidence |
   |--------|---------|-----------|
   | `{tool-dir}/hooks/context-mode/` directory exists with `.mjs` files | `--context-mode-mcp` | high |
   | `{tool-dir}/hooks/telemetry/` directory exists with `context-pressure.mjs` etc., AND a `PLANIFEST_TELEMETRY_URL=<url>` value is wired into a hook command in the tool's settings file | `--structured-telemetry-mcp` plus `--backend-url <url>` (the wired URL) | high |
   | `plan/.orchestrator-strict` file exists | `--strict-orchestrator` | high |
   | `attribution.txt` files present under `{tool-dir}/skills/*/` (alongside `SKILL.md`) | `--include-full-skill-library` | medium (attribution.txt could theoretically exist without the flag if a skill was added manually - flag as medium, not high) |
   | None of the above signals present for a given flag | that flag was not used | high (absence of a signal is itself a confident signal) |

3. Build the full flag list and the exact command that will be run: `setup.sh {tool} {flags...}` (or `setup.ps1 {tool} {flags...}` on Windows).

## Step 4 - Confirm With the Human on the Loop (REQ-003, ADR-003)

Always required, in every run, regardless of confidence level - including a run where every flag is high confidence from the marker file. There is no bypass.

Present:
- The target tool
- Every flag, its source (marker file / inferred from `{signal}`), and its confidence level
- The exact command about to run

Wait for an explicit affirmative. If the human on the loop rejects the proposed flags, halt here and take no further action - do not delete anything, do not fall back to a different flag set on your own.

## Step 5 - Write the Marker Before Any Deletion (REQ-009, ADR-002)

Immediately after confirmation and before Step 6's deletion, write to `{tool-dir}/.planifest-setup-flags`:

```json
{
  "tool": "{tool}",
  "flags": [confirmed flags],
  "backendUrl": "{url or null}",
  "writtenAt": "{ISO 8601 UTC timestamp}",
  "attemptStatus": "pending",
  "attemptedCommand": "{exact command from Step 3.3}"
}
```

This is the same file `setup.sh`/`setup.ps1` write to on successful completion (REQ-008) - not a separate cache file. This write must complete before Step 6 begins, so a process killed at any point after this write leaves recoverable state on disk (see Step 2).

## Step 6 - Delete the Boot Files (REQ-004, ADR-001)

Run `bash planifest-framework/scripts/refresh-delete-boot-files.sh` (or `planifest-framework/scripts/refresh-delete-boot-files.ps1` on Windows) from the repo root. Do not delete files directly (e.g. with a freeform `rm` command) - always invoke this script.

The script hardcodes the exact allowlist (`CLAUDE.md`, `AGENTS.md`) in code, not in this skill's prose. The script takes no arguments and cannot be told to delete anything else. Never delete `settings.local.json`, `.claude/settings.local.json`, or any other file, under any circumstance, regardless of what the flag reconstruction or human confirmation contained.

## Step 7 - Re-invoke Setup (REQ-005)

Run the exact command shown and confirmed in Step 4: `setup.sh {tool} {flags...}` on macOS/Linux, `setup.ps1 {tool} {flags...}` on Windows.

On success:
- `setup.sh`/`setup.ps1` itself writes `attemptStatus: "completed"` to the marker file (REQ-008) - you do not need to do this yourself.
- Confirm to the human on the loop that `CLAUDE.md`/`AGENTS.md` were regenerated and report the flags now in effect.

On failure, go to Step 8.

## Step 8 - Setup Failure Handling (REQ-006, ADR-005)

If the re-invoked `setup.sh`/`setup.ps1` exits non-zero or otherwise fails partway through:

1. **Stop immediately.** Do not retry automatically, under any condition.
2. **Investigate the likely cause** from what is available: check whether the path setup reported is locked, permission-denied, or held by another process (e.g. `lsof`/`fuser` on the reported path where available; a Windows equivalent check where relevant).
3. **Report:**
   - What `setup.sh`/`setup.ps1`'s own output said
   - Which step it reached
   - The investigated likely cause (or "could not be determined" if no signal was available)
   - That `CLAUDE.md`/`AGENTS.md` may now be missing pending a successful rerun
   - The exact attempted command, as a copyable code block
   - Confirmation that `settings.local.json` and other user-owned files were not touched (they were never in the deletion list)
4. The marker file written in Step 5 still holds `attemptStatus: "pending"` and the attempted command - a later retry (a fresh invocation of this skill) reads it via Step 2's recovery check instead of repeating detection.

## What This Skill Never Does

- Never deletes any file other than `CLAUDE.md`/`AGENTS.md`
- Never proceeds past Step 4 without an explicit human affirmative, regardless of confidence
- Never retries a failed setup re-invocation automatically
- Never invents a flag not already supported by `setup.sh`/`setup.ps1`
- Never treats "which tool" as a failure condition - it is ordinary input, asked once, up front
