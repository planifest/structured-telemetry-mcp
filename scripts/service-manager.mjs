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
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const action = process.argv[2];

if (!action) {
  console.error('Usage: node scripts/service-manager.mjs <install|uninstall|status|restart|deploy>');
  process.exit(1);
}

function isServiceActive() {
  if (process.platform === 'darwin') {
    return spawnSync('launchctl', ['list', 'com.planifest.telemetry-mcp'], { stdio: 'ignore' }).status === 0;
  }
  if (process.platform === 'linux') {
    return spawnSync('systemctl', ['--user', 'is-active', '--quiet', 'planifest-telemetry-mcp'], { stdio: 'ignore' }).status === 0;
  }
  return false;
}

if (action === 'deploy') {
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
    // deploy.ps1 already does global install + detect-installed-and-restart.
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
