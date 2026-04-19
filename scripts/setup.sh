#!/usr/bin/env bash
# setup.sh — Planifest framework integration for structured-telemetry-mcp.
# Called by planifest/setup.sh --structured-telemetry-mcp (0008b).
#
# Usage: ./scripts/setup.sh [--db-path /custom/path/telemetry.db] [--tool <tool>]
#
# Supported --tool values: claudecode | cursor | windsurf | vscode | zed | manual

set -euo pipefail

DB_PATH="${PLANIFEST_TELEMETRY_DB:-$HOME/.planifest/telemetry.db}"
TOOL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-path) DB_PATH="$2"; shift 2 ;;
    --tool)    TOOL="$2";    shift 2 ;;
    *) shift ;;
  esac
done

mkdir -p "$(dirname "$DB_PATH")"

# ── helpers ───────────────────────────────────────────────────────────────────

BUNDLE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUNDLE="$BUNDLE_DIR/server.bundle.mjs"

merge_json_key() {
  # merge_json_key <file> <key> <entry_json>
  # Adds key.<entry_key> to the JSON object at <key> inside <file>.
  local file="$1" key="$2" entry_name="$3" entry_json="$4"
  if [[ ! -f "$file" ]]; then
    echo "{ \"$key\": { \"$entry_name\": $entry_json } }" > "$file"
  else
    # Use node to merge — avoids a python/jq dependency assumption
    node -e "
const fs = require('fs');
const obj = JSON.parse(fs.readFileSync('$file', 'utf8'));
obj['$key'] = obj['$key'] || {};
obj['$key']['$entry_name'] = $entry_json;
fs.writeFileSync('$file', JSON.stringify(obj, null, 2));
"
  fi
}

# ── tool-specific registration ─────────────────────────────────────────────────

setup_claudecode() {
  local config="$HOME/.claude/claude_mcp_settings.json"
  local entry='{"command":"node","args":["'"$BUNDLE"'","--http","http://localhost:3741"]}'
  echo "  Registering with Claude Code → $config"
  merge_json_key "$config" mcpServers structured-telemetry-mcp "$entry"
}

setup_cursor() {
  local config="$HOME/.cursor/mcp.json"
  local entry='{"command":"node","args":["'"$BUNDLE"'","--http","http://localhost:3741"]}'
  echo "  Registering with Cursor → $config"
  merge_json_key "$config" mcpServers structured-telemetry-mcp "$entry"
}

setup_windsurf() {
  local config="$HOME/.codeium/windsurf/mcp_config.json"
  local entry='{"command":"node","args":["'"$BUNDLE"'","--http","http://localhost:3741"]}'
  echo "  Registering with Windsurf → $config"
  merge_json_key "$config" mcpServers structured-telemetry-mcp "$entry"
}

setup_vscode() {
  local config="$HOME/.vscode/mcp.json"
  local entry='{"type":"stdio","command":"node","args":["'"$BUNDLE"'","--http","http://localhost:3741"]}'
  echo "  Registering with VS Code → $config"
  merge_json_key "$config" servers structured-telemetry-mcp "$entry"
}

setup_zed() {
  local config="$HOME/.config/zed/settings.json"
  mkdir -p "$(dirname "$config")"
  # Zed uses context_servers with { command: { path, args } }
  local entry="{\"command\":{\"path\":\"node\",\"args\":[\"$BUNDLE\",\"--http\",\"http://localhost:3741\"]}}"
  echo "  Registering with Zed → $config"
  if [[ ! -f "$config" ]]; then
    echo "{ \"context_servers\": { \"structured-telemetry-mcp\": $entry } }" > "$config"
  else
    node -e "
const fs = require('fs');
const obj = JSON.parse(fs.readFileSync('$config', 'utf8'));
obj['context_servers'] = obj['context_servers'] || {};
obj['context_servers']['structured-telemetry-mcp'] = $entry;
fs.writeFileSync('$config', JSON.stringify(obj, null, 2));
"
  fi
}

setup_manual() {
  echo ""
  echo "  Manual registration:"
  echo "  Add the following to your editor's MCP config:"
  echo ""
  echo '  "structured-telemetry-mcp": {'
  echo '    "command": "node",'
  echo "    \"args\": [\"$BUNDLE\", \"--http\", \"http://localhost:3741\"]"
  echo '  }'
  echo ""
}

# ── core setup ─────────────────────────────────────────────────────────────────

echo "  structured-telemetry-mcp: registering MCP server..."
echo "  DB path: $DB_PATH"

npx structured-telemetry-mcp setup --non-interactive --db-path "$DB_PATH" 2>/dev/null || \
  node "$BUNDLE_DIR/cli.bundle.mjs" setup --non-interactive --db-path "$DB_PATH" || \
  echo "  Warning: could not auto-register. Run 'npx structured-telemetry-mcp setup' manually."

# ── tool registration ──────────────────────────────────────────────────────────

case "$TOOL" in
  claudecode) setup_claudecode ;;
  cursor)     setup_cursor ;;
  windsurf)   setup_windsurf ;;
  vscode)     setup_vscode ;;
  zed)        setup_zed ;;
  manual)     setup_manual ;;
  "")         ;; # no --tool flag — core setup only
  *)
    echo "  Warning: unknown --tool '$TOOL'. Supported: claudecode | cursor | windsurf | vscode | zed | manual"
    ;;
esac

echo "  structured-telemetry-mcp: setup complete."
