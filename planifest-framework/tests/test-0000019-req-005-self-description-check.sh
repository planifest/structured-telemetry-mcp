#!/usr/bin/env bash
# Tests for feature 0000019, req-005: repository self-description CI check.
# Covers planifest-framework/scripts/self-description-check.mjs directly.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$FRAMEWORK/.." && pwd)"
CHECK="$FRAMEWORK/scripts/self-description-check.mjs"

echo ""
echo "=== req-005: passes clean against the actual, fixed repository ==="

output=$(node "$CHECK" "$REPO_ROOT" 2>&1)
exit_code=$?
assert_exit_zero "$exit_code" "self-description-check: exits 0 against the real repository"
assert_contains "match the repository" "$output" "self-description-check: reports a clean match"

echo ""
echo "=== req-005: a broken structure-diagram path is caught ==="

SCRATCH_A=$(mktemp -d -t planifest_req005_a_XXXXXX)
mkdir -p "$SCRATCH_A/planifest-framework/skills"
cat > "$SCRATCH_A/README.md" << 'EOF'
# Test

## Repository structure

```
repo/
├── planifest-framework/   ← The framework
│   └── skills/            ← Agent instructions
│
└── nonexistent-folder/    ← This path does not exist
```

## The framework

| Folder | Contents |
|--------|----------|
| [skills/](planifest-framework/skills/) | Agent instructions |
EOF

output_a=$(node "$CHECK" "$SCRATCH_A" 2>&1)
exit_a=$?
assert_equals "1" "$exit_a" "self-description-check: exits 1 when a diagram path does not exist"
assert_contains "nonexistent-folder" "$output_a" "self-description-check: names the missing path"

rm -rf "$SCRATCH_A"

echo ""
echo "=== req-005: a folder with no table row is caught ==="

SCRATCH_B=$(mktemp -d -t planifest_req005_b_XXXXXX)
mkdir -p "$SCRATCH_B/planifest-framework/skills"
mkdir -p "$SCRATCH_B/planifest-framework/undocumented-folder"
cat > "$SCRATCH_B/README.md" << 'EOF'
# Test

## Repository structure

```
repo/
└── planifest-framework/   ← The framework
    └── skills/            ← Agent instructions
```

## The framework

| Folder | Contents |
|--------|----------|
| [skills/](planifest-framework/skills/) | Agent instructions |
EOF

output_b=$(node "$CHECK" "$SCRATCH_B" 2>&1)
exit_b=$?
assert_equals "1" "$exit_b" "self-description-check: exits 1 when a folder has no table row"
assert_contains "undocumented-folder" "$output_b" "self-description-check: names the undocumented folder"

rm -rf "$SCRATCH_B"

echo ""
echo "=== req-005: a fully consistent minimal repo passes ==="

SCRATCH_C=$(mktemp -d -t planifest_req005_c_XXXXXX)
mkdir -p "$SCRATCH_C/planifest-framework/skills"
cat > "$SCRATCH_C/README.md" << 'EOF'
# Test

## Repository structure

```
repo/
└── planifest-framework/   ← The framework
    └── skills/            ← Agent instructions
```

## The framework

| Folder | Contents |
|--------|----------|
| [skills/](planifest-framework/skills/) | Agent instructions |
EOF

output_c=$(node "$CHECK" "$SCRATCH_C" 2>&1)
exit_c=$?
assert_exit_zero "$exit_c" "self-description-check: exits 0 for a fully consistent minimal repo"

rm -rf "$SCRATCH_C"

print_summary
