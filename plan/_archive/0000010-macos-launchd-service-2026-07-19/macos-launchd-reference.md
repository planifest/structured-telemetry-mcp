# Reference Material - macOS Launchd Service

> Supporting material for `feature-brief.md` (0000010-macos-launchd-service). Not a spec — this is the working script and plist manually verified on one development machine on 2026-07-04, provided as a starting point for the spec-agent / codegen-agent. Treat paths and assumptions below as things to generalize, not hardcode.

---

## What was manually verified

1. A user LaunchAgent plist at `~/Library/LaunchAgents/com.planifest.telemetry-mcp.plist`, pointing at the built `server-http.bundle.mjs`, with `RunAtLoad` and `KeepAlive.SuccessfulExit: false`.
2. Loading it via the modern `launchctl bootstrap gui/$(id -u)` / `launchctl enable` calls (not the deprecated `launchctl load -w`).
3. A real permission obstacle: on the machine this was tested on, `~/Library/LaunchAgents` was:
   ```
   drwxr-xr-x  2 root  staff  ...  /Users/martinmayer/Library/LaunchAgents
   ```
   i.e. **root-owned**, not user-owned as is typical. Only `root` can write into it. This is almost certainly an intentional MDM / endpoint-security control blocking user-level login-item persistence, not a bug. The install script must detect this (e.g. a pre-flight `touch`/write test on the directory) and respond with a clear explanation + a `sudo`-based fallback, rather than assuming every Mac has a normal user-owned `LaunchAgents` dir.

---

## Working plist (manually verified)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>com.planifest.telemetry-mcp</string>

	<key>ProgramArguments</key>
	<array>
		<string>/opt/homebrew/bin/node</string>
		<string>/Users/martinmayer/d/planifest/telemetry-mcp/server-http.bundle.mjs</string>
	</array>

	<key>WorkingDirectory</key>
	<string>/Users/martinmayer/d/planifest/telemetry-mcp</string>

	<key>RunAtLoad</key>
	<true/>

	<key>KeepAlive</key>
	<dict>
		<key>SuccessfulExit</key>
		<false/>
	</dict>

	<key>StandardOutPath</key>
	<string>/Users/martinmayer/Library/Logs/planifest-telemetry-mcp.log</string>

	<key>StandardErrorPath</key>
	<string>/Users/martinmayer/Library/Logs/planifest-telemetry-mcp.err.log</string>

	<key>ProcessType</key>
	<string>Background</string>
</dict>
</plist>
```

**Things the real implementation must generalize, not copy verbatim:**
- Hardcoded `/opt/homebrew/bin/node` — must resolve dynamically (`command -v node`, falling back to checking both `/opt/homebrew/bin/node` (Apple Silicon) and `/usr/local/bin/node` (Intel), matching the same distinction `mac-setup.md` §3 already makes for `npm root -g`).
- Hardcoded `/Users/martinmayer/...` paths — must be derived from `$HOME` / the repo's actual clone location at install time, not assumed.

---

## Working install script (manually run via sudo, by the human — not yet automated)

```bash
#!/bin/bash
set -euo pipefail

PLIST=~/Library/LaunchAgents/com.planifest.telemetry-mcp.plist

mkdir -p ~/Library/Logs

sudo tee "$PLIST" > /dev/null << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>com.planifest.telemetry-mcp</string>
	<key>ProgramArguments</key>
	<array>
		<string>/opt/homebrew/bin/node</string>
		<string>/Users/martinmayer/d/planifest/telemetry-mcp/server-http.bundle.mjs</string>
	</array>
	<key>WorkingDirectory</key>
	<string>/Users/martinmayer/d/planifest/telemetry-mcp</string>
	<key>RunAtLoad</key>
	<true/>
	<key>KeepAlive</key>
	<dict>
		<key>SuccessfulExit</key>
		<false/>
	</dict>
	<key>StandardOutPath</key>
	<string>/Users/martinmayer/Library/Logs/planifest-telemetry-mcp.log</string>
	<key>StandardErrorPath</key>
	<string>/Users/martinmayer/Library/Logs/planifest-telemetry-mcp.err.log</string>
	<key>ProcessType</key>
	<string>Background</string>
</dict>
</plist>
EOF

# Load it (bootout first in case a stale copy is already loaded)
sudo launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
sudo launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/com.planifest.telemetry-mcp"

sleep 1
launchctl list | grep planifest || echo "not showing yet — check logs below"
curl -s http://localhost:3741/health || echo "not responding yet, give it a second and retry curl"
tail -n 20 ~/Library/Logs/planifest-telemetry-mcp.err.log 2>/dev/null || true
```

This was run manually by the human via `sudo` (not by an agent) because the target directory was root-owned. `sudo` was needed only for the `tee` write and the `launchctl bootstrap`/`bootout` calls; `launchctl enable` and `list` do not need it.

**Confirmed working end-to-end on 2026-07-04**, in two stages — the plist write (`sudo tee`) in one terminal paste, then the `launchctl bootstrap`/`enable`/verify block in a second paste. Final state independently verified: process running under launchd (exit status `0`, not crash-looping), listening on `127.0.0.1:3741`, `/health` returning `{"ok":true,"version":"0.1.0"}`.

**Lesson learned for the real `service:install` script (feeds the "Idempotency" NFR in `feature-brief.md`):** during manual testing, pasting this whole block as one multi-line paste into an interactive terminal caused a stray leftover line from an unrelated earlier command (copied from elsewhere in the same session) to get glued onto the paste without its separating newline. Combined with `set -euo pipefail`, that single bad line (interpreted literally by zsh, which — unlike bash — doesn't treat `#` as a comment in interactive mode by default) aborted the script immediately after the plist was written but *before* `launchctl bootstrap` ran. Net effect: the plist existed on disk, but nothing was actually loaded into launchd, and it wasn't obvious why from the terminal output alone — required directly inspecting `launchctl print gui/<uid>/<label>`, `lsof -iTCP:3741`, and the log files to confirm nothing had actually started.
This failure mode is specific to interactive copy-paste and won't occur once this becomes a real script file the developer executes directly (`./scripts/service-macos.sh install`) rather than a block pasted into a live shell — but the codegen-agent should still make each stage (write plist → load → verify) fail loudly and distinctly rather than silently stopping partway, so a partial failure is never mistaken for success.

**Removal, for reference:**
```bash
sudo launchctl bootout gui/$(id -u)/com.planifest.telemetry-mcp
sudo rm ~/Library/LaunchAgents/com.planifest.telemetry-mcp.plist
```

---

## Open questions for the spec-agent

- Should the install script live in `structured-telemetry-mcp`'s own `scripts/` dir (mirroring `scripts/service.ps1`) and be wired to `npm run service:install`, matching the existing Windows command surface exactly?
- Should the pre-flight check for a non-writable `LaunchAgents` dir hard-fail (require the human to run the `sudo` block manually, as done here) or should the script itself shell out to `sudo` interactively? Leaning toward: explain + print the exact commands, let the human decide, given this may be an intentional security control on some machines — see `feature-brief.md` Constraints.
