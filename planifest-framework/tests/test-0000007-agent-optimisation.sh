#!/usr/bin/env bash
# Tests for feature 0000007-agent-optimisation
# Covers: req-001 through req-008

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/helpers/assert.sh"

FRAMEWORK="$(cd "$SCRIPT_DIR/.." && pwd)"
SKILLS="$FRAMEWORK/skills"
TEMPLATES="$FRAMEWORK/templates"
STANDARDS="$FRAMEWORK/standards"

assert_not_contains() {
  local needle="$1"
  local haystack="$2"
  local message="${3:-not-contains assertion}"

  if printf '%s' "$haystack" | grep -qF "$needle"; then
    echo "  FAIL: $message"
    echo "        needle '$needle' was found but should be absent"
    ((FAIL++)) || true
  else
    echo "  PASS: $message"
    ((PASS++)) || true
  fi
}

assert_file_exists() {
  local path="$1" label="${2:-file exists}"
  if [ -e "$path" ]; then
    echo "  PASS: $label"
    ((PASS++)) || true
  else
    echo "  FAIL: $label: $path"
    ((FAIL++)) || true
  fi
}

# -----------------------------------------------------------------------

echo ""
echo "=== req-001: build target field in feature-brief template ==="

BRIEF=$(cat "$TEMPLATES/feature-brief.template.md")
assert_contains "Build target"       "$BRIEF" "req-001: Build target row exists in Stack table"
assert_contains "local"              "$BRIEF" "req-001: 'local' is an allowed value"
assert_contains "docker"             "$BRIEF" "req-001: 'docker' is an allowed value"
assert_contains "ci-only"            "$BRIEF" "req-001: 'ci-only' is an allowed value"

# -----------------------------------------------------------------------

echo ""
echo "=== req-002: build target agent guidance ==="

CODEGEN=$(cat "$SKILLS/planifest-codegen-agent/SKILL.md")
assert_contains "Build target: docker"        "$CODEGEN" "req-002: codegen-agent has Build target: docker section"
assert_contains "check host-installed runtimes" "$CODEGEN" "req-002: codegen-agent instructs never check host runtimes"
assert_contains "docker build"                "$CODEGEN" "req-002: codegen-agent references docker build"
assert_contains "build-target-standards.md"   "$CODEGEN" "req-002: codegen-agent bundles build-target-standards.md"

VALIDATE=$(cat "$SKILLS/planifest-validate-agent/SKILL.md")
assert_contains "Build target: docker"        "$VALIDATE" "req-002: validate-agent has Build target: docker section"
assert_contains "host toolchain"              "$VALIDATE" "req-002: validate-agent instructs never run host toolchain"
assert_contains "docker build"                "$VALIDATE" "req-002: validate-agent references docker build"
assert_contains "build-target-standards.md"   "$VALIDATE" "req-002: validate-agent bundles build-target-standards.md"

assert_file_exists "$STANDARDS/build-target-standards.md" "req-002: build-target-standards.md exists"
BUILD_STD=$(cat "$STANDARDS/build-target-standards.md")
assert_contains "local"     "$BUILD_STD" "req-002: build-target-standards defines 'local' tier"
assert_contains "docker"    "$BUILD_STD" "req-002: build-target-standards defines 'docker' tier"
assert_contains "ci-only"   "$BUILD_STD" "req-002: build-target-standards defines 'ci-only' tier"

# -----------------------------------------------------------------------

echo ""
echo "=== req-003: planifest-optimise-agent skill ==="

OPTIMISE_FILE="$SKILLS/planifest-optimise-agent/SKILL.md"
assert_file_exists "$OPTIMISE_FILE" "req-003: optimise-agent SKILL.md exists"

OPTIMISE=$(cat "$OPTIMISE_FILE")
FRONTMATTER_NAME=$(grep "^name:" "$OPTIMISE_FILE" | head -1 | awk '{print $2}')
assert_equals "planifest-optimise-agent" "$FRONTMATTER_NAME" "req-003: frontmatter name matches directory"

assert_contains "bundle_standards"            "$OPTIMISE" "req-003: frontmatter has bundle_standards"
assert_contains "hooks:"                      "$OPTIMISE" "req-003: frontmatter has hooks"
assert_contains "planifest-framework/skills/" "$OPTIMISE" "req-003: skill targets planifest-framework/skills/"
assert_contains "Do NOT review"              "$OPTIMISE" "req-003: skill explicitly excludes out-of-scope directories"

assert_contains "Implicit model knowledge"    "$OPTIMISE" "req-003: category 1 — implicit model knowledge"
assert_contains "Hook-enforced duplication"   "$OPTIMISE" "req-003: category 2 — hook-enforced duplication"
assert_contains "Cross-file boilerplate"      "$OPTIMISE" "req-003: category 3 — cross-file boilerplate"
assert_contains "Stale reference"             "$OPTIMISE" "req-003: category 4 — stale references"

assert_contains "one suggestion at a time"    "$OPTIMISE" "req-003: presents one suggestion at a time"
assert_contains "confirm"                     "$OPTIMISE" "req-003: waits for confirm/reject"
assert_contains "Confirmed so far"            "$OPTIMISE" "req-003: accumulates confirmed list"
assert_contains "Review complete"             "$OPTIMISE" "req-003: produces end-of-review summary"
assert_contains "Never write"                 "$OPTIMISE" "req-003: hard limit — never modifies files"

# -----------------------------------------------------------------------

echo ""
echo "=== req-004: skill boilerplate removal ==="

TELEMETRY_POINTER="telemetry-standards.md"

# Phase skills that emit telemetry events — must reference telemetry-standards.md
for skill in planifest-adr-agent planifest-spec-agent planifest-security-agent \
             planifest-docs-agent planifest-validate-agent planifest-change-agent \
             planifest-codegen-agent planifest-ship-agent; do
  SKILL_CONTENT=$(cat "$SKILLS/$skill/SKILL.md")
  assert_contains "$TELEMETRY_POINTER" "$SKILL_CONTENT" "req-004: $skill references telemetry-standards.md"
  assert_contains "bundle_standards" "$SKILL_CONTENT" "req-004: $skill has bundle_standards in frontmatter"
done

# Sub-agent skills (footer-only removal) — verify skill files still exist and are valid
for skill in planifest-test-writer planifest-implementer planifest-refactor planifest-build-assessment-agent; do
  assert_file_exists "$SKILLS/$skill/SKILL.md" "req-004: $skill SKILL.md exists after footer removal"
done

# Hard Limits section should be absent from phase skills (not ship-agent which retains Hard Limits)
for skill in planifest-adr-agent planifest-spec-agent planifest-security-agent \
             planifest-docs-agent planifest-validate-agent planifest-change-agent \
             planifest-codegen-agent; do
  SKILL_CONTENT=$(cat "$SKILLS/$skill/SKILL.md")
  assert_not_contains "## Hard Limits" "$SKILL_CONTENT" "req-004: $skill has no Hard Limits section"
done

# -----------------------------------------------------------------------

echo ""
echo "=== req-005: telemetry standards extraction ==="

TELEM_FILE="$STANDARDS/telemetry-standards.md"
assert_file_exists "$TELEM_FILE" "req-005: telemetry-standards.md exists"

TELEM=$(cat "$TELEM_FILE")
assert_contains "phase_start"       "$TELEM" "req-005: telemetry-standards has phase_start event"
assert_contains "phase_end"         "$TELEM" "req-005: telemetry-standards has phase_end event"
assert_contains "schema_version"    "$TELEM" "req-005: telemetry-standards has schema_version in envelope"
assert_contains "emit_event"        "$TELEM" "req-005: telemetry-standards references emit_event"
assert_contains "telemetry-enabled" "$TELEM" "req-005: telemetry-standards references telemetry-enabled sentinel"
assert_contains "orchestrator"      "$TELEM" "req-005: telemetry-standards documents phase_start/phase_end ownership"

# -----------------------------------------------------------------------

echo ""
echo "=== req-006: stale reference cleanup ==="

for skill in planifest-adr-agent planifest-spec-agent planifest-security-agent \
             planifest-docs-agent planifest-validate-agent planifest-orchestrator; do
  SKILL_CONTENT=$(cat "$SKILLS/$skill/SKILL.md")
  assert_not_contains "design-requirements.md" "$SKILL_CONTENT" "req-006: $skill has no reference to design-requirements.md"
done

for skill in planifest-validate-agent planifest-orchestrator planifest-ship-agent; do
  SKILL_CONTENT=$(cat "$SKILLS/$skill/SKILL.md")
  assert_not_contains "pipeline-run.md" "$SKILL_CONTENT" "req-006: $skill has no reference to pipeline-run.md"
done

for skill in planifest-orchestrator planifest-ship-agent; do
  SKILL_CONTENT=$(cat "$SKILLS/$skill/SKILL.md")
  assert_not_contains "external-skills.json" "$SKILL_CONTENT" "req-006: $skill has no reference to external-skills.json"
  assert_not_contains "skill-sync.sh" "$SKILL_CONTENT" "req-006: $skill has no reference to skill-sync.sh"
done

VALIDATE=$(cat "$SKILLS/planifest-validate-agent/SKILL.md")
assert_contains "build-log.md" "$VALIDATE" "req-006: validate-agent references build-log.md (correct path)"

# -----------------------------------------------------------------------

echo ""
echo "=== req-007: template extractions and setup manifest ==="

DESIGN_TMPL="$TEMPLATES/design.template.md"
assert_file_exists "$DESIGN_TMPL" "req-007: design.template.md exists"

DESIGN_T=$(cat "$DESIGN_TMPL")
assert_contains "feature-id"    "$DESIGN_T" "req-007: design.template.md has feature-id field"
assert_contains "Build target"  "$DESIGN_T" "req-007: design.template.md has Build target in Stack row"
assert_contains "Components"    "$DESIGN_T" "req-007: design.template.md has Components field"

ORCH=$(cat "$SKILLS/planifest-orchestrator/SKILL.md")
assert_contains "design.template.md" "$ORCH" "req-007: orchestrator JIT Loading table references design.template.md"
assert_not_contains "## Design - {feature-id}" "$ORCH" "req-007: orchestrator has no inline design template block"

DOCS=$(cat "$SKILLS/planifest-docs-agent/SKILL.md")
assert_contains "iteration-log.template.md" "$DOCS" "req-007: docs-agent references iteration-log.template.md"
assert_not_contains "# Iteration Log" "$DOCS" "req-007: docs-agent has no inline iteration log template block"

SETUP_SH=$(cat "$FRAMEWORK/setup.sh")
assert_contains ".planifest-manifest" "$SETUP_SH" "req-007: setup.sh writes .planifest-manifest"
assert_contains "Re-run detected"     "$SETUP_SH" "req-007: setup.sh handles re-run manifest cleanup"

SETUP_PS1=$(cat "$FRAMEWORK/setup.ps1")
assert_contains ".planifest-manifest" "$SETUP_PS1" "req-007: setup.ps1 writes .planifest-manifest"
assert_contains "Re-run detected"     "$SETUP_PS1" "req-007: setup.ps1 handles re-run manifest cleanup"

# -----------------------------------------------------------------------

echo ""
echo "=== req-008: language standards ==="

LANG_FILE="$STANDARDS/language-quirks-en-gb.md"
assert_file_exists "$LANG_FILE" "req-008: language-quirks-en-gb.md exists"

LANG=$(cat "$LANG_FILE")
assert_contains 'locale: "en-GB"'     "$LANG" "req-008: frontmatter has locale: en-GB"
assert_contains "artifact"            "$LANG" "req-008: artifact listed as American exception"
assert_contains "initialize"          "$LANG" "req-008: initialize listed as American exception"
assert_contains "serialize"           "$LANG" "req-008: serialize listed as American exception"
assert_contains "licence"             "$LANG" "req-008: licence/license noun/verb distinction documented"
assert_contains "ID"                  "$LANG" "req-008: capitalisation rules present"
assert_contains "data"                "$LANG" "req-008: data countability rule present"

# Global artefact → artifact check (prose only — code spans excluded by design)
# Check no prose 'artefact' in skill files
ARTEFACT_IN_SKILLS=$(grep -rl "artefact" "$SKILLS" 2>/dev/null | grep -v ".bak" || true)
if [ -z "$ARTEFACT_IN_SKILLS" ]; then
  echo "  PASS: req-008: no prose 'artefact' in skills/"
  ((PASS++)) || true
else
  echo "  FAIL: req-008: 'artefact' found in skills/: $ARTEFACT_IN_SKILLS"
  ((FAIL++)) || true
fi

# Check no prose 'artefact' in standards files (excluding language-quirks itself where it appears in code spans)
ARTEFACT_IN_STANDARDS=$(grep -l "artefact" "$STANDARDS"/*.md 2>/dev/null | grep -v "language-quirks" || true)
if [ -z "$ARTEFACT_IN_STANDARDS" ]; then
  echo "  PASS: req-008: no prose 'artefact' in standards/ (excluding language-quirks)"
  ((PASS++)) || true
else
  # Check if the remaining occurrences are only in formatting-standards — that one documents the rule
  ARTEFACT_NON_DOC=$(echo "$ARTEFACT_IN_STANDARDS" | grep -v "formatting-standards" || true)
  if [ -z "$ARTEFACT_NON_DOC" ]; then
    echo "  PASS: req-008: remaining 'artefact' in standards/ only in documentation tables"
    ((PASS++)) || true
  else
    echo "  FAIL: req-008: prose 'artefact' found outside documentation context: $ARTEFACT_NON_DOC"
    ((FAIL++)) || true
  fi
fi

# -----------------------------------------------------------------------

print_summary
