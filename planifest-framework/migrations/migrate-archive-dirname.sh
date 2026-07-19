#!/usr/bin/env bash
# migrate-archive-dirname.sh — Rename plan/archive/ to plan/_archive/
# Idempotent: safe to run multiple times.
# Run from the repository root.

set -euo pipefail

OLD="plan/archive"
NEW="plan/_archive"

if [ -d "$OLD" ] && [ -d "$NEW" ]; then
    echo "WARNING: Both $OLD/ and $NEW/ exist."
    echo "Cannot rename automatically. Please resolve manually:"
    echo "  1. Decide which directory is authoritative."
    echo "  2. Move its contents to $NEW/ if needed."
    echo "  3. Delete $OLD/."
    exit 1
fi

if [ -d "$NEW" ] && [ ! -d "$OLD" ]; then
    echo "$NEW/ already exists and $OLD/ is absent — already correct. No changes needed."
    exit 0
fi

if [ ! -d "$OLD" ] && [ ! -d "$NEW" ]; then
    echo "Neither $OLD/ nor $NEW/ exists — nothing to migrate."
    exit 0
fi

# Case: $OLD exists, $NEW does not
echo "Renaming $OLD/ → $NEW/ ..."
mv "$OLD" "$NEW"
echo "Done. $NEW/ is now the archive directory."
