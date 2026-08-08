#!/usr/bin/env bash
# Tests for feature 0000025-pipeline-gate-and-config-fixes-and-ship-agent-fixes,
# req-004: setup config relocation.
#
# Covers ADR-002 (setup config overrides precedence): setup.sh/setup.ps1 write
# planifest-overrides/setup-config/{tool}.md as the tracked, git-versioned source
# of truth for active setup flags/backendUrl, in addition to (not instead of) the
# existing gitignored {tool-dir}/.planifest-setup-flags marker. The marker
# continues to be written and its flags/backendUrl must match the tracked file's
# for the same run (ADR-002 decision 3 — both are regenerated from the same
# current-run values, so they never disagree coming out of a single setup run).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$SCRIPT_DIR/.."
SETUP_PS1="$FRAMEWORK/setup.ps1"

file_exists() { [ -f "$1" ] && echo "yes" || echo "no"; }
dir_exists() { [ -d "$1" ] && echo "yes" || echo "no"; }

# Reads a field from the gitignored JSON marker file.
read_marker_field() {
  local file="$1"
  local field="$2"
  node -e '
    const fs = require("fs");
    const j = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    const v = j[process.argv[2]];
    console.log(v === undefined || v === null ? "null" : JSON.stringify(v));
  ' "$file" "$field" 2>/dev/null
}

# Reads a field from the tracked planifest-overrides/setup-config/{tool}.md file's
# fenced ```json block — the same flags/backendUrl shape as the marker (req-004).
read_config_field() {
  local file="$1"
  local field="$2"
  awk '/^```json$/{flag=1; next} /^```$/{flag=0} flag' "$file" | node -e '
    let d = "";
    process.stdin.on("data", (c) => (d += c));
    process.stdin.on("end", () => {
      const j = JSON.parse(d);
      const v = j[process.argv[1]];
      console.log(v === undefined || v === null ? "null" : JSON.stringify(v));
    });
  ' "$field" 2>/dev/null
}

make_workspace() {
  local dir
  dir=$(mktemp -d -t planifest_0000025_req004_test_XXXXXX)
  cp -r "$FRAMEWORK" "$dir/planifest-framework"
  git init "$dir" >/dev/null 2>&1
  git config --global --add safe.directory "$dir" >/dev/null 2>&1 || true
  echo "$dir"
}

# ── (a): first-run/bootstrap — no planifest-overrides/setup-config/ yet ─────

echo ""
echo "=== (a): setup.sh claude-code (no flags) bootstraps planifest-overrides/setup-config/ ==="

WS=$(make_workspace); cd "$WS"
assert_equals "no" "$(dir_exists "planifest-overrides/setup-config")" \
  "(a): planifest-overrides/setup-config/ does not exist before setup runs"

bash planifest-framework/setup.sh claude-code >/dev/null 2>&1
assert_exit_zero $? "(a): setup exits 0 on first run with no pre-existing setup-config dir"

assert_equals "yes" "$(dir_exists "planifest-overrides/setup-config")" \
  "(a): planifest-overrides/setup-config/ created by setup"

assert_equals "yes" "$(file_exists "planifest-overrides/setup-config/claude-code.md")" \
  "(a): tracked per-tool config file created for claude-code"

assert_equals "yes" "$(file_exists ".claude/.planifest-setup-flags")" \
  "(a): existing gitignored marker is still written (additive, not replaced)"

assert_equals '"claude-code"' "$(read_config_field "planifest-overrides/setup-config/claude-code.md" "tool")" \
  "(a): tracked file records tool name"

assert_equals "[]" "$(read_config_field "planifest-overrides/setup-config/claude-code.md" "flags")" \
  "(a): tracked file flags empty when no flags passed"

assert_equals "null" "$(read_config_field "planifest-overrides/setup-config/claude-code.md" "backendUrl")" \
  "(a): tracked file backendUrl null when telemetry flag not passed"

cd "$SCRIPT_DIR"
rm -rf "$WS"

# ── (b): flags/backendUrl match between tracked file and marker ─────────────

echo ""
echo "=== (b): setup.sh claude-code with flags — tracked file and marker agree ==="

WS=$(make_workspace); cd "$WS"
bash planifest-framework/setup.sh claude-code --context-mode-mcp --structured-telemetry-mcp \
  --strict-orchestrator --backend-url http://example.test:9999 >/dev/null 2>&1
assert_exit_zero $? "(b): setup exits 0 with all flags"

CONFIG_FLAGS="$(read_config_field "planifest-overrides/setup-config/claude-code.md" "flags")"
MARKER_FLAGS="$(read_marker_field ".claude/.planifest-setup-flags" "flags")"

assert_contains "--context-mode-mcp" "$CONFIG_FLAGS" "(b): tracked file records --context-mode-mcp"
assert_contains "--structured-telemetry-mcp" "$CONFIG_FLAGS" "(b): tracked file records --structured-telemetry-mcp"
assert_contains "--strict-orchestrator" "$CONFIG_FLAGS" "(b): tracked file records --strict-orchestrator"

assert_equals "$MARKER_FLAGS" "$CONFIG_FLAGS" \
  "(b): tracked file flags match marker flags for the same run"

CONFIG_URL="$(read_config_field "planifest-overrides/setup-config/claude-code.md" "backendUrl")"
MARKER_URL="$(read_marker_field ".claude/.planifest-setup-flags" "backendUrl")"

assert_equals '"http://example.test:9999"' "$CONFIG_URL" \
  "(b): tracked file records custom --backend-url"
assert_equals "$MARKER_URL" "$CONFIG_URL" \
  "(b): tracked file backendUrl matches marker backendUrl for the same run"

cd "$SCRIPT_DIR"
rm -rf "$WS"

# ── (c): tracked file is not gitignored — shows up as trackable in git ──────

echo ""
echo "=== (c): planifest-overrides/setup-config/claude-code.md is not gitignored ==="

WS=$(make_workspace); cd "$WS"
bash planifest-framework/setup.sh claude-code >/dev/null 2>&1

if git check-ignore -q "planifest-overrides/setup-config/claude-code.md" 2>/dev/null; then
  IGNORED="yes"
else
  IGNORED="no"
fi
assert_equals "no" "$IGNORED" \
  "(c): tracked config file is not matched by any .gitignore rule"

STATUS_LINE="$(git status --porcelain -- planifest-overrides/setup-config/claude-code.md 2>/dev/null)"
assert_contains "planifest-overrides/setup-config/claude-code.md" "$STATUS_LINE" \
  "(c): tracked config file appears as trackable/committable in git status"

STATUS_MARKER_LINE="$(git status --porcelain -- .claude/.planifest-setup-flags 2>/dev/null)"
assert_equals "" "$STATUS_MARKER_LINE" \
  "(c): gitignored marker does not appear in git status (unlike the tracked file)"

cd "$SCRIPT_DIR"
rm -rf "$WS"

# ── (d): per-tool naming — a second tool gets its own file, doesn't clobber ──

echo ""
echo "=== (d): setup.sh cursor writes setup-config/cursor.md, not claude-code.md ==="

WS=$(make_workspace); cd "$WS"
bash planifest-framework/setup.sh cursor >/dev/null 2>&1
assert_exit_zero $? "(d): setup exits 0 for cursor"

assert_equals "yes" "$(file_exists "planifest-overrides/setup-config/cursor.md")" \
  "(d): tracked config file written under cursor.md"

assert_equals "no" "$(file_exists "planifest-overrides/setup-config/claude-code.md")" \
  "(d): no claude-code.md written when only cursor was set up"

assert_equals '"cursor"' "$(read_config_field "planifest-overrides/setup-config/cursor.md" "tool")" \
  "(d): tool field is cursor"

cd "$SCRIPT_DIR"
rm -rf "$WS"

# ── (e): write failure falls back to marker-only behavior, does not abort ───

echo ""
echo "=== (e): setup.sh still completes if planifest-overrides/setup-config/ can't be written ==="

if [ "$(id -u)" = "0" ]; then
  echo "  SKIP: running as root — permission-based failure case cannot be exercised"
else
  WS=$(make_workspace); cd "$WS"
  mkdir -p "planifest-overrides"
  chmod 555 "planifest-overrides"

  bash planifest-framework/setup.sh claude-code >/dev/null 2>&1
  FALLBACK_EXIT=$?
  chmod 755 "planifest-overrides"

  assert_exit_zero "$FALLBACK_EXIT" \
    "(e): setup exits 0 even when planifest-overrides/setup-config/ cannot be created"

  assert_equals "yes" "$(file_exists ".claude/.planifest-setup-flags")" \
    "(e): marker still written when the tracked-file write fails (fallback behavior)"

  assert_equals "no" "$(file_exists "planifest-overrides/setup-config/claude-code.md")" \
    "(e): tracked config file was not created when its directory couldn't be written"

  cd "$SCRIPT_DIR"
  rm -rf "$WS"
fi

# ── (f): setup.ps1 defines the same tracked-config-write logic (static check) ─
# A live pwsh invocation is not run here; this environment has no PowerShell
# runtime available (same constraint as test-0000020-req-008).

echo ""
echo "=== (f): setup.ps1 defines the matching tracked setup-config writer ==="

grep_has() { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }

assert_equals "yes" "$(grep_has 'function Write-SetupConfigOverride' "$SETUP_PS1")" \
  "(f): setup.ps1 defines Write-SetupConfigOverride"

assert_equals "yes" "$(grep_has 'planifest-overrides' "$SETUP_PS1")" \
  "(f): setup.ps1 references planifest-overrides"

assert_equals "yes" "$(grep_has 'setup-config' "$SETUP_PS1")" \
  "(f): setup.ps1 references the setup-config subdirectory"

assert_equals "yes" "$(grep_has 'Write-SetupConfigOverride -ToolName \$ToolName' "$SETUP_PS1")" \
  "(f): setup.ps1 calls the tracked-config writer from inside Invoke-PlanifestSetup"

print_summary
