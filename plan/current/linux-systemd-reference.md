# Reference Material - Linux systemd Service

> Supporting material for `feature-brief.md` (0000010-macos-launchd-service, Phase 2). Not a spec.
>
> **Unlike `macos-launchd-reference.md`, none of this has been run or tested** — this session has no Linux machine available. Everything below is a reasoned draft based on standard `systemd --user` practice, provided as a starting point for the spec-agent / codegen-agent. Treat it as more speculative than the macOS reference, and expect the design/codegen phases to actually verify it on a real distro before shipping.

---

## Design approach (untested, for spec-agent review)

Mirrors the macOS approach: a **user-scoped** service (`systemd --user`), not a system-wide daemon, so no root is needed to install or manage it day-to-day. The one place root/privilege *may* be needed is enabling "lingering" so the user's systemd instance survives past logout — see below.

---

## Draft unit file (NOT yet verified)

`~/.config/systemd/user/planifest-telemetry-mcp.service`:

```ini
[Unit]
Description=Planifest structured-telemetry-mcp backend
After=network.target

[Service]
Type=simple
ExecStart=%h/.nvm/versions/node/CHANGE-ME/bin/node %h/d/planifest/telemetry-mcp/server-http.bundle.mjs
WorkingDirectory=%h/d/planifest/telemetry-mcp
Restart=on-failure
RestartSec=2
StandardOutput=append:%h/.local/state/planifest/telemetry-mcp.log
StandardError=append:%h/.local/state/planifest/telemetry-mcp.err.log

[Install]
WantedBy=default.target
```

**Known open issues with this draft (for spec-agent to resolve, not assume):**
- `ExecStart`'s node path is a placeholder (`CHANGE-ME`) — systemd unit files do not support shell expansion or `$(command -v node)`, so the install *script* must resolve the absolute node path at install time and substitute it into the unit file (e.g. via `sed` or a heredoc with an already-resolved shell variable), the same way the macOS install script must resolve `/opt/homebrew/bin/node` vs `/usr/local/bin/node` dynamically rather than hardcoding.
- `%h` (systemd specifier for the user's home directory) works in most systemd versions for `ExecStart`/`WorkingDirectory`, but the repo clone path (`d/planifest/telemetry-mcp`) is itself an assumption carried over from this dev machine's layout — the real install script must derive it from wherever the repo actually is, not assume `~/d/planifest/...`.
- `Restart=on-failure` (not `Restart=always`) so a clean `systemctl --user stop` doesn't get immediately restarted — mirrors the macOS `KeepAlive.SuccessfulExit: false` semantics.
- Log paths use `%h/.local/state/` (XDG state dir convention) rather than an arbitrary path — but `journalctl --user -u planifest-telemetry-mcp` already captures stdout/stderr by default even without explicit `StandardOutput`/`StandardError` lines; the spec-agent should decide whether a separate log file is even needed given journald already covers it, or whether this NFR should just be "documented `journalctl` command," matching what's simplest.

---

## Draft install/verify commands (NOT yet verified)

```bash
#!/bin/bash
set -euo pipefail

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemd not found on this system — this install script only supports systemd-based Linux distros." >&2
  exit 1
fi

UNIT_DIR="$HOME/.config/systemd/user"
UNIT_FILE="$UNIT_DIR/planifest-telemetry-mcp.service"
NODE_PATH="$(command -v node)"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # assumes script lives in repo's scripts/ dir

mkdir -p "$UNIT_DIR" "$HOME/.local/state/planifest"

cat > "$UNIT_FILE" << EOF
[Unit]
Description=Planifest structured-telemetry-mcp backend
After=network.target

[Service]
Type=simple
ExecStart=$NODE_PATH $REPO_DIR/server-http.bundle.mjs
WorkingDirectory=$REPO_DIR
Restart=on-failure
RestartSec=2

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now planifest-telemetry-mcp

sleep 1
echo "--- systemctl status ---"
systemctl --user status planifest-telemetry-mcp --no-pager || true

echo "--- health check ---"
curl -s http://localhost:3741/health || echo "not responding yet, give it a second and retry curl"

echo "--- lingering check ---"
linger="$(loginctl show-user "$USER" --property=Linger 2>/dev/null | cut -d= -f2)"
if [ "$linger" != "yes" ]; then
  echo ""
  echo "WARNING: lingering is not enabled for $USER."
  echo "The service above will stop when your last session (SSH/GUI) logs out."
  echo "To keep it running after logout, run:"
  echo "  loginctl enable-linger $USER"
fi
```

**Removal, for reference (untested):**
```bash
systemctl --user disable --now planifest-telemetry-mcp
rm ~/.config/systemd/user/planifest-telemetry-mcp.service
systemctl --user daemon-reload
```

---

## Open questions for the spec-agent

- Does `loginctl enable-linger` require elevated privilege on target distros, or is it callable by the user for their own account via polkit without `sudo`? (Varies by distro/polkit policy — needs verification on at least one real target distro before the acceptance criteria around "must not require root" can be signed off.)
- Should the install script auto-run `loginctl enable-linger` after a confirmation prompt, or only ever print the command (matching the more conservative stance taken for macOS's `sudo` fallback in `macos-launchd-reference.md`)? Leaning toward the same conservative stance: explain, print the command, let the human decide — enabling linger is a persistent, user-account-wide setting change, not a one-off scoped action.
- Should stdout/stderr redirection to files be kept at all, given `journalctl --user -u planifest-telemetry-mcp` already captures everything systemd services print — or is that redundant and should be dropped from the final unit file?
- WSL2 note (unexplored): WSL2 now ships a real systemd user instance in recent Windows builds, so this Linux path may also cover WSL2 rather than needing a fourth platform variant — worth a quick check during Phase 2 design rather than assuming either way.
