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
import { createHash, randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DuckDBInstance } from '@duckdb/node-api';

import { openDatabase, resolveDbPath, closeDatabase } from './db/index.js';
import { classifyStartupError, formatRefuseToStartMessage } from './db/refuse-to-start.js';
import { runCheckpoint } from './db/checkpoint.js';
import { runBackup } from './backup/backup-service.js';
import { DuckDbEventRepository } from './db/duckdb-event-repository.js';
import { DuckDbQueryService } from './query/query-service.js';
import { dispatchQuery, QueryShape } from './server-factory.js';
import { validateEvent } from './validation/validate-event.js';
import { validateQuery } from './query/validate-query.js';
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

// ── Request-boundary limits (0000019) ────────────────────────────────────────
// req-004: a body-size cap and a request timeout. Overridable via env for tests
// so a body-cap test need not stream the full production default.
const MAX_BODY_BYTES = Number(process.env['PLANIFEST_MAX_BODY_BYTES'] ?? 4 * 1024 * 1024);
const REQUEST_TIMEOUT_MS = Number(process.env['PLANIFEST_REQUEST_TIMEOUT_MS'] ?? 30_000);

// The actual bound port, set once the listener is up. The Host/Origin checks
// (req-001, req-002) compare against this, NOT the configured PORT constant,
// so an ephemeral-port test server (PLANIFEST_MCP_PORT=0) is not locked out
// (design R-008, 0000016 R-002).
let boundPort = PORT;

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

// ── Scheduled, verified backup (req-006) ─────────────────────────────────────
// ADR-029: an in-process timer, alongside the checkpoint timer above, using
// this same daemon's already-open connection for EXPORT DATABASE — never a
// second connection to telemetry.db. Failures degrade-and-keep-serving, same
// as the checkpoint path. Overridable via env for tests; production default
// is once every 24h.

const BACKUP_INTERVAL_MS = Number(process.env['PLANIFEST_BACKUP_INTERVAL_MS'] ?? 24 * 60 * 60 * 1000);

// Reentrancy guard: EXPORT DATABASE can, in principle, take longer than the
// configured interval (unlikely at the 24h production default, but real for
// any shortened/test interval or a slow-disk/large-DB system). Without this,
// an overlapping tick could race pruneRetainedSet() against another run's
// promote, or write the sidecar out of order — ironic for a data-integrity
// feature (P5 security finding). A tick that finds a run already in flight
// is simply skipped; the next tick will try again.
let backupInFlight = false;

/** Runs one backup cycle; failures warn and degrade-and-keep-serving (never crashes, never stops writes). */
async function backup(): Promise<void> {
  if (backupInFlight) {
    process.stderr.write('[telemetry-backend] backup tick skipped — previous run still in flight\n');
    return;
  }
  backupInFlight = true;
  try {
    await runBackup(db, (msg) => process.stderr.write(`[telemetry-backend] ${msg}\n`));
  } finally {
    backupInFlight = false;
  }
}

const backupTimer = setInterval(() => { void backup(); }, BACKUP_INTERVAL_MS);

// ── Helpers ───────────────────────────────────────────────────────────────────

/** req-004: a body that exceeded the byte cap. Mapped to 413 by the route handlers. */
class BodyTooLargeError extends Error {
  constructor() { super('request body exceeds the size cap'); this.name = 'BodyTooLargeError'; }
}

/**
 * req-004: read the request body with a hard byte cap enforced at TWO independent
 * points — a Content-Length pre-check and a streaming counter that destroys the
 * connection once the running total exceeds the cap. The second is what holds
 * when Content-Length is absent (chunked) or forged; a Content-Length-only check
 * is not sufficient. The `end` handler's body is wrapped so an allocation/parse
 * throw REJECTS the promise instead of escaping to uncaughtException (which the
 * pre-0000019 code did, terminating the daemon on one oversized request).
 */
function readBody(req: IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    // Honest Content-Length over the cap: reject WITHOUT destroying the socket,
    // so the route can still send a 413 back. The size is already known, so
    // there is no benefit to killing the connection here.
    const declared = Number(req.headers['content-length']);
    if (Number.isFinite(declared) && declared > maxBytes) {
      reject(new BodyTooLargeError());
      return;
    }
    const chunks: Buffer[] = [];
    let total = 0;
    let destroyed = false;
    req.on('data', (c: Buffer) => {
      if (destroyed) return;
      total += c.length;
      if (total > maxBytes) {
        // Streaming over the cap with an absent or forged Content-Length: the
        // body is unbounded, so destroy the connection rather than buffer more.
        destroyed = true;
        req.destroy();
        reject(new BodyTooLargeError());
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(Buffer.concat(chunks).toString('utf8'));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// ── Request boundary: Host / Origin / Content-Type (req-001, req-002, req-003) ─

interface BoundaryRefusal { status: number; field: string; message: string; }

/** The daemon's own accepted host:port pairs, computed from the actually-bound port. */
function allowedAuthorities(): string[] {
  return [`127.0.0.1:${boundPort}`, `localhost:${boundPort}`];
}

/**
 * Runs the three provenance/intake checks before any route handler and before
 * the body is read (ADR-032). Returns a refusal to send, or null to proceed.
 *  - req-001: Host must be an allow-listed loopback authority.
 *  - req-002: an Origin, IF present, must be the daemon's own; absent Origin is
 *    accepted (the stdio proxy and emission hooks send none).
 *  - req-003: writes must carry Content-Type: application/json.
 */
function checkBoundary(req: IncomingMessage): BoundaryRefusal | null {
  const host = req.headers.host;
  if (typeof host !== 'string' || host.length > 255 || !allowedAuthorities().includes(host)) {
    process.stderr.write(`[telemetry-backend] refused: Host=${String(host)}\n`);
    return { status: 403, field: 'host', message: 'Host not permitted' };
  }

  const origin = req.headers.origin;
  if (origin !== undefined) {
    const allowed = allowedAuthorities().flatMap((a) => [`http://${a}`, `https://${a}`]);
    if (!allowed.includes(origin)) {
      process.stderr.write(`[telemetry-backend] refused: Origin=${String(origin)}\n`);
      return { status: 403, field: 'origin', message: 'cross-origin request refused' };
    }
  }

  if (req.method === 'POST') {
    const ct = req.headers['content-type'];
    const mediaType = typeof ct === 'string' ? ct.split(';')[0]!.trim().toLowerCase() : '';
    if (mediaType !== 'application/json') {
      return { status: 415, field: 'content-type', message: 'Content-Type must be application/json' };
    }
  }
  return null;
}

// ── Error redaction (req-006) ─────────────────────────────────────────────────

/**
 * Maps a caught error to a redacted HTTP response — never engine text, SQL, a
 * stack, or a stored value. BodyTooLarge → 413, JSON parse failure → 400, and
 * anything else is an engine/internal failure → 500. Every response carries a
 * correlationId that the stderr log line also carries, so an operator can trace
 * a redacted client error back to the full error and stack.
 */
function respondError(res: ServerResponse, err: unknown): void {
  const correlationId = randomUUID();
  if (err instanceof BodyTooLargeError) {
    json(res, 413, { ok: false, errors: [{ field: 'body', message: 'request body too large' }], correlationId });
    return;
  }
  if (err instanceof SyntaxError) {
    json(res, 400, { ok: false, errors: [{ field: 'body', message: 'request body is not valid JSON' }], correlationId });
    return;
  }
  process.stderr.write(`[telemetry-backend] request failed correlationId=${correlationId}: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  json(res, 500, { ok: false, errors: ['internal error'], correlationId });
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
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${boundPort}`);

  // Request boundary (req-001/002/003, ADR-032) — before routing, before body read.
  const refusal = checkBoundary(req);
  if (refusal) {
    // A 403 is decided before anything executes, so it carries no correlationId
    // (nothing to trace). A 415 has begun handling the request, so it does.
    const body = refusal.status === 403
      ? { ok: false, errors: [{ field: refusal.field, message: refusal.message }] }
      : { ok: false, errors: [{ field: refusal.field, message: refusal.message }], correlationId: randomUUID() };
    json(res, refusal.status, body);
    return;
  }

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
      const event = JSON.parse(await readBody(req, MAX_BODY_BYTES)) as unknown;
      const validation = validateEvent(event);
      if (!validation.isValid) {
        // req-006: validateEvent errors are the caller's own submitted structure,
        // not stored data — the pre-existing string[] shape is preserved.
        json(res, 400, { ok: false, errors: validation.errors });
        return;
      }
      const result = await repo.write(event as Parameters<typeof repo.write>[0]);
      if (result.ok) {
        noteWrite();
      }
      json(res, 200, result);
    } catch (err) {
      respondError(res, err);
    }
    return;
  }

  // POST /query
  if (req.method === 'POST' && url.pathname === '/query') {
    try {
      const raw = JSON.parse(await readBody(req, MAX_BODY_BYTES)) as unknown;

      // req-005: the SAME two-stage gate the MCP path uses — argument shape
      // (QueryShape), then numeric-range validation (validateQuery) — so the
      // HTTP and MCP paths can no longer disagree on what a valid query is.
      const shapeCheck = QueryShape.safeParse(raw);
      if (!shapeCheck.success) {
        const errors = shapeCheck.error.issues.map((i) => ({ field: i.path.join('.') || '(root)', message: i.message }));
        json(res, 400, { ok: false, errors });
        return;
      }
      const q = shapeCheck.data as Record<string, unknown>;
      const gate = validateQuery(q);
      if (!gate.ok) {
        json(res, 400, { ok: false, errors: gate.errors });
        return;
      }

      const result = await dispatchQuery(qs, q);
      json(res, 200, result);
    } catch (err) {
      // req-006: an engine failure is redacted to a 500 with a correlationId —
      // never the raw DuckDB text, which embedded SQL and stored row values.
      respondError(res, err);
    }
    return;
  }

  res.writeHead(404);
  res.end();
});

// req-004: bound the time a slow-body ("slow loris") connection can hold open.
server.requestTimeout = REQUEST_TIMEOUT_MS;

server.listen(PORT, '127.0.0.1', () => {
  const addr = server.address();
  boundPort = typeof addr === 'object' && addr !== null ? addr.port : PORT;
  process.stderr.write(`[telemetry-backend] v${VERSION} ready — http://127.0.0.1:${boundPort}\n`);
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
  clearInterval(backupTimer);
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
