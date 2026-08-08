#!/bin/bash
# structured-telemetry-mcp service manager for Linux (systemd --user)
# Manages the telemetry backend service with install/uninstall/status/restart commands.

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────────

UNIT_NAME="planifest-telemetry-mcp"
UNIT_DIR="${HOME}/.config/systemd/user"
UNIT_FILE="${UNIT_DIR}/${UNIT_NAME}.service"
HEALTH_URL="http://localhost:3741/health"
HEALTH_TIMEOUT=10

# ── Utilities ──────────────────────────────────────────────────────────────────

log_step() {
    echo "  >> $1" >&2
}

log_ok() {
    echo "  OK  $1" >&2
}

log_warn() {
    echo "  !!  $1" >&2
}

log_err() {
    echo "  ERR $1" >&2
    exit 1
}

check_systemctl() {
    if ! command -v systemctl >/dev/null 2>&1; then
        log_err "systemd not found on this system — this install script only supports systemd-based Linux distros"
    fi
}

resolve_node_path() {
    if ! command -v node >/dev/null 2>&1; then
        log_err "node not found on PATH"
    fi
    command -v node
}

resolve_repo_dir() {
    # Resolve the repo directory from this script's location
    # Script is at {REPO}/scripts/service-linux.sh, so go up one level
    cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd
}

check_health() {
    local count=0
    local max_attempts=5

    while [ $count -lt $max_attempts ]; do
        if curl -s "$HEALTH_URL" >/dev/null 2>&1; then
            return 0
        fi
        count=$((count + 1))
        sleep 1
    done

    return 1
}

check_lingering() {
    local linger_status
    linger_status="$(loginctl show-user "$USER" --property=Linger 2>/dev/null | cut -d= -f2 || echo 'unknown')"
    echo "$linger_status"
}

print_lingering_warning() {
    local linger_status
    linger_status="$(check_lingering)"

    if [ "$linger_status" != "yes" ]; then
        log_warn ""
        log_warn "Lingering is not enabled for $USER."
        log_warn "The service will stop when your last session (SSH/GUI) logs out."
        log_warn "To keep it running after logout, run:"
        log_warn "  loginctl enable-linger $USER"
        echo ""
    fi
}

# ── Commands ───────────────────────────────────────────────────────────────────

install() {
    check_systemctl

    local node_path
    node_path="$(resolve_node_path)"

    local repo_dir
    repo_dir="$(resolve_repo_dir)"

    log_step "Creating systemd user service directory..."
    mkdir -p "$UNIT_DIR"
    log_ok "Directory ready: $UNIT_DIR"

    log_step "Writing unit file: $UNIT_FILE"
    cat > "$UNIT_FILE" << EOF
[Unit]
Description=Planifest structured-telemetry-mcp backend
After=network.target
StartLimitIntervalSec=60
StartLimitBurst=5

[Service]
Type=simple
ExecStart="$node_path" "$repo_dir/server-http.bundle.mjs"
# WorkingDirectory intentionally unquoted: unlike ExecStart (argv-style,
# word-split), systemd takes single-value assignments like this one verbatim
# for the rest of the line, spaces included — quoting would embed literal
# quote characters into the path instead of escaping it.
WorkingDirectory=$repo_dir
Restart=on-failure
RestartSec=2

[Install]
WantedBy=default.target
EOF
    log_ok "Unit file written"

    log_step "Reloading systemd daemon..."
    systemctl --user daemon-reload
    log_ok "Daemon reloaded"

    log_step "Enabling and starting service..."
    systemctl --user enable --now "$UNIT_NAME"
    log_ok "Service enabled and started"

    log_step "Checking service status..."
    sleep 1
    if systemctl --user is-active "$UNIT_NAME" >/dev/null 2>&1; then
        log_ok "Service is active"
    else
        log_err "Service failed to start. Check with: systemctl --user status $UNIT_NAME --no-pager"
    fi

    log_step "Verifying health endpoint..."
    if check_health; then
        log_ok "Health check passed: $HEALTH_URL"
    else
        log_warn "Health check did not respond within $HEALTH_TIMEOUT seconds"
        log_warn "Service may still be starting. Check manually with: curl $HEALTH_URL"
    fi

    print_lingering_warning
}

uninstall() {
    check_systemctl

    if [ ! -f "$UNIT_FILE" ]; then
        log_warn "Unit file not found: $UNIT_FILE (already uninstalled?)"
        return 0
    fi

    log_step "Disabling and stopping service..."
    systemctl --user disable --now "$UNIT_NAME" 2>/dev/null || true
    log_ok "Service disabled"

    log_step "Removing unit file..."
    rm -f "$UNIT_FILE"
    log_ok "Unit file removed"

    log_step "Reloading systemd daemon..."
    systemctl --user daemon-reload
    log_ok "Service uninstalled"
}

status() {
    check_systemctl

    echo ""
    echo "=== Service Status ===" >&2

    if [ ! -f "$UNIT_FILE" ]; then
        log_warn "Unit not installed: $UNIT_FILE"
        return 0
    fi

    if systemctl --user is-active "$UNIT_NAME" >/dev/null 2>&1; then
        log_ok "Service is active"
    else
        local unit_state
        unit_state="$(systemctl --user show --property=ActiveState --value "$UNIT_NAME" 2>/dev/null || echo 'unknown')"
        log_warn "Service is not active (state: $unit_state)"
    fi

    log_step "Full systemctl status:"
    systemctl --user status "$UNIT_NAME" --no-pager || true

    echo "" >&2
    log_step "Health check:"
    if curl -s "$HEALTH_URL" >/dev/null 2>&1; then
        log_ok "Daemon responding at $HEALTH_URL"
    else
        log_warn "Daemon not responding at $HEALTH_URL"
    fi

    echo "" >&2
    log_step "Lingering status:"
    local linger_status
    linger_status="$(check_lingering)"
    if [ "$linger_status" = "yes" ]; then
        log_ok "Lingering enabled — service will survive logout"
    else
        log_warn "Lingering not enabled — service will stop on logout (state: $linger_status)"
        log_warn "To enable, run: loginctl enable-linger $USER"
    fi

    echo "" >&2
}

restart() {
    check_systemctl

    if [ ! -f "$UNIT_FILE" ]; then
        log_err "Unit not installed: $UNIT_FILE"
    fi

    log_step "Restarting service..."
    systemctl --user restart "$UNIT_NAME"
    log_ok "Service restarted"

    log_step "Verifying restart..."
    sleep 1
    if systemctl --user is-active "$UNIT_NAME" >/dev/null 2>&1; then
        log_ok "Service is active after restart"
    else
        log_err "Service failed after restart. Check with: systemctl --user status $UNIT_NAME --no-pager"
    fi
}

# ── Main ───────────────────────────────────────────────────────────────────────

main() {
    if [ $# -lt 1 ]; then
        echo "Usage: $0 {install|uninstall|status|restart}" >&2
        exit 1
    fi

    local action="$1"

    echo ""
    echo "structured-telemetry-mcp: service $action" >&2
    echo "========================================" >&2

    case "$action" in
        install)   install ;;
        uninstall) uninstall ;;
        status)    status ;;
        restart)   restart ;;
        *)
            log_err "Unknown action: $action (use install|uninstall|status|restart)"
            ;;
    esac

    echo "" >&2
}

# Only run main when executed directly, not when sourced (e.g. by tests/bats/
# to unit-test individual functions like resolve_repo_dir() or check_lingering()).
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
