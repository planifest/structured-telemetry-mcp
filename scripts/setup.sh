#!/usr/bin/env bash
# setup.sh — Planifest framework integration for structured-telemetry-mcp.
# Called by planifest/setup.sh --structured-telemetry-mcp (0008b).
#
# Usage: ./scripts/setup.sh [--db-path /custom/path/telemetry.db]

set -euo pipefail

DB_PATH="${PLANIFEST_TELEMETRY_DB:-$HOME/.planifest/telemetry.db}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --db-path) DB_PATH="$2"; shift 2 ;;
    *) shift ;;
  esac
done

mkdir -p "$(dirname "$DB_PATH")"

echo "  structured-telemetry-mcp: registering MCP server..."
echo "  DB path: $DB_PATH"

npx structured-telemetry-mcp setup --non-interactive --db-path "$DB_PATH" 2>/dev/null || \
  node "$(dirname "$0")/../cli.bundle.mjs" setup --non-interactive --db-path "$DB_PATH" || \
  echo "  Warning: could not auto-register. Run 'npx structured-telemetry-mcp setup' manually."

echo "  structured-telemetry-mcp: setup complete."
