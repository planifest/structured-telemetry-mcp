#!/usr/bin/env node
/**
 * structured-telemetry-mcp — stdio MCP server entry point.
 *
 * Spawned once per agent session by the MCP host (Claude Code / Claude Desktop).
 * Communicates with the host over stdin/stdout (MCP stdio transport).
 * All DB operations are forwarded via HTTP to the backend REST daemon.
 *
 * Usage: node server.bundle.mjs [backendUrl]
 *   backendUrl  URL of the backend daemon (default: http://localhost:3741)
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';

import { HttpEventRepository } from './http-repo.js';
import { HttpQueryService } from './http-query-service.js';
import { createServer } from './server-factory.js';

// ── Version ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));

const VERSION: string = (() => {
  for (const rel of ['../package.json', './package.json']) {
    const p = resolve(__dirname, rel);
    if (existsSync(p)) {
      try { return (JSON.parse(readFileSync(p, 'utf8')) as { version: string }).version; }
      catch { /* continue */ }
    }
  }
  return 'unknown';
})();

// ── Error handling ────────────────────────────────────────────────────────────

process.on('unhandledRejection', (err) => {
  process.stderr.write(`[structured-telemetry-mcp] unhandledRejection: ${err}\n`);
  process.exit(1);
});
process.on('uncaughtException', (err: Error) => {
  process.stderr.write(`[structured-telemetry-mcp] uncaughtException: ${err?.message ?? err}\n`);
  process.exit(1);
});

// ── Connect ───────────────────────────────────────────────────────────────────

const backendUrl = process.argv[2] ?? 'http://localhost:3741';

const repo   = new HttpEventRepository(backendUrl);
const qs     = new HttpQueryService(backendUrl);
const server = createServer(repo, qs, VERSION);

const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write(`[structured-telemetry-mcp] v${VERSION} ready (stdio → ${backendUrl})\n`);
