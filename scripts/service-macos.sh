#!/bin/bash
#
# Manage the structured-telemetry-mcp user LaunchAgent on macOS.
#
# Usage:
#   ./scripts/service-macos.sh install     - Install and start the service
#   ./scripts/service-macos.sh uninstall   - Stop and remove the service
#   ./scripts/service-macos.sh status      - Check service and health status
#   ./scripts/service-macos.sh restart     - Restart the service
#
# This script uses launchctl to manage a user-scoped LaunchAgent.
# It does NOT automatically escalate to sudo; if ~/Library/LaunchAgents is
# locked (e.g., by MDM), the script explains the issue and prints the exact
# sudo commands for the developer to run manually.

set -euo pipefail

# Configuration
readonly SERVICE_LABEL="com.planifest.telemetry-mcp"
readonly PLIST_PATH="${HOME}/Library/LaunchAgents/${SERVICE_LABEL}.plist"
readonly LOG_DIR="${HOME}/Library/Logs"
readonly STDOUT_LOG="${LOG_DIR}/planifest-telemetry-mcp.log"
readonly STDERR_LOG="${LOG_DIR}/planifest-telemetry-mcp.err.log"
readonly HEALTH_ENDPOINT="http://localhost:3741/health"
readonly HEALTH_CHECK_RETRIES=10
readonly HEALTH_CHECK_DELAY=1

# Derive repo root from this script's location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(dirname "$SCRIPT_DIR")"
readonly BUNDLE_PATH="${REPO_ROOT}/server-http.bundle.mjs"

# ──────────────────────────────────────────────────────────────────────────────
# Utility functions
# ──────────────────────────────────────────────────────────────────────────────

log_step() {
    echo "  >> $*" >&2
}

log_ok() {
    echo "  OK  $*" >&2
}

log_warn() {
    echo "  !!  $*" >&2
}

log_err() {
    echo "  ERR $*" >&2
    exit 1
}

# Escape a string for safe embedding in plist XML text content.
# Uses sed rather than ${var//pat/rep}: bash 5.2's default patsub_replacement
# option expands unquoted & in the replacement to the matched text, silently
# corrupting the entities on modern bash (macOS's bash 3.2 is unaffected —
# caught by the bats suite on the Ubuntu CI runner). sed's s/// with \& is
# identical on BSD and GNU. & first, or later escapes get double-escaped.
xml_escape() {
    printf '%s' "$1" | sed \
        -e 's/&/\&amp;/g' \
        -e 's/</\&lt;/g' \
        -e 's/>/\&gt;/g' \
        -e 's/"/\&quot;/g' \
        -e "s/'/\\&apos;/g"
}

# Resolve the Node.js binary path dynamically.
# Checks: command -v node, /opt/homebrew/bin/node (Apple Silicon), /usr/local/bin/node (Intel).
resolve_node_path() {
    local node_path

    # First: check if node is on PATH
    if node_path=$(command -v node 2>/dev/null); then
        echo "$node_path"
        return 0
    fi

    # Fallback 1: Apple Silicon Homebrew location
    if [[ -x "/opt/homebrew/bin/node" ]]; then
        echo "/opt/homebrew/bin/node"
        return 0
    fi

    # Fallback 2: Intel Homebrew location
    if [[ -x "/usr/local/bin/node" ]]; then
        echo "/usr/local/bin/node"
        return 0
    fi

    # Not found
    log_err "Node.js not found. Install Node.js or ensure it is on PATH."
}

# Check if ~/Library/LaunchAgents is writable. If not, print guidance and exit.
check_launchagents_writable() {
    local launchagents_dir="${HOME}/Library/LaunchAgents"

    # Create the directory if it doesn't exist (this test will fail if we can't create it)
    if ! mkdir -p "$launchagents_dir" 2>/dev/null; then
        cat >&2 << EOF

  Cannot create ~/Library/LaunchAgents — permission denied.
  This is likely an intentional MDM (Mobile Device Management) or endpoint-security
  control. Ask your IT administrator to create the directory, or run:

    sudo mkdir -p "${launchagents_dir}"
    sudo chown "\$(id -un):staff" "${launchagents_dir}"

  Then re-run this script.

EOF
        log_err "LaunchAgents directory cannot be created. See guidance above."
    fi

    # Try a pre-flight write test
    local test_file="${launchagents_dir}/.write-test-$$"
    if ! touch "$test_file" 2>/dev/null; then
        cat >&2 << 'EOF'

  Your ~/Library/LaunchAgents directory is not writable by your user account.
  This is likely an intentional MDM (Mobile Device Management) or endpoint-security
  control preventing user-level login items from persisting.

  To proceed with install, run these commands as your user (you will be prompted for
  your password when needed for sudo):

EOF
        cat >&2 << EOF

    mkdir -p ~/Library/Logs
    sudo tee "${PLIST_PATH}" > /dev/null << 'PLIST_EOF'
$(_generate_plist "$(resolve_node_path)")
PLIST_EOF
    sudo launchctl bootout "gui/\$(id -u)/${SERVICE_LABEL}" 2>/dev/null || true
    sudo launchctl bootstrap "gui/\$(id -u)" "${PLIST_PATH}"
    launchctl enable "gui/\$(id -u)/${SERVICE_LABEL}"

EOF
        log_err "LaunchAgents directory is locked. Run the commands above manually."
    fi

    # Clean up the test file
    rm -f "$test_file"
}

# Generate the plist XML content. Takes the node path as argument.
_generate_plist() {
    local node_path
    node_path="$(xml_escape "$1")"
    local bundle_path stdout_log stderr_log repo_root
    bundle_path="$(xml_escape "$BUNDLE_PATH")"
    repo_root="$(xml_escape "$REPO_ROOT")"
    stdout_log="$(xml_escape "$STDOUT_LOG")"
    stderr_log="$(xml_escape "$STDERR_LOG")"
    cat << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>${SERVICE_LABEL}</string>

	<key>ProgramArguments</key>
	<array>
		<string>${node_path}</string>
		<string>${bundle_path}</string>
	</array>

	<key>WorkingDirectory</key>
	<string>${repo_root}</string>

	<key>RunAtLoad</key>
	<true/>

	<key>KeepAlive</key>
	<dict>
		<key>SuccessfulExit</key>
		<false/>
	</dict>

	<key>StandardOutPath</key>
	<string>${stdout_log}</string>

	<key>StandardErrorPath</key>
	<string>${stderr_log}</string>

	<key>ProcessType</key>
	<string>Background</string>
</dict>
</plist>
EOF
}

# Write the plist file to disk.
write_plist() {
    local node_path="$1"

    log_step "Writing plist to ${PLIST_PATH}..."
    _generate_plist "$node_path" > "$PLIST_PATH"
    log_ok "Plist written."
}

# Load (bootstrap) the LaunchAgent and enable it.
load_service() {
    log_step "Loading service via launchctl..."

    # Bootout any stale copy (ignore failure — may not be loaded)
    launchctl bootout "gui/$(id -u)/${SERVICE_LABEL}" 2>/dev/null || true

    # Bootstrap the plist
    if ! launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>&1; then
        log_err "Failed to bootstrap service. Check plist syntax and try again."
    fi
    log_ok "Service bootstrapped."

    # Enable it
    if ! launchctl enable "gui/$(id -u)/${SERVICE_LABEL}" 2>&1; then
        log_err "Failed to enable service."
    fi
    log_ok "Service enabled."
}

# Verify that the service is running and responding to health checks.
verify_service() {
    log_step "Verifying service health (up to ${HEALTH_CHECK_RETRIES} attempts)..."

    local attempt=1
    while (( attempt <= HEALTH_CHECK_RETRIES )); do
        if curl -s "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
            log_ok "Service is healthy."
            return 0
        fi

        if (( attempt < HEALTH_CHECK_RETRIES )); then
            sleep "$HEALTH_CHECK_DELAY"
        fi
        (( attempt++ ))
    done

    log_err "Service did not respond to health check after ${HEALTH_CHECK_RETRIES} attempts."
}

# ──────────────────────────────────────────────────────────────────────────────
# Commands
# ──────────────────────────────────────────────────────────────────────────────

cmd_install() {
    echo ""
    echo "structured-telemetry-mcp: service install" >&2
    echo "========================================" >&2

    # Pre-flight checks
    check_launchagents_writable

    local node_path
    node_path=$(resolve_node_path)
    log_ok "Using Node.js: $node_path"

    if [[ ! -f "$BUNDLE_PATH" ]]; then
        log_err "Bundle not found at ${BUNDLE_PATH}. Run 'npm run build' first."
    fi
    log_ok "Bundle found: $BUNDLE_PATH"

    # Create log directory
    mkdir -p "$LOG_DIR"
    log_ok "Log directory ready: $LOG_DIR"

    # Write and load
    write_plist "$node_path"
    load_service
    verify_service

    echo ""
    echo "  Service installed and started." >&2
    echo "  Health:  curl $HEALTH_ENDPOINT" >&2
    echo "  Logs:    $STDOUT_LOG" >&2
    echo "  Manage:  ./scripts/service-macos.sh <status|restart|uninstall>" >&2
    echo ""
}

cmd_uninstall() {
    echo ""
    echo "structured-telemetry-mcp: service uninstall" >&2
    echo "===========================================" >&2

    if [[ ! -f "$PLIST_PATH" ]]; then
        log_warn "Service is not installed (plist not found)."
        return 0
    fi

    log_step "Stopping service..."
    launchctl bootout "gui/$(id -u)/${SERVICE_LABEL}" 2>/dev/null || true
    log_ok "Service stopped."

    log_step "Removing plist..."
    rm -f "$PLIST_PATH"
    log_ok "Plist removed."

    echo ""
    echo "  Service uninstalled." >&2
    echo ""
}

cmd_status() {
    echo ""
    echo "structured-telemetry-mcp: service status" >&2
    echo "========================================" >&2

    local plist_exists=0
    local service_loaded=0
    local health_ok=0

    # Check plist file
    if [[ -f "$PLIST_PATH" ]]; then
        plist_exists=1
        echo "  Plist:    installed at ${PLIST_PATH}" >&2
    else
        echo "  Plist:    NOT INSTALLED" >&2
        echo ""
        return 0
    fi

    # Check if loaded
    if launchctl list | grep -q "$SERVICE_LABEL"; then
        service_loaded=1
        echo "  Loaded:   yes" >&2
    else
        echo "  Loaded:   no" >&2
    fi

    # Check health
    if curl -s "$HEALTH_ENDPOINT" > /dev/null 2>&1; then
        health_ok=1
        echo "  Health:   responding" >&2
    else
        echo "  Health:   not responding" >&2
    fi

    # Summary
    echo ""
    if (( plist_exists && service_loaded && health_ok )); then
        echo "  Status:   RUNNING" >&2
    elif (( plist_exists && service_loaded )); then
        echo "  Status:   RUNNING but not responding to health check" >&2
    elif (( plist_exists )); then
        echo "  Status:   INSTALLED but NOT LOADED" >&2
    else
        echo "  Status:   NOT INSTALLED" >&2
    fi

    if (( plist_exists )); then
        echo "  Logs:     $STDOUT_LOG" >&2
    fi
    echo ""
}

cmd_restart() {
    echo ""
    echo "structured-telemetry-mcp: service restart" >&2
    echo "==========================================" >&2

    if [[ ! -f "$PLIST_PATH" ]]; then
        log_err "Service is not installed. Run 'service:install' first."
    fi

    log_step "Restarting service..."

    # Bootout
    launchctl bootout "gui/$(id -u)/${SERVICE_LABEL}" 2>/dev/null || true
    log_ok "Service stopped."

    # Bootstrap and enable (same as install's load_service, but skip plist write)
    if ! launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH" 2>&1; then
        log_err "Failed to bootstrap service."
    fi
    log_ok "Service bootstrapped."

    if ! launchctl enable "gui/$(id -u)/${SERVICE_LABEL}" 2>&1; then
        log_err "Failed to enable service."
    fi
    log_ok "Service enabled."

    # Verify
    verify_service

    echo ""
    echo "  Service restarted." >&2
    echo ""
}

# ──────────────────────────────────────────────────────────────────────────────
# Dispatch
# ──────────────────────────────────────────────────────────────────────────────

main() {
    local action="${1:-}"

    if [[ -z "$action" ]]; then
        cat >&2 << 'EOF'
Usage: ./scripts/service-macos.sh <command>

Commands:
  install    - Install and start the LaunchAgent service
  uninstall  - Stop and remove the LaunchAgent service
  status     - Check service status and health
  restart    - Restart the running service

Examples:
  ./scripts/service-macos.sh install
  ./scripts/service-macos.sh status
  ./scripts/service-macos.sh restart
  ./scripts/service-macos.sh uninstall
EOF
        exit 1
    fi

    case "$action" in
        install)
            cmd_install
            ;;
        uninstall)
            cmd_uninstall
            ;;
        status)
            cmd_status
            ;;
        restart)
            cmd_restart
            ;;
        *)
            log_err "Unknown action: $action. Use: install|uninstall|status|restart"
            ;;
    esac
}

# Only run main when executed directly, not when sourced (e.g. by tests/bats/
# to unit-test individual functions like xml_escape() or resolve_node_path()).
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
