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
 *
 * req-008 (build-identity assertion): after a restart the platform script
 * reports "succeeded" as soon as launchd/systemd says the unit is active —
 * that's necessary but not sufficient, since the exact same bug (a stale
 * process still bound to the port) can make the health check pass against
 * the OLD process. So once the restart script exits 0, `deploy` computes
 * the SHA-256 of the just-built server-http.bundle.mjs (the same
 * computation src/server-http.ts uses for its `buildId`), fetches /health,
 * and compares. A mismatch — even at the same package.json version — fails
 * the deploy loudly instead of leaving the engineer testing stale code.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptsDir);

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

// ── req-008: build-identity assertion ───────────────────────────────────────

/** Same algorithm as src/server-http.ts's BUILD_ID: SHA-256 hex of the bundle. */
export function computeBuildId(bundlePath) {
  if (!existsSync(bundlePath)) return null;
  return createHash('sha256').update(readFileSync(bundlePath)).digest('hex');
}

export async function fetchHealthWithRetry(
  port,
  { retries = 10, delayMs = 1000, fetchImpl = fetch, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {},
) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetchImpl(`http://localhost:${port}/health`);
      if (res.ok) return await res.json();
      lastErr = new Error(`/health responded with status ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    if (attempt < retries) await sleep(delayMs);
  }
  throw lastErr ?? new Error('health check failed after retries');
}

/**
 * Compares the freshly-built hash against /health's reported buildId.
 * 'unknown' (missing buildId — a daemon predating this feature) is a
 * distinct outcome from 'mismatch': callers must warn, not hard-fail, on
 * 'unknown' (req-008 acceptance criteria).
 */
export function compareBuildIdentity(computedId, health) {
  const remoteId = health?.buildId;
  if (remoteId === null || remoteId === undefined) {
    return { status: 'unknown' };
  }
  if (remoteId === computedId) {
    return { status: 'match', buildId: computedId };
  }
  return { status: 'mismatch', computedId, remoteId };
}

/**
 * Runs the full req-008 post-restart check: compute local hash, fetch
 * /health, compare, and log the outcome. Returns true if deploy should
 * continue (match, unknown, or bundle-not-found degrade), false if it
 * must fail (mismatch, or /health unreachable).
 */
export async function verifyBuildIdentity(
  port,
  bundlePath,
  { log = (m) => console.log(m), err = (m) => console.error(m), fetchHealth = fetchHealthWithRetry } = {},
) {
  const computedId = computeBuildId(bundlePath);
  if (computedId === null) {
    log(`  !!  Could not compute build identity (bundle not found at ${bundlePath}) — skipping verification.`);
    return true;
  }

  log('  >> Verifying build identity...');
  let health;
  try {
    health = await fetchHealth(port);
  } catch (e) {
    err(`  ERR Could not reach /health to verify build identity: ${e?.message ?? e}`);
    return false;
  }

  const cmp = compareBuildIdentity(computedId, health);
  if (cmp.status === 'match') {
    log(`  OK  Build identity verified (${cmp.buildId.slice(0, 12)}...).`);
    return true;
  }
  if (cmp.status === 'unknown') {
    log('  !!  Running daemon reports no buildId (predates this feature) — cannot verify build identity.');
    log('      Recommend a manual restart to pick up an identity-reporting build.');
    return true;
  }
  err('  ERR Build identity mismatch — the running daemon is not the build just deployed.');
  err(`      Just-built hash:        ${cmp.computedId}`);
  err(`      Running daemon buildId: ${cmp.remoteId}`);
  return false;
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
    // plus its own orphan-port (req-009) and build-identity (req-008) checks.
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
    if (r.status !== 0) {
      process.exit(r.status ?? 1);
    }

    // req-008: only after the restart script itself reports success.
    const bundlePath = join(repoRoot, 'server-http.bundle.mjs');
    const identityOk = await verifyBuildIdentity(port, bundlePath);
    process.exit(identityOk ? 0 : 1);
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
