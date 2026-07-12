#!/usr/bin/env bash
# Validation test: external-skills attribution.txt completeness (REQ-004, ADR-002)
#
# Verifies that every skill directory under planifest-framework/external-skills/
# contains an attribution.txt file with all required fields:
#   - License type
#   - Copyright holder
#   - Source URL
#   - Required attribution text
#   - Full license text (LICENSE: marker or substantial text block at the bottom)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

EXTERNAL_SKILLS_DIR="$SCRIPT_DIR/../external-skills"

echo ""
echo "=== REQ-004: external-skills attribution.txt validation ==="

# ── Section 1: external-skills directory exists ───────────────────────────────
echo ""
echo "--- Directory structure ---"

if [ -d "$EXTERNAL_SKILLS_DIR" ]; then
  echo "  PASS: external-skills/ directory exists"
  ((PASS++)) || true
else
  echo "  FAIL: external-skills/ directory missing — run setup with --include-full-skill-library"
  ((FAIL++)) || true
  print_summary
  exit 0
fi

# ── Section 2: each skill subdir has attribution.txt and SKILL.md ─────────────
echo ""
echo "--- Per-skill attribution ---"

skill_count=0
missing_attribution=0
incomplete_attribution=0

for skill_dir in "$EXTERNAL_SKILLS_DIR"/*/; do
  [ -d "$skill_dir" ] || continue
  skill_name="$(basename "$skill_dir")"
  ((skill_count++)) || true

  attribution_file="$skill_dir/attribution.txt"
  skill_md_file="$skill_dir/SKILL.md"

  # Check SKILL.md exists
  if [ ! -f "$skill_md_file" ]; then
    echo "  FAIL: $skill_name — SKILL.md missing"
    ((FAIL++)) || true
  else
    echo "  PASS: $skill_name — SKILL.md present"
    ((PASS++)) || true
  fi

  # Check attribution.txt exists
  if [ ! -f "$attribution_file" ]; then
    echo "  FAIL: $skill_name — attribution.txt missing"
    ((FAIL++)) || true
    ((missing_attribution++)) || true
    continue
  fi

  echo "  PASS: $skill_name — attribution.txt present"
  ((PASS++)) || true

  attr_content="$(cat "$attribution_file")"

  # Check required fields
  check_field() {
    local field_pattern="$1"
    local field_name="$2"
    if printf '%s' "$attr_content" | grep -qi "$field_pattern"; then
      echo "    PASS: $skill_name — $field_name present"
      ((PASS++)) || true
    else
      echo "    FAIL: $skill_name — $field_name missing or unrecognised (looked for: $field_pattern)"
      ((FAIL++)) || true
      ((incomplete_attribution++)) || true
    fi
  }

  check_field "license.*type\|license:" "License type"
  check_field "copyright" "Copyright holder"
  check_field "http\|https" "Source URL"
  check_field "attribution" "Required attribution text"

  # Check full license text (must be substantial — at least 100 chars of license body)
  # Heuristic: look for LICENSE:, MIT License, Apache License, or ISC License headers
  # OR a long block of text that looks like a license
  license_present=false
  if printf '%s' "$attr_content" | grep -qi "^LICENSE:\|^MIT License\|^Apache License\|^ISC License\|^BSD.*License\|Permission is hereby granted\|Licensed under"; then
    license_present=true
  fi
  # Also accept if the file is long enough to contain a full license (>500 chars)
  if [ ${#attr_content} -gt 500 ]; then
    license_present=true
  fi

  if $license_present; then
    echo "    PASS: $skill_name — full license text present"
    ((PASS++)) || true
  else
    echo "    FAIL: $skill_name — full license text missing (must be appended at bottom of attribution.txt)"
    ((FAIL++)) || true
    ((incomplete_attribution++)) || true
  fi
done

# ── Section 3: summary counts ─────────────────────────────────────────────────
echo ""
echo "--- Summary ---"
echo "  Skills found:                $skill_count"
echo "  Missing attribution.txt:     $missing_attribution"
echo "  Incomplete attribution.txt:  $incomplete_attribution"

if [ "$skill_count" -eq 0 ]; then
  echo "  NOTE: No skills found in external-skills/. Library may not be populated yet."
  echo "        Re-run after 'setup.sh --include-full-skill-library'."
fi

print_summary
