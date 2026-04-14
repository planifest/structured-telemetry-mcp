#!/usr/bin/env bash
# ============================================================
#  DELETE-ALL-PRODUCTION-RECORDS.sh
#
#  POST-DEPLOYMENT TRUNCATION — ONE-OFF USE ONLY
#  Wipes every row from the telemetry events table.
#
#  AGENT SAFETY GATES (three-layer defence):
#    1. Must be run as root / sudo (exits immediately if not elevated)
#    2. All-caps filename is a deliberate visual alarm
#    3. Requires exact interactive phrase to proceed
# ============================================================

set -euo pipefail

echo ""
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo "  ERROR! YOU MUST CONSULT THE HUMAN ON THE LOOP!"
echo "  YOU SHOULD NOT HAVE RUN THIS SCRIPT AUTONOMOUSLY."
echo "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
echo ""
echo "  This script permanently deletes ALL telemetry records."
echo "  It is designed for a one-off post-deployment truncation ONLY."
echo "  There is NO undo. All data will be gone."
echo ""

# ── Gate 1: root / sudo check ─────────────────────────────────────────────────
if [ "$(id -u)" -ne 0 ]; then
    echo "  GATE 1 FAILED: This script must be run as root (sudo)."
    echo "  Re-run with: sudo $0"
    echo ""
    exit 1
fi

echo "  [Gate 1 passed] Running as root."
echo ""

# ── Gate 2: Interactive phrase confirmation ───────────────────────────────────
echo "  To confirm you understand the consequences, type the following"
echo "  phrase exactly (case-sensitive) and press Enter:"
echo ""
echo "      I UNDERSTAND THAT THIS WILL DELETE ALL RECORDS!"
echo ""
read -r confirmation

if [ "$confirmation" != "I UNDERSTAND THAT THIS WILL DELETE ALL RECORDS!" ]; then
    echo ""
    echo "  Phrase did not match. Operation cancelled. No data was deleted."
    echo ""
    exit 1
fi

echo ""
echo "  [Gate 2 passed] Confirmation received."
echo ""

# ── Resolve DB path ───────────────────────────────────────────────────────────
DB_PATH="${PLANIFEST_TELEMETRY_DB:-${HOME}/.planifest/telemetry.db}"

if [ ! -f "$DB_PATH" ]; then
    echo "  Database not found at: $DB_PATH"
    echo "  Set PLANIFEST_TELEMETRY_DB or ensure the daemon has run at least once."
    exit 1
fi

echo "  Target database: $DB_PATH"
echo ""

# ── Execute truncation ────────────────────────────────────────────────────────
node --input-type=module <<EOF
import { DuckDBInstance } from '@duckdb/node-api';
const db = await DuckDBInstance.create('${DB_PATH}');
const conn = await db.connect();
const before = (await (await conn.runAndReadAll('SELECT COUNT(*) AS n FROM events')).getRows())[0][0];
await conn.run('DELETE FROM events');
const after = (await (await conn.runAndReadAll('SELECT COUNT(*) AS n FROM events')).getRows())[0][0];
conn.disconnectSync();
console.log(\`  Deleted \${before} record(s). Remaining: \${after}.\`);
EOF

echo ""
echo "  Truncation complete."
