#!/usr/bin/env node
/**
 * structured-telemetry-mcp — entry point.
 * Wires dependencies and connects the MCP server to stdio transport.
 *
 * Business logic lives in server-factory.ts (testable without this file).
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

import { openDatabase } from './db/index.js';
import { DuckDbEventRepository } from './db/duckdb-event-repository.js';
import { DuckDbQueryService } from './query/query-service.js';
import { createServer } from './server-factory.js';

// ── Version ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
createRequire(import.meta.url); // retain for bundle compatibility

const VERSION: string = (() => {
  for (const rel of ['../package.json', './package.json']) {
    const p = resolve(__dirname, rel);
    if (existsSync(p)) {
      try {
        return (JSON.parse(readFileSync(p, 'utf8')) as { version: string }).version;
      } catch { /* continue */ }
    }
  }
  return 'unknown';
})();

// ── Error handling ────────────────────────────────────────────────────────────

process.on('unhandledRejection', (err) => {
  process.stderr.write(`[structured-telemetry-mcp] unhandledRejection: ${err}\n`);
});
process.on('uncaughtException', (err: Error) => {
  process.stderr.write(`[structured-telemetry-mcp] uncaughtException: ${err?.message ?? err}\n`);
});

// ── Wire and start ────────────────────────────────────────────────────────────

const db = await openDatabase();
const repo = new DuckDbEventRepository(db);
const qs = new DuckDbQueryService(db);
const server = createServer(repo, qs, VERSION);

const transport = new StdioServerTransport();
await server.connect(transport);
process.stderr.write(`[structured-telemetry-mcp] v${VERSION} ready (stdio)\n`);
