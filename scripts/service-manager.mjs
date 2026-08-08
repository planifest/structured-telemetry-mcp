#!/usr/bin/env node
/**
 * service-manager — dispatches `npm run service:*` to the right platform
 * script: service.ps1 (Windows), service-macos.sh (macOS), service-linux.sh
 * (Linux). Keeps one command surface (install|uninstall|status|restart)
 * across all three platforms.
 *
 * Also handles `deploy`: build, then restart the running service (if any)
 * so a rebuild's fixes actually take effect — the running daemon has the
 * old code loaded in memory until reloaded (see component.yml's AJV
 * recompilation risk note). Windows' deploy.ps1 already did this; macOS/
 * Linux didn't, which was the exact gotcha this closes.
 *
 * req-009 (orphan-port detection): before touching the service at all,
 * `deploy` checks whether anything is already bound to PLANIFEST_MCP_PORT.
 * `isServiceActive()` only asks launchd/systemd "is a unit registered and
 * active" — it says nothing about who (if anyone) actually holds the port.
 * A manually-started `npm start` left running from local dev would make
 * `isServiceActive()` report false, so `deploy` would conclude "nothing to
 * restart" while a stale process keeps answering requests. If the port is
 * held by a process that isn't the launchd/systemd-managed one, `deploy`
 * names it and stops — it never kills a foreign process itself.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptsDir = dirname(fileURLToPath(import.meta.url));

const DEFAULT_PORT = 3741;

export function getPort() {
  return parseInt(process.env['PLANIFEST_MCP_PORT'] ?? String(DEFAULT_PORT), 10);
}

export function isServiceActive() {
  if (process.platform === 'darwin') {
    return spawnSync('launchctl', ['list', 'com.planifest.telemetry-mcp'], { stdio: 'ignore' }).status === 0;
  }
  if (process.platform === 'linux') {
    return spawnSync('systemctl', ['--user', 'is-active', '--quiet', 'planifest-telemetry-mcp'], { stdio: 'ignore' }).status === 0;
  }
  return false;
}

// ── req-009: orphan-port detection ──────────────────────────────────────────

/**
 * Returns the PID of the launchd/systemd-managed process, or null if it
 * cannot be determined (not running, tool missing, unsupported platform).
 */
export function getManagedPid(platform = process.platform, { exec = spawnSync } = {}) {
  if (platform === 'darwin') {
    const r = exec('launchctl', ['list', 'com.planifest.telemetry-mcp'], { encoding: 'utf8' });
    if (r.error || r.status !== 0) return null;
    const m = (r.stdout ?? '').match(/"PID"\s*=\s*(\d+);/);
    return m ? parseInt(m[1], 10) : null;
  }
  if (platform === 'linux') {
    const r = exec(
      'systemctl',
      ['--user', 'show', 'planifest-telemetry-mcp', '--property=MainPID', '--value'],
      { encoding: 'utf8' },
    );
    if (r.error || r.status !== 0) return null;
    const pid = parseInt((r.stdout ?? '').trim(), 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  }
  return null;
}

/**
 * Returns { checked, pid }. `checked: false` means occupancy could not be
 * determined at all (no port-inspection tool available) — callers should
 * degrade to a warning, not a false pass or a hard failure. `pid: null`
 * with `checked: true` means the port is confirmed free.
 */
export function getPortListenerPid(port, { exec = spawnSync } = {}) {
  // lsof is present on macOS by default and on most Linux distros.
  let r = exec('lsof', ['-ti', `:${port}`], { encoding: 'utf8' });
  if (!r.error) {
    const out = (r.stdout ?? '').trim();
    if (!out) return { checked: true, pid: null };
    const pid = parseInt(out.split('\n')[0], 10);
    return { checked: true, pid: Number.isNaN(pid) ? null : pid };
  }

  // Fallback for Linux systems without lsof installed.
  r = exec('ss', ['-H', '-ltnp', `sport = :${port}`], { encoding: 'utf8' });
  if (!r.error) {
    const out = (r.stdout ?? '').trim();
    if (!out) return { checked: true, pid: null };
    const m = out.match(/pid=(\d+)/);
    return { checked: true, pid: m ? parseInt(m[1], 10) : null };
  }

  return { checked: false, pid: null };
}

/**
 * req-009's decision point: is the port free / held by the managed daemon
 * (ok to proceed), or held by an unmanaged process (must stop deploy)?
 * Never kills anything — only reports.
 */
export function checkOrphanPort(
  port,
  { platform = process.platform, exec = spawnSync, log = (m) => console.log(m), err = (m) => console.error(m) } = {},
) {
  const listener = getPortListenerPid(port, { exec });

  if (!listener.checked) {
    log('  !!  Could not determine port occupancy (lsof/ss unavailable) — skipping orphan-port check.');
    return { ok: true, reason: 'unchecked' };
  }

  if (listener.pid === null) {
    return { ok: true, reason: 'free' };
  }

  const managedPid = getManagedPid(platform, { exec });
  if (managedPid !== null && managedPid === listener.pid) {
    return { ok: true, reason: 'managed', pid: listener.pid };
  }

  err(`  ERR Port ${port} is held by an unmanaged process (PID ${listener.pid}).`);
  err('      This process is not registered with launchd/systemd, so deploy cannot restart it safely.');
  err('      Stop it yourself, then re-run deploy:');
  err(`        kill ${listener.pid}`);
  return { ok: false, reason: 'orphan', pid: listener.pid };
}

// ── deploy ───────────────────────────────────────────────────────────────────

async function runDeploy() {
  console.log('');
  console.log('structured-telemetry-mcp: deploy');
  console.log('=================================');
  console.log('  >> Building...');
  const build = spawnSync('npm', ['run', 'build'], { stdio: 'inherit' });
  if (build.status !== 0) {
    console.error('  ERR Build failed.');
    process.exit(build.status ?? 1);
  }
  console.log('  OK  Build complete.');

  if (process.platform === 'win32') {
    // deploy.ps1 already does global install + detect-installed-and-restart,
    // plus its own orphan-port (req-009) check.
    const r = spawnSync(
      'powershell',
      ['-ExecutionPolicy', 'Bypass', '-File', join(scriptsDir, 'deploy.ps1')],
      { stdio: 'inherit' },
    );
    process.exit(r.status ?? 1);
  }

  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    console.log('  Build complete. Automatic restart is only supported on Windows, macOS, and Linux.');
    process.exit(0);
  }

  const port = getPort();

  // req-009: check port occupancy before doing anything else — regardless
  // of what isServiceActive() reports.
  console.log('  >> Checking port occupancy...');
  const portCheck = checkOrphanPort(port);
  if (!portCheck.ok) {
    process.exit(1);
  }
  console.log(`  OK  Port ${port} is ${portCheck.reason === 'managed' ? 'held by the managed daemon' : portCheck.reason === 'free' ? 'free' : 'unverifiable, proceeding'}.`);

  if (isServiceActive()) {
    console.log('  >> Service is currently running — restarting to pick up the new build...');
    const scriptName = process.platform === 'darwin' ? 'service-macos.sh' : 'service-linux.sh';
    const r = spawnSync('bash', [join(scriptsDir, scriptName), 'restart'], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
  }

  console.log('  No active service detected — build complete, nothing to restart.');
  console.log('  Run `npm run service:install` to install as a background service.');
  process.exit(0);
}

async function main(argv) {
  const action = argv[2];

  if (!action) {
    console.error('Usage: node scripts/service-manager.mjs <install|uninstall|status|restart|deploy>');
    process.exit(1);
  }

  if (action === 'deploy') {
    await runDeploy();
    return;
  }

  let result;
  if (process.platform === 'win32') {
    result = spawnSync(
      'powershell',
      ['-ExecutionPolicy', 'Bypass', '-File', join(scriptsDir, 'service.ps1'), action],
      { stdio: 'inherit' },
    );
  } else if (process.platform === 'darwin') {
    result = spawnSync('bash', [join(scriptsDir, 'service-macos.sh'), action], { stdio: 'inherit' });
  } else if (process.platform === 'linux') {
    result = spawnSync('bash', [join(scriptsDir, 'service-linux.sh'), action], { stdio: 'inherit' });
  } else {
    console.error(`Unsupported platform: ${process.platform}. Service install is supported on Windows, macOS, and Linux only.`);
    process.exit(1);
  }

  process.exit(result.status ?? 1);
}

// Only run when executed directly (`node scripts/service-manager.mjs ...`),
// not when imported — e.g. by tests/unit/service-manager.test.ts to unit-test
// the pure functions above (mirrors the bash scripts' BASH_SOURCE guard).
const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  await main(process.argv);
}
