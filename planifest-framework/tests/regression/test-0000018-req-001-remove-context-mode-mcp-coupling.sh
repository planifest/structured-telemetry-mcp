#!/usr/bin/env bash
# Tests for feature 0000018-telemetry-emission-consistency, req-001:
# remove-context-mode-mcp-coupling.
#
# Covers ADR-001: --structured-telemetry-mcp alone must be sufficient to wire
# the telemetry hooks in both setup.sh and setup.ps1 — the --context-mode-mcp
# AND-condition is removed entirely, closing the gap that caused 0000017's
# telemetry loss (a project passing only --structured-telemetry-mcp got the
# .claude/telemetry-enabled sentinel but the hooks were never wired).

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../helpers/assert.sh"

FRAMEWORK="$SCRIPT_DIR/../.."
SETUP_SH="$FRAMEWORK/setup.sh"
SETUP_PS1="$FRAMEWORK/setup.ps1"

file_exists()   { [ -f "$1" ] && echo "yes" || echo "no"; }
dir_exists()    { [ -d "$1" ] && echo "yes" || echo "no"; }
grep_has()      { grep -q "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }
grep_has_fixed(){ grep -qF -- "$1" "$2" 2>/dev/null && echo "yes" || echo "no"; }
grep_str()      { grep "$1" "$2" 2>/dev/null || true; }

get_posttooluse_json() {
  local settings_file="$1"
  node -e "
    const fs = require('fs');
    const raw = fs.readFileSync('$settings_file', 'utf8').replace(/^﻿/,'');
    const j = JSON.parse(raw);
    console.log(JSON.stringify(j?.hooks?.PostToolUse ?? []));
  "
}

make_workspace() {
  local dir
  dir=$(mktemp -d -t planifest_0000018_req001_test_XXXXXX)
  cp -r "$FRAMEWORK" "$dir/planifest-framework"
  # git init so activate_guardrails() (git config core.hooksPath) doesn't fail
  git init "$dir" >/dev/null 2>&1
  git config --global --add safe.directory "$dir" >/dev/null 2>&1 || true
  echo "$dir"
}

# ── (a): setup.sh gate no longer requires CONTEXT_MODE_MCP ──────────────────

echo ""
echo "=== (a): setup.sh telemetry-hook-install gate decoupled from CONTEXT_MODE_MCP ==="

# Fixed-string match on the exact gate opener line (no CONTEXT_MODE_MCP conjunct on it).
assert_equals "yes" "$(grep_has_fixed 'if [ "$STRUCTURED_TELEMETRY_MCP" = true ] && \' "$SETUP_SH")" \
  "(a): setup.sh install_telemetry_hooks gate opens on STRUCTURED_TELEMETRY_MCP alone"

# Scan the whole comment+if/fi block that calls install_telemetry_hooks and
# confirm CONTEXT_MODE_MCP is not referenced anywhere inside it.
SH_BLOCK="$(sed -n '/No longer requires --context-mode-mcp/,/^  fi$/p' "$SETUP_SH")"
assert_equals "no" \
  "$(echo "$SH_BLOCK" | grep -q "CONTEXT_MODE_MCP" && echo "yes" || echo "no")" \
  "(a): setup.sh telemetry install gate no longer tests CONTEXT_MODE_MCP anywhere in its if-block"

assert_equals "yes" "$(grep_has "0000018 req-001" "$SETUP_SH")" \
  "(a): setup.sh documents the 0000018 req-001 decoupling inline"

# ── (b): setup.ps1 equivalent gate is fixed the same way ────────────────────

echo ""
echo "=== (b): setup.ps1 telemetry-hook-install gate decoupled from ContextModeMcp ==="

# Fixed-string match on the exact gate opener line (no -and $ContextModeMcp conjunct on it).
assert_equals "yes" "$(grep_has_fixed 'if ($StructuredTelemetryMcp -and' "$SETUP_PS1")" \
  "(b): setup.ps1 install gate opens on \$StructuredTelemetryMcp alone"

# Scan the whole comment+if-block that calls Install-TelemetryHooks and
# confirm $ContextModeMcp is not referenced anywhere inside it.
PS1_BLOCK="$(sed -n '/No longer requires --context-mode-mcp/,/^    }$/p' "$SETUP_PS1")"
assert_equals "no" \
  "$(echo "$PS1_BLOCK" | grep -q "ContextModeMcp" && echo "yes" || echo "no")" \
  "(b): setup.ps1 telemetry install gate no longer tests \$ContextModeMcp anywhere in its if-block"

assert_equals "yes" "$(grep_has "0000018 req-001" "$SETUP_PS1")" \
  "(b): setup.ps1 documents the 0000018 req-001 decoupling inline"

# ── (c): live invocation — --structured-telemetry-mcp alone wires the hooks ─

echo ""
echo "=== (c): setup.sh claude-code --structured-telemetry-mcp (no --context-mode-mcp) wires telemetry hooks ==="

WS=$(make_workspace); cd "$WS"
bash planifest-framework/setup.sh claude-code --structured-telemetry-mcp >/dev/null 2>&1
assert_exit_zero $? "(c): setup exits 0 with --structured-telemetry-mcp alone"

assert_equals "yes" "$(file_exists ".claude/telemetry-enabled")" \
  "(c): .claude/telemetry-enabled sentinel created"

assert_equals "yes" "$(file_exists ".claude/hooks/telemetry/context-pressure.mjs")" \
  "(c): context-pressure.mjs hook script installed without --context-mode-mcp"

assert_equals "no" "$(dir_exists ".claude/hooks/context-mode")" \
  "(c): context-mode hooks NOT installed (flag was not passed) — confirms flags remain independent"

PT=$(get_posttooluse_json ".claude/settings.json")
assert_contains "context-pressure" "$PT" \
  "(c): PostToolUse references context-pressure.mjs"
assert_contains "PLANIFEST_TELEMETRY_URL" "$PT" \
  "(c): backend URL env var embedded in hook command"
assert_contains "localhost:3741" "$PT" \
  "(c): default backend URL value present in hook command"

cd "$SCRIPT_DIR"
rm -rf "$WS"

# ── Regression: both flags together still work unchanged ────────────────────

echo ""
echo "=== Regression: --structured-telemetry-mcp + --context-mode-mcp still wires hooks ==="

WS=$(make_workspace); cd "$WS"
bash planifest-framework/setup.sh claude-code --context-mode-mcp --structured-telemetry-mcp >/dev/null 2>&1
assert_exit_zero $? "regression: setup exits 0 with both flags"

assert_equals "yes" "$(file_exists ".claude/hooks/telemetry/context-pressure.mjs")" \
  "regression: context-pressure.mjs still installed with both flags"

assert_equals "yes" "$(dir_exists ".claude/hooks/context-mode")" \
  "regression: context-mode hooks still installed with both flags"

cd "$SCRIPT_DIR"
rm -rf "$WS"

print_summary
