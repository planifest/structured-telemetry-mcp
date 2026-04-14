#!/usr/bin/env node
/**
 * structured-telemetry-mcp — backend REST daemon.
 *
 * Single persistent process; owns the DuckDB connection.
 * All stdio MCP servers forward emit/query calls here via HTTP.
 *
 * Endpoints:
 *   GET  /health  — liveness check
 *   POST /emit    — write a telemetry event
 *   POST /query   — run a query (bottlenecks | failures | token_efficiency)
 *
 * Port: PLANIFEST_MCP_PORT env var, default 3741.
 */

import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { openDatabase } from './db/index.js';
import { DuckDbEventRepository } from './db/duckdb-event-repository.js';
import { DuckDbQueryService } from './query/query-service.js';
import { dispatchQuery } from './server-factory.js';
import { validateEvent } from './validation/validate-event.js';

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
  process.stderr.write(`[telemetry-backend] unhandledRejection: ${err}\n`);
  process.exit(1);
});
process.on('uncaughtException', (err: Error) => {
  process.stderr.write(`[telemetry-backend] uncaughtException: ${err?.message ?? err}\n`);
  process.exit(1);
});

// ── DB ────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env['PLANIFEST_MCP_PORT'] ?? '3741', 10);
const db   = await openDatabase();
const repo = new DuckDbEventRepository(db);
const qs   = new DuckDbQueryService(db);

// ── Helpers ───────────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function bigIntReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? Number(value) : value;
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body, bigIntReplacer);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);

  // GET /health
  if (req.method === 'GET' && url.pathname === '/health') {
    json(res, 200, { ok: true, version: VERSION });
    return;
  }

  // POST /emit
  if (req.method === 'POST' && url.pathname === '/emit') {
    try {
      const event = JSON.parse(await readBody(req)) as unknown;
      const validation = validateEvent(event);
      if (!validation.isValid) {
        json(res, 400, { ok: false, errors: validation.errors });
        return;
      }
      const result = await repo.write(event as Parameters<typeof repo.write>[0]);
      json(res, 200, result);
    } catch (err) {
      json(res, 400, { ok: false, errors: [`emit error: ${err}`] });
    }
    return;
  }

  // POST /query
  if (req.method === 'POST' && url.pathname === '/query') {
    try {
      const q = JSON.parse(await readBody(req)) as Record<string, unknown>;
      const result = await dispatchQuery(qs, q);
      json(res, 200, result);
    } catch (err) {
      json(res, 400, { ok: false, errors: [`query error: ${err}`] });
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  process.stderr.write(`[telemetry-backend] v${VERSION} ready — http://127.0.0.1:${PORT}\n`);
});
