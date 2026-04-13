#!/usr/bin/env node
/**
 * version-sync — reads version from package.json and prints it.
 * Extend this script when plugin manifests are added (npm publish pipeline).
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));

console.log(`version: ${pkg.version}`);
