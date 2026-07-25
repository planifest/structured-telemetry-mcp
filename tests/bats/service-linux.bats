#!/usr/bin/env bats
# Unit tests for scripts/service-linux.sh's pure-logic paths — argument
# dispatch, path resolution, and systemctl/node detection. Does NOT exercise
# real systemd install/uninstall/restart against a live unit; see
# plan/backlog/00001-linux-service-hardware-verification/entry.md for that
# gap (still open, pending real hardware access).

SCRIPT="${BATS_TEST_DIRNAME}/../../scripts/service-linux.sh"

setup() {
  source "$SCRIPT"
}

# ── resolve_repo_dir() ───────────────────────────────────────────────────────

@test "resolve_repo_dir: resolves to the parent of scripts/" {
  result="$(resolve_repo_dir)"
  expected="$(cd "${BATS_TEST_DIRNAME}/../.." && pwd)"
  [ "$result" = "$expected" ]
}

# ── resolve_node_path() ──────────────────────────────────────────────────────
# Unlike service-macos.sh's version, this one is purely PATH-based (no
# hardcoded fallback paths), so both branches are fully mockable here.

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

@test "resolve_node_path: fails with a clear error when node is not on PATH" {
  empty_path="${BATS_TEST_TMPDIR}/empty-path"
  mkdir -p "$empty_path"

  PATH="$empty_path" run resolve_node_path
  [ "$status" -ne 0 ]
  [[ "$output" == *"node not found on PATH"* ]]
}

# ── check_systemctl() ─────────────────────────────────────────────────────────

@test "check_systemctl: passes silently when systemctl is on PATH" {
  fake_bin="${BATS_TEST_TMPDIR}/fakebin"
  mkdir -p "$fake_bin"
  cat > "$fake_bin/systemctl" <<'EOF'
#!/bin/sh
exit 0
EOF
  chmod +x "$fake_bin/systemctl"

  PATH="$fake_bin:$PATH" run check_systemctl
  [ "$status" -eq 0 ]
}

@test "check_systemctl: fails with a clear 'not supported' message when systemctl is absent" {
  empty_path="${BATS_TEST_TMPDIR}/empty-path"
  mkdir -p "$empty_path"

  PATH="$empty_path" run check_systemctl
  [ "$status" -ne 0 ]
  [[ "$output" == *"systemd not found on this system"* ]]
}

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

@test "main: 'install' dispatches to install()" {
  install() { echo "install() was called"; }
  run main install
  [ "$status" -eq 0 ]
  [[ "$output" == *"install() was called"* ]]
}

@test "main: 'uninstall' dispatches to uninstall()" {
  uninstall() { echo "uninstall() was called"; }
  run main uninstall
  [ "$status" -eq 0 ]
  [[ "$output" == *"uninstall() was called"* ]]
}

@test "main: 'status' dispatches to status()" {
  status() { echo "status() was called"; }
  run main status
  [ "$status" -eq 0 ]
  [[ "$output" == *"status() was called"* ]]
}

@test "main: 'restart' dispatches to restart()" {
  restart() { echo "restart() was called"; }
  run main restart
  [ "$status" -eq 0 ]
  [[ "$output" == *"restart() was called"* ]]
}
