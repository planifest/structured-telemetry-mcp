#!/usr/bin/env bash
# build.sh — compile and bundle structured-telemetry-mcp.

set -euo pipefail

echo "Building structured-telemetry-mcp..."
npm run build
echo "Build complete: server.bundle.mjs, cli.bundle.mjs"
