#!/usr/bin/env bash
set -euo pipefail

# This repo lives two levels down from d/, e.g. d/planifest/framework
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RELEASE_DIR="$SCRIPT_DIR/../../_latest-planifest-framework-release"
SRC_DIR="$RELEASE_DIR/planifest-framework"
DEST_DIR="$SCRIPT_DIR/planifest-framework"

if [ ! -d "$SRC_DIR" ]; then
  echo "Release source folder not found: $SRC_DIR" >&2
  exit 1
fi

# 1 - remove the existing planifest-framework folder in this repo, if present
rm -rf "$DEST_DIR"

# 2 - copy the latest release's planifest-framework folder into this repo
cp -R "$SRC_DIR" "$DEST_DIR"

echo "Replaced $DEST_DIR with $SRC_DIR"
