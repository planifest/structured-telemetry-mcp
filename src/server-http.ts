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
 *   POST /query   — run a query (bottlenecks | failures | token_efficiency | event_log)
 *   GET  /ui      — static log-viewer page (0000015, ADR-018)
 *
 * Port: PLANIFEST_MCP_PORT env var, default 3741.
 */

import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DuckDBInstance } from '@duckdb/node-api';

import { openDatabase, resolveDbPath, closeDatabase } from './db/index.js';
import { classifyStartupError, formatRefuseToStartMessage } from './db/refuse-to-start.js';
import { runCheckpoint } from './db/checkpoint.js';
import { DuckDbEventRepository } from './db/duckdb-event-repository.js';
import { DuckDbQueryService } from './query/query-service.js';
import { dispatchQuery } from './server-factory.js';
import { validateEvent } from './validation/validate-event.js';
import { INDEX_HTML } from './ui/index-html.js';

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

// req-004b (req-008): a build-identity fingerprint distinct from VERSION — two
// builds can share the same semver but differ in content (deploy.mjs uses this
// to detect a stale running process). SHA-256 of the built bundle; when running
// unbundled (tsx in dev) the bundle file may not be found — degrade gracefully
// (null), never throw or block startup/health.
const BUILD_ID: string | null = (() => {
  for (const rel of ['../server-http.bundle.mjs', './server-http.bundle.mjs']) {
    const p = resolve(__dirname, rel);
    if (existsSync(p)) {
      try { return createHash('sha256').update(readFileSync(p)).digest('hex'); }
      catch { /* continue */ }
    }
  }
  return null;
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

// req-004: attempt to open the database exactly once, before any migration
// (src/db/index.ts) and before the HTTP listener opens. A lock-contention or
// poisoned-WAL failure means the store is unusable — refuse to start rather
// than retry-looping or touching the WAL. ADR-030: this exits 0, deliberately.
let db: DuckDBInstance;
try {
  db = await openDatabase();
} catch (err) {
  const classification = classifyStartupError(err);
  if (classification !== null) {
    process.stderr.write(`${formatRefuseToStartMessage(resolveDbPath(), classification)}\n`);
    process.exit(0);
  }
  // Not a "store is unusable" condition — an unrelated startup error keeps
  // its existing behaviour (crash / non-zero exit).
  throw err;
}

const repo = new DuckDbEventRepository(db);
const qs   = new DuckDbQueryService(db);

// ── Checkpoint discipline (req-001, req-002) ─────────────────────────────────
// Checkpoint every 60s or every 100 writes since the last checkpoint —
// whichever comes first — plus once more on graceful shutdown, bounding the
// data-at-risk window (domain-glossary.md). Overridable via env for tests;
// production defaults are the 60s/100-write/5s values req-002/req-001 specify.

const CHECKPOINT_INTERVAL_MS = Number(process.env['PLANIFEST_CHECKPOINT_INTERVAL_MS'] ?? 60_000);
const CHECKPOINT_WRITE_THRESHOLD = Number(process.env['PLANIFEST_CHECKPOINT_WRITE_THRESHOLD'] ?? 100);
const SHUTDOWN_TIMEOUT_MS = Number(process.env['PLANIFEST_SHUTDOWN_TIMEOUT_MS'] ?? 5_000);

let writesSinceCheckpoint = 0;

/** Runs a checkpoint; a failure warns and degrades-and-keeps-serving (never crashes, never stops writes). */
async function checkpoint(): Promise<void> {
  const ok = await runCheckpoint(db, (msg) => process.stderr.write(`[telemetry-backend] ${msg}\n`));
  if (ok) writesSinceCheckpoint = 0;
}

/** Called once per successful write; triggers a checkpoint at the write-count threshold. */
function noteWrite(): void {
  writesSinceCheckpoint += 1;
  if (writesSinceCheckpoint >= CHECKPOINT_WRITE_THRESHOLD) {
    void checkpoint();
  }
}

const checkpointTimer = setInterval(() => { void checkpoint(); }, CHECKPOINT_INTERVAL_MS);

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
    json(res, 200, { ok: true, version: VERSION, buildId: BUILD_ID });
    return;
  }

  // GET /ui — static log-viewer page (0000015, ADR-018)
  if (req.method === 'GET' && url.pathname === '/ui') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(INDEX_HTML);
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
      if (result.ok) {
        noteWrite();
      }
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
  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr !== null ? addr.port : PORT;
  process.stderr.write(`[telemetry-backend] v${VERSION} ready — http://127.0.0.1:${actualPort}\n`);
});

// ── Graceful shutdown (req-001) ──────────────────────────────────────────────
// SIGTERM/SIGINT: stop accepting new connections, checkpoint, close the DB,
// exit 0 — bounded by SHUTDOWN_TIMEOUT_MS so a hung final checkpoint (e.g.
// disk full) can't hang shutdown forever. launchd (SuccessfulExit: false) and
// systemd (Restart=on-failure) both treat exit 0 as an intentional stop, not
// a crash to respawn from (ADR-030's same reasoning applies here).

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  clearInterval(checkpointTimer);
  process.stderr.write(`[telemetry-backend] ${signal} received — checkpointing and shutting down\n`);
  server.close();

  await Promise.race([
    checkpoint(),
    new Promise<void>((res) => setTimeout(res, SHUTDOWN_TIMEOUT_MS)),
  ]);
  closeDatabase();
  process.exit(0);
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });
