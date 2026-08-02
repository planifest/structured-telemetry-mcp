#!/usr/bin/env bash
# Regression test: gate-write.mjs Windows path normalisation (REQ-007, ADR-005)
#
# Delegates to test-gate-write-windows.mjs which uses Node.js os.tmpdir() to
# produce OS-native paths that work correctly on Windows/Git Bash.
# (Bash mktemp -d returns /tmp/... paths that Node.js resolves to \tmp\... on Windows.)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../helpers/assert.sh"

node "$SCRIPT_DIR/test-gate-write-windows.mjs"
EXIT=$?

if [ $EXIT -eq 0 ]; then
  echo ""
  echo "All gate-write Windows tests passed ✓"
else
  echo ""
  echo "gate-write Windows tests FAILED ✗"
fi

exit $EXIT
