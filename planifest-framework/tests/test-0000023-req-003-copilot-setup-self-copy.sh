#!/usr/bin/env bash
# Tests for feature 0000023-framework-pipeline-fixes, req-003:
# copilot-setup-self-copy-fix.
#
# Covers: TOOL_HOOK_ADAPTER_DEST in setup/copilot.sh used to resolve to the
# same absolute path as TOOL_HOOK_ADAPTER_SRC once install_tier1_hooks()
# prepended $SCRIPT_DIR / $PROJECT_ROOT, so `cp "$adapter_src" "$adapter_dest"`
# failed with BSD/macOS cp's "identical, not copied" (exit 1), and setup.sh
# runs under `set -euo pipefail`, aborting every `setup.sh copilot` and
# `setup.sh all` invocation. The fix points the destination at a project-local
# path (.github/hooks/adapters/copilot.mjs), consistent with every other
# Tier-1 tool.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$SCRIPT_DIR/.."
SETUP_PS1="$FRAMEWORK/setup.ps1"
COPILOT_PS1="$FRAMEWORK/setup/copilot.ps1"

file_exists() { [ -f "$1" ] && echo "yes" || echo "no"; }
grep_has() { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

read_json_field() {
  local file="$1"
  local field="$2"
  python3 -c "
import json
with open('$file') as f:
    data = json.load(f)
val = data.get('$field')
print(json.dumps(val))
" 2>/dev/null
}

make_workspace() {
  local dir
  dir=$(mktemp -d -t planifest_0000023_req003_test_XXXXXX)
  cp -r "$FRAMEWORK" "$dir/planifest-framework"
  git init "$dir" >/dev/null 2>&1
  git config --global --add safe.directory "$dir" >/dev/null 2>&1 || true
  echo "$dir"
}

# ── (a): setup.sh copilot exits 0 in a fresh workspace ──────────────────────

echo ""
echo "=== (a): setup.sh copilot exits 0 on a fresh disposable workspace ==="

WS=$(make_workspace); cd "$WS"
bash planifest-framework/setup.sh copilot >/tmp/planifest_0000023_req003_copilot_stdout.log 2>&1
COPILOT_EXIT=$?
assert_exit_zero "$COPILOT_EXIT" "(a): setup.sh copilot exits 0"

# ── (b): the adapter lands at the project-local destination, not back in
#         planifest-framework/ ────────────────────────────────────────────

echo ""
echo "=== (b): adapter lands at .github/hooks/adapters/copilot.mjs ==="

assert_equals "yes" "$(file_exists ".github/hooks/adapters/copilot.mjs")" \
  "(b): .github/hooks/adapters/copilot.mjs exists after install"

# ── (c): the copy went outward — the source copy inside the workspace's own
#         planifest-framework/ tree is untouched by the install ────────────

echo ""
echo "=== (c): the source copy of the adapter is unmodified by install ==="

ORIGINAL_ADAPTER_HASH="$(shasum -a 256 "$FRAMEWORK/hooks/adapters/copilot.mjs" | awk '{print $1}')"
WORKSPACE_SOURCE_ADAPTER_HASH="$(shasum -a 256 "$WS/planifest-framework/hooks/adapters/copilot.mjs" | awk '{print $1}')"

assert_equals "$ORIGINAL_ADAPTER_HASH" "$WORKSPACE_SOURCE_ADAPTER_HASH" \
  "(c): planifest-framework/hooks/adapters/copilot.mjs in the workspace copy still matches the framework original (untouched by install)"

# ── (d): .github/hooks/planifest.json's two command fields both point at the
#         new destination ───────────────────────────────────────────────────

echo ""
echo "=== (d): .github/hooks/planifest.json command fields reference the new destination ==="

PRE_TOOL_USE_CMD="$(read_json_field ".github/hooks/planifest.json" "hooks" 2>/dev/null)"
PRE_TOOL_USE_CMD_RAW="$(python3 -c "
import json
with open('.github/hooks/planifest.json') as f:
    data = json.load(f)
print(data['hooks']['preToolUse'][0]['command'])
" 2>/dev/null)"
USER_PROMPT_CMD_RAW="$(python3 -c "
import json
with open('.github/hooks/planifest.json') as f:
    data = json.load(f)
print(data['hooks']['userPromptSubmitted'][0]['command'])
" 2>/dev/null)"

assert_equals "node .github/hooks/adapters/copilot.mjs" "$PRE_TOOL_USE_CMD_RAW" \
  "(d): preToolUse command reads node .github/hooks/adapters/copilot.mjs"

assert_equals "node .github/hooks/adapters/copilot.mjs" "$USER_PROMPT_CMD_RAW" \
  "(d): userPromptSubmitted command reads node .github/hooks/adapters/copilot.mjs"

cd "$SCRIPT_DIR"
rm -rf "$WS"

# ── (e): setup.sh all (which includes the copilot target) also exits 0 ──────
#
# NOTE: as of this fix, "setup.sh all" is still blocked from reaching exit 0
# by a separate, pre-existing, unrelated bug in setup/cline.sh: it sets
# TOOL_SKILLS_DIR=".clinerules/skills" (which creates ".clinerules" as a
# directory via mkdir -p) and TOOL_BOOT_FILE=".clinerules" (the *same* path,
# written as a plain file by write_boot_file's `echo "$content" > "$path"`),
# so writing the boot file fails with "Is a directory". Previously this was
# masked because "all" crashed at the copilot step first (VALID_TOOLS
# processes copilot before cline) — the self-copy fix in this requirement
# unmasks it rather than causing it. Fixing cline.sh is out of scope for
# req-003 (setup/cline.sh is not one of the files this requirement touches),
# so the assertions below verify req-003's own fix in isolation (no self-copy
# crash, copilot's own artifacts install correctly during "all") separately
# from the full-suite exit code, which is left asserted (and expected to
# still fail) so this gap stays visible rather than being silently dropped.

echo ""
echo "=== (e): setup.sh all — req-003's fix holds even inside the 'all' run ==="

WS=$(make_workspace); cd "$WS"
bash planifest-framework/setup.sh all >/tmp/planifest_0000023_req003_all_stdout.log 2>&1
ALL_EXIT=$?

assert_equals "no" "$(grep_has 'identical (not copied)' /tmp/planifest_0000023_req003_all_stdout.log)" \
  "(e): no BSD cp self-copy 'identical (not copied)' error anywhere in the 'all' run (req-003's specific bug)"

assert_equals "yes" "$(file_exists ".github/hooks/adapters/copilot.mjs")" \
  "(e): setup.sh all still installs .github/hooks/adapters/copilot.mjs correctly"

# Known pre-existing, unrelated blocker (see NOTE above) — left asserted so the
# gap is visible rather than silently dropped. Expected to fail until
# setup/cline.sh's boot-file/skills-dir path collision is fixed separately.
assert_exit_zero "$ALL_EXIT" "(e): setup.sh all exits 0 (blocked by unrelated pre-existing cline.sh bug, see NOTE above — not a req-003 regression)"

cd "$SCRIPT_DIR"
rm -rf "$WS"

# ── (f): copilot.ps1 and setup.ps1 parity (static source check) ─────────────
# A live pwsh invocation is not run here, this environment has no PowerShell
# runtime available (see src/setup-hook-integration/component.yml Q-006).
# Parity is checked statically.

echo ""
echo "=== (f): copilot.ps1 declares the Tier-1 hook adapter keys ==="

assert_equals "yes" "$(grep_has "HookAdapterSrc" "$COPILOT_PS1")" \
  "(f): copilot.ps1 declares HookAdapterSrc"

assert_equals "yes" "$(grep_has "HookAdapterDest" "$COPILOT_PS1")" \
  "(f): copilot.ps1 declares HookAdapterDest"

assert_equals "yes" "$(grep_has "HooksInstallDir" "$COPILOT_PS1")" \
  "(f): copilot.ps1 declares HooksInstallDir"

echo ""
echo "=== (g): setup.ps1's Install-CopilotAdapter no longer references the stale in-place path ==="

assert_equals "no" "$(grep_has 'planifest-framework/hooks/adapters/copilot.mjs' "$SETUP_PS1")" \
  "(g): setup.ps1 no longer contains the stale planifest-framework/hooks/adapters/copilot.mjs command string"

assert_equals "yes" "$(grep_has 'node \.github/hooks/adapters/copilot\.mjs' "$SETUP_PS1")" \
  "(g): setup.ps1's Install-CopilotAdapter registers the new .github/hooks/adapters/copilot.mjs destination"

echo ""
echo "=== (h): setup.ps1's dispatcher guards Install-Tier1HookRegistration on SettingsFile presence ==="

# Structural check scoped to the Tier-1 dispatcher block only (there are other,
# unrelated `if ($toolConfig.SettingsFile)` guards elsewhere in setup.ps1, e.g.
# for merge_allowed_tools, so a plain grep over the whole file would false-pass
# even without the fix). Isolate the block between the REQ-009 dispatcher
# comment and the next top-level comment, and require a dedicated
# SettingsFile-presence `if` between the Install-Tier1Hooks and
# Install-Tier1HookRegistration calls.
TIER1_DISPATCHER_GUARD_OK="$(python3 -c "
import re
with open('$SETUP_PS1') as f:
    content = f.read()
start = content.find('Install Tier 1 adapter for tools with native hook support')
end = content.find('Write manifest listing all installed skill directories', start)
block = content[start:end] if start != -1 and end != -1 else ''
# Match the actual call site (backtick line-continuation), not a prose mention
# of the function name inside an explanatory comment.
reg_match = re.search(r'Install-Tier1HookRegistration\s*\`', block)
hooks_match = re.search(r'Install-Tier1Hooks\s*\`', block)
between = block[hooks_match.end():reg_match.start()] if hooks_match and reg_match else ''
guarded = bool(re.search(r'if\s*\(\\\$toolConfig\.SettingsFile\)\s*\{', between))
print('yes' if guarded else 'no')
" 2>/dev/null)"

assert_equals "yes" "$TIER1_DISPATCHER_GUARD_OK" \
  "(h): setup.ps1 dispatcher has a dedicated SettingsFile-presence guard (distinct from the Tier/HookAdapterSrc guard) around Install-Tier1HookRegistration, mirroring setup.sh's independent two-condition structure"

print_summary
