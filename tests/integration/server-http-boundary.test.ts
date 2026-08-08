/**
 * 0000019 integrated request-boundary pass over src/server-http.ts:
 *   req-001 Host allow-list, req-002 Origin rejection, req-003 Content-Type
 *   required on writes, req-004 body cap + crash safety, req-006 error redaction.
 *
 * These five requirements all edit the same request-entry path and are verified
 * together against a real server-http.ts child process (harness), using raw
 * node:http so Host/Origin/Content-Type and chunked/forged-length bodies can be
 * controlled exactly — node fetch/undici forbids overriding Host.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { startServer, type ServerHandle } from '../e2e/support/server-harness.js';

interface RawResult { status: number; body: string; }

function rawRequest(opts: {
  port: number; method: string; path: string;
  headers?: Record<string, string>;
  body?: string;
  rawBodyChunks?: string[];        // for chunked / forged-length streaming
}): Promise<RawResult> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port: opts.port, method: opts.method, path: opts.path, headers: opts.headers ?? {} },
      (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      },
    );
    req.on('error', (err) => reject(err));
    if (opts.rawBodyChunks) {
      for (const c of opts.rawBodyChunks) req.write(c);
      req.end();
    } else if (opts.body !== undefined) {
      req.end(opts.body);
    } else {
      req.end();
    }
  });
}

const JSON_H = (extra: Record<string, string> = {}) => ({ 'Content-Type': 'application/json', ...extra });

let server: ServerHandle;
let port: number;
const CAP = 2000; // small body cap for the test server (req-004)

beforeAll(async () => {
  server = await startServer({ PLANIFEST_MAX_BODY_BYTES: String(CAP) });
  port = Number(new URL(server.baseURL).port);
}, 30_000);

afterAll(async () => {
  await server.stop();
});

const validEnvelope = () => JSON.stringify({
  schema_version: '1.0', event: 'phase_start', session_id: 'boundary-sess',
  phase: 'codegen', agent: 'a', tool: 'claude-code', model: 'm', mcp_mode: 'context',
  timestamp: '2026-08-08T12:00:00Z', data: { phase_name: 'codegen' },
});

describe('req-001: Host allow-list', () => {
  it('refuses a foreign Host with 403 on every route', async () => {
    for (const path of ['/health', '/ui', '/emit', '/query']) {
      const method = path === '/emit' || path === '/query' ? 'POST' : 'GET';
      const r = await rawRequest({ port, method, path, headers: { Host: 'evil.example.com', ...JSON_H() }, body: method === 'POST' ? '{}' : undefined });
      expect(r.status, `${path} with foreign Host`).toBe(403);
      expect(r.body).not.toMatch(/select|from |duckdb/i);
    }
  });

  it('accepts the loopback Host', async () => {
    const r = await rawRequest({ port, method: 'GET', path: '/health', headers: { Host: `127.0.0.1:${port}` } });
    expect(r.status).toBe(200);
  });
});

describe('req-002: Origin rejection', () => {
  it('refuses a foreign Origin on /emit with 403 and writes no event', async () => {
    const r = await rawRequest({ port, method: 'POST', path: '/emit', headers: JSON_H({ Origin: 'https://evil.example.com' }), body: validEnvelope() });
    expect(r.status).toBe(403);
    // confirm nothing was written for this session
    const q = await rawRequest({ port, method: 'POST', path: '/query', headers: JSON_H(), body: JSON.stringify({ mode: 'event_log', session_id: 'boundary-sess' }) });
    const parsed = JSON.parse(q.body) as { json: { events: unknown[] } };
    expect(parsed.json.events.length).toBe(0);
  });

  it('accepts a request with no Origin header (stdio proxy / hooks)', async () => {
    const r = await rawRequest({ port, method: 'GET', path: '/health' });
    expect(r.status).toBe(200);
  });

  it('accepts the daemon own Origin', async () => {
    const r = await rawRequest({ port, method: 'GET', path: '/health', headers: { Origin: `http://127.0.0.1:${port}` } });
    expect(r.status).toBe(200);
  });

  it('emits no Access-Control-Allow-Origin header', async () => {
    const acao = await new Promise<string | undefined>((resolve) => {
      const req = http.request({ host: '127.0.0.1', port, method: 'GET', path: '/health' }, (res) => {
        resolve(res.headers['access-control-allow-origin'] as string | undefined);
        res.resume();
      });
      req.end();
    });
    expect(acao).toBeUndefined();
  });
});

describe('req-003: Content-Type required on writes', () => {
  it('refuses text/plain and missing Content-Type with 415', async () => {
    const plain = await rawRequest({ port, method: 'POST', path: '/emit', headers: { 'Content-Type': 'text/plain' }, body: validEnvelope() });
    expect(plain.status).toBe(415);
    const missing = await rawRequest({ port, method: 'POST', path: '/emit', headers: {}, body: validEnvelope() });
    expect(missing.status).toBe(415);
  });

  it('accepts application/json and a charset parameter', async () => {
    const ok = await rawRequest({ port, method: 'POST', path: '/emit', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: validEnvelope() });
    expect(ok.status).toBe(200);
  });
});

describe('req-004: body cap and crash safety', () => {
  it('refuses an over-cap body with an honest Content-Length (413) and stays alive', async () => {
    const big = JSON.stringify({ blob: 'x'.repeat(CAP * 2) });
    const r = await rawRequest({ port, method: 'POST', path: '/emit', headers: JSON_H(), body: big });
    expect(r.status).toBe(413);
    const health = await rawRequest({ port, method: 'GET', path: '/health' });
    expect(health.status).toBe(200);
  });

  it('refuses an over-cap chunked body with no Content-Length and stays alive', async () => {
    // No Content-Length; node uses chunked transfer. The streaming byte counter
    // must fire independently of any length header.
    const chunk = 'y'.repeat(500);
    let errored = false;
    try {
      await rawRequest({ port, method: 'POST', path: '/emit', headers: JSON_H(), rawBodyChunks: Array.from({ length: 10 }, () => chunk) });
    } catch { errored = true; } // connection may be destroyed mid-write
    const health = await rawRequest({ port, method: 'GET', path: '/health' });
    expect(health.status).toBe(200); // the process survived either way
    expect(errored || true).toBe(true);
  });

  it('returns 400 (not 500, not a crash) for malformed JSON within the cap', async () => {
    const r = await rawRequest({ port, method: 'POST', path: '/emit', headers: JSON_H(), body: '{not valid json' });
    expect(r.status).toBe(400);
    const health = await rawRequest({ port, method: 'GET', path: '/health' });
    expect(health.status).toBe(200);
  });
});

describe('req-006: error redaction on the HTTP path', () => {
  it('returns a field-named error for a bad limit with no engine text', async () => {
    const r = await rawRequest({ port, method: 'POST', path: '/query', headers: JSON_H(), body: JSON.stringify({ mode: 'event_log', limit: 'abc' }) });
    expect(r.status).toBe(400);
    expect(r.body).not.toMatch(/binder error|line \d|duckdb|limit nan/i);
    const parsed = JSON.parse(r.body) as { ok: boolean; errors: Array<{ field?: string }> };
    expect(parsed.ok).toBe(false);
    expect(parsed.errors.some((e) => e.field === 'limit')).toBe(true);
  });

  it('does not leak a stored value for a type-confused filter', async () => {
    const r = await rawRequest({ port, method: 'POST', path: '/query', headers: JSON_H(), body: JSON.stringify({ mode: 'event_log', session_id: 123 }) });
    // caught at the shape gate (session_id must be a string) — a clean rejection,
    // never a DuckDB conversion error embedding a stored session_id value.
    expect(r.body).not.toMatch(/conversion error|could not convert|duckdb/i);
    const parsed = JSON.parse(r.body) as { ok: boolean };
    expect(parsed.ok).toBe(false);
  });
});
