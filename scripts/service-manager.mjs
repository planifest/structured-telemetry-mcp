#!/usr/bin/env node
/**
 * service-manager — dispatches `npm run service:*` to the right platform
 * script: service.ps1 (Windows), service-macos.sh (macOS), service-linux.sh
 * (Linux). Keeps one command surface (install|uninstall|status|restart)
 * across all three platforms.
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const action = process.argv[2];

if (!action) {
  console.error('Usage: node scripts/service-manager.mjs <install|uninstall|status|restart>');
  process.exit(1);
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
