#!/usr/bin/env bash
# Tests for feature 0000020-setup-refresh-skill, req-001 through req-007,
# req-009, req-010 (req-008 has its own live-invocation suite:
# test-0000020-req-008-install-time-marker-write.sh).
#
# These requirements are instructional skill content (planifest-refresh-setup
# is a Markdown skill followed by the agent, not executable code), so
# semantic coverage is structural: grep-based assertions over SKILL.md,
# matching the established pattern for skill-content requirements in this
# repo (see test-0000018-req-003-orchestrator-marker-check-and-prompt.sh).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILL="$FRAMEWORK/skills/planifest-refresh-setup/SKILL.md"

assert_equals "yes" "$([ -f "$SKILL" ] && echo yes || echo no)" \
  "planifest-refresh-setup/SKILL.md exists"

STEP1=$(sed -n '/^## Step 1/,/^## Step 2/p' "$SKILL")
STEP1A=$(sed -n '/^### Step 1a/,/^## Step 2/p' "$SKILL")
STEP2=$(sed -n '/^## Step 2/,/^## Step 3/p' "$SKILL")
STEP3=$(sed -n '/^## Step 3/,/^## Step 4/p' "$SKILL")
STEP4=$(sed -n '/^## Step 4/,/^## Step 5/p' "$SKILL")
STEP5=$(sed -n '/^## Step 5/,/^## Step 6/p' "$SKILL")
STEP6=$(sed -n '/^## Step 6/,/^## Step 7/p' "$SKILL")
STEP7=$(sed -n '/^## Step 7/,/^## Step 8/p' "$SKILL")
STEP8=$(sed -n '/^## Step 8/,/^## Domain Terms/p' "$SKILL")
NEVER=$(sed -n '/^## What This Skill Never Does/,$p' "$SKILL")

echo ""
echo "=== req-001: tool input and detection ==="

assert_contains "always explicit input, never silently guessed" "$STEP1" \
  "req-001: tool is explicit input, not silently guessed"
assert_contains "Exactly one install found: proceed with that tool automatically" "$STEP1" \
  "req-001: single install proceeds without asking"
assert_contains "Two or more installs found: ask the human on the loop" "$STEP1" \
  "req-001: multiple installs trigger a question, not a guess"
assert_contains "normal input, not an error condition (ADR-004)" "$STEP1" \
  "req-001: multi-install case is framed as normal input per ADR-004"

echo ""
echo "=== req-002: flag reconstruction with confidence ==="

assert_contains "high" "$STEP3" "req-002: marker-sourced flags reported at high confidence"
assert_contains "context-mode/\` directory exists with \`.mjs\` files" "$STEP3" \
  "req-002: context-mode hook signal mapped to --context-mode-mcp"
assert_contains "PLANIFEST_TELEMETRY_URL=<url>" "$STEP3" \
  "req-002: telemetry backend URL signal mapped to --backend-url"
assert_contains "plan/.orchestrator-strict\` file exists" "$STEP3" \
  "req-002: strict-orchestrator marker signal mapped"
assert_contains "attribution.txt" "$STEP3" \
  "req-002: attribution.txt signal mapped to --include-full-skill-library"

echo ""
echo "=== req-003: mandatory human confirmation gate ==="

assert_contains "Always required, in every run, regardless of confidence level" "$STEP4" \
  "req-003: confirmation always required regardless of confidence"
assert_contains "There is no bypass." "$STEP4" \
  "req-003: no bypass exists"
assert_contains "halt here and take no further action" "$STEP4" \
  "req-003: rejection halts the skill"

echo ""
echo "=== req-004: safe boot-file deletion ==="

assert_contains "refresh-delete-boot-files.sh" "$STEP6" \
  "req-004: deletion runs through the hardcoded refresh-delete-boot-files script"
assert_contains "cannot be told to delete anything else" "$STEP6" \
  "req-004: allowlist is fixed, non-extensible in code"
assert_contains "Never delete \`settings.local.json\`" "$STEP6" \
  "req-004: settings.local.json explicitly excluded"

echo ""
echo "=== req-005: re-invoke setup with confirmed flags ==="

assert_contains "Run the exact command shown and confirmed in Step 4" "$STEP7" \
  "req-005: re-invocation uses the exact confirmed command"
assert_contains "setup.sh {tool} {flags...}\` on macOS/Linux, \`setup.ps1 {tool} {flags...}\` on Windows" "$STEP7" \
  "req-005: correct script chosen per platform"

echo ""
echo "=== req-006: setup failure handling ==="

assert_contains "Do not retry automatically, under any condition" "$STEP8" \
  "req-006: stops immediately on failure, no auto-retry"
assert_contains "Investigate the likely cause" "$STEP8" \
  "req-006: investigates likely cause"
assert_contains "exact attempted command, as a copyable code block" "$STEP8" \
  "req-006: prints exact attempted command as a code block"
assert_contains "attemptStatus" "$STEP8" \
  "req-006: relies on the cached marker file for retry"

echo ""
echo "=== req-007: no install found handling ==="

assert_contains "No Planifest install found" "$STEP1A" \
  "req-007: reports no install found plainly"
assert_contains "Do not proceed to Step 2." "$STEP1A" \
  "req-007: halts before detection when no install exists"

echo ""
echo "=== req-009: marker write before deletion ==="

assert_contains "before Step 6's deletion" "$STEP5" \
  "req-009: marker written before the deletion step"
assert_contains '"attemptStatus": "pending"' "$STEP5" \
  "req-009: marker records attemptStatus pending before deletion"
assert_contains "not a separate cache file" "$STEP5" \
  "req-009: reuses the single install-time marker file, ADR-002"

echo ""
echo "=== req-010: cross-session recovery ==="

assert_contains "Check for an Interrupted Prior Run" "$STEP2" \
  "req-010: dedicated recovery-detection step exists"
assert_contains 'attemptStatus: "pending"' "$STEP2" \
  "req-010: recovery check reads attemptStatus pending"
assert_contains "skipping Step 3's detection entirely" "$STEP2" \
  "req-010: recovered runs skip re-detection"
assert_contains "If either is false, this is a normal run" "$STEP2" \
  "req-010: no interruption detected falls through to the normal Step 3 detection path"

echo ""
echo "=== Cross-cutting: hardcoded allowlist and no-retry invariants restated ==="

assert_contains "Never deletes any file other than \`CLAUDE.md\`/\`AGENTS.md\`" "$NEVER" \
  "invariant: never deletes files beyond the allowlist"
assert_contains "Never retries a failed setup re-invocation automatically" "$NEVER" \
  "invariant: never auto-retries"
assert_contains "Never proceeds past Step 4 without an explicit human affirmative" "$NEVER" \
  "invariant: never bypasses confirmation"

print_summary
