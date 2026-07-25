#!/usr/bin/env bats
# Unit tests for scripts/service-macos.sh's pure-logic paths — argument
# dispatch, path resolution, and the xml_escape() helper. Does NOT exercise
# real launchctl install/uninstall/restart against a live service; that
# remains manual/CI-matrix verification (see plan/backlog/
# 00001-linux-service-hardware-verification/entry.md for the equivalent
# Linux gap — macOS has the same limitation for real service state).

SCRIPT="${BATS_TEST_DIRNAME}/../../scripts/service-macos.sh"

setup() {
  source "$SCRIPT"
}

# ── xml_escape() ────────────────────────────────────────────────────────────

@test "xml_escape: passes through plain text unchanged" {
  result="$(xml_escape "/Users/dev/repo")"
  [ "$result" = "/Users/dev/repo" ]
}

@test "xml_escape: escapes ampersand" {
  result="$(xml_escape "a & b")"
  [ "$result" = "a &amp; b" ]
}

@test "xml_escape: escapes angle brackets" {
  result="$(xml_escape "<user>")"
  [ "$result" = "&lt;user&gt;" ]
}

@test "xml_escape: escapes double and single quotes" {
  result="$(xml_escape "\"quoted\" and 'single'")"
  [ "$result" = "&quot;quoted&quot; and &apos;single&apos;" ]
}

@test "xml_escape: escapes ampersand before other entities (no double-escaping)" {
  result="$(xml_escape "a & <b>")"
  [ "$result" = "a &amp; &lt;b&gt;" ]
}

# ── resolve_node_path() ──────────────────────────────────────────────────────

@test "resolve_node_path: returns the PATH-resolved node binary when present" {
  fake_bin="${BATS_TEST_TMPDIR}/fakebin"
  mkdir -p "$fake_bin"
  cat > "$fake_bin/node" <<'EOF'
#!/bin/sh
echo "fake node"
EOF
  chmod +x "$fake_bin/node"

  PATH="$fake_bin:$PATH" run resolve_node_path
  [ "$status" -eq 0 ]
  [ "$output" = "$fake_bin/node" ]
}

# Note: the "node not found anywhere" branch also checks hardcoded
# /opt/homebrew/bin/node and /usr/local/bin/node — those paths can't be
# mocked away in CI without filesystem tricks that would affect the runner
# itself, so that fallback chain is not covered here. The PATH-based primary
# lookup (above) is the common case and is what this test suite covers.

# ── main() dispatch ───────────────────────────────────────────────────────────

@test "main: no action prints usage and exits non-zero" {
  run main
  [ "$status" -ne 0 ]
  [[ "$output" == *"Usage:"* ]]
}

@test "main: unknown action fails with a clear error" {
  run main frobnicate
  [ "$status" -ne 0 ]
  [[ "$output" == *"Unknown action: frobnicate"* ]]
}

@test "main: 'install' dispatches to cmd_install" {
  cmd_install() { echo "cmd_install was called"; }
  run main install
  [ "$status" -eq 0 ]
  [[ "$output" == *"cmd_install was called"* ]]
}

@test "main: 'uninstall' dispatches to cmd_uninstall" {
  cmd_uninstall() { echo "cmd_uninstall was called"; }
  run main uninstall
  [ "$status" -eq 0 ]
  [[ "$output" == *"cmd_uninstall was called"* ]]
}

@test "main: 'status' dispatches to cmd_status" {
  cmd_status() { echo "cmd_status was called"; }
  run main status
  [ "$status" -eq 0 ]
  [[ "$output" == *"cmd_status was called"* ]]
}

@test "main: 'restart' dispatches to cmd_restart" {
  cmd_restart() { echo "cmd_restart was called"; }
  run main restart
  [ "$status" -eq 0 ]
  [[ "$output" == *"cmd_restart was called"* ]]
}
