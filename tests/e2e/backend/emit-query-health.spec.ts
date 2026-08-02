/**
 * req-001-backend-e2e-suite: black-box HTTP coverage for /emit, /query, /health
 * against a real server-http.ts process + ephemeral DuckDB (ADR-022).
 */
import { test, expect } from '@playwright/test';
import { startServer, type ServerHandle } from '../support/server-harness.js';
import { buildEnvelope, buildInvalidEnvelope, buildFixtureSet, seedFixtures, parseDbTimestamp } from '../support/fixtures.js';

let server: ServerHandle;

test.beforeAll(async () => {
  server = await startServer();
});

test.afterAll(async () => {
  await server.stop();
});

test('req-001-backend-e2e-suite: GET /health returns ok', async ({ request }) => {
  const res = await request.get(`${server.baseURL}/health`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
});

test('req-001-backend-e2e-suite: POST /emit accepts a valid envelope and it is queryable', async ({ request }) => {
  const envelope = buildEnvelope({ session_id: 'req-001-valid-session', timestamp: '2026-08-01T12:00:00Z' });

  const emitRes = await request.post(`${server.baseURL}/emit`, { data: envelope });
  expect(emitRes.status()).toBe(200);
  const emitBody = await emitRes.json();
  expect(emitBody.ok).toBe(true);
  expect(emitBody.id).toBeTruthy();

  const queryRes = await request.post(`${server.baseURL}/query`, {
    data: { mode: 'event_log', session_id: 'req-001-valid-session' },
  });
  expect(queryRes.status()).toBe(200);
  const queryBody = await queryRes.json();
  const events = queryBody.json.events;
  expect(events).toHaveLength(1);
  expect(events[0].session_id).toBe('req-001-valid-session');
});

test('req-001-backend-e2e-suite: POST /emit rejects a schema-invalid envelope and does not persist it', async ({ request }) => {
  const invalid = buildInvalidEnvelope();
  const invalidSessionId = invalid['session_id'] as string;

  const emitRes = await request.post(`${server.baseURL}/emit`, { data: invalid });
  expect(emitRes.status()).toBe(400);
  const emitBody = await emitRes.json();
  expect(emitBody.ok).toBe(false);
  expect(emitBody.errors).toBeTruthy();

  const queryRes = await request.post(`${server.baseURL}/query`, {
    data: { mode: 'event_log', session_id: invalidSessionId },
  });
  const queryBody = await queryRes.json();
  expect(queryBody.json.events).toHaveLength(0);
});

test.describe('req-001-backend-e2e-suite: /query event_log filtering, pagination, sort', () => {
  test.beforeAll(async () => {
    await seedFixtures(server.baseURL, buildFixtureSet());
  });

  test('filters by phase', async ({ request }) => {
    const res = await request.post(`${server.baseURL}/query`, {
      data: { mode: 'event_log', phase: 'codegen', limit: 100 },
    });
    const body = await res.json();
    expect(body.json.events.length).toBeGreaterThan(0);
    for (const event of body.json.events) {
      expect(event.phase).toBe('codegen');
    }
  });

  test('filters by agent', async ({ request }) => {
    const res = await request.post(`${server.baseURL}/query`, {
      data: { mode: 'event_log', agent: 'planifest-spec-agent', limit: 100 },
    });
    const body = await res.json();
    expect(body.json.events.length).toBeGreaterThan(0);
    for (const event of body.json.events) {
      expect(event.agent).toBe('planifest-spec-agent');
    }
  });

  test('filters by product_id', async ({ request }) => {
    const res = await request.post(`${server.baseURL}/query`, {
      data: { mode: 'event_log', product_id: '/repo/product-a', limit: 100 },
    });
    const body = await res.json();
    expect(body.json.events.length).toBeGreaterThan(0);
    for (const event of body.json.events) {
      expect(event.product_id).toBe('/repo/product-a');
    }
  });

  test('filters by from/to timestamp range', async ({ request }) => {
    const res = await request.post(`${server.baseURL}/query`, {
      data: { mode: 'event_log', from: '2026-08-01T10:00:00Z', to: '2026-08-01T12:00:00Z', limit: 100 },
    });
    const body = await res.json();
    expect(body.json.events.length).toBeGreaterThan(0);
    const from = new Date('2026-08-01T10:00:00Z').getTime();
    const to = new Date('2026-08-01T12:00:00Z').getTime();
    for (const event of body.json.events) {
      const ts = parseDbTimestamp(event.timestamp);
      expect(ts).toBeGreaterThanOrEqual(from);
      expect(ts).toBeLessThanOrEqual(to);
    }
  });

  test('paginates via limit/offset and reports accurate total_count', async ({ request }) => {
    const page1 = await request.post(`${server.baseURL}/query`, {
      data: { mode: 'event_log', limit: 5, offset: 0, sort: 'asc' },
    });
    const page1Body = await page1.json();
    expect(page1Body.json.events).toHaveLength(5);
    const totalCount = page1Body.json.total_count;
    expect(totalCount).toBeGreaterThanOrEqual(12);

    const page2 = await request.post(`${server.baseURL}/query`, {
      data: { mode: 'event_log', limit: 5, offset: 5, sort: 'asc' },
    });
    const page2Body = await page2.json();
    expect(page2Body.json.events).toHaveLength(5);

    const page1Ids = page1Body.json.events.map((e: { id: string }) => e.id);
    const page2Ids = page2Body.json.events.map((e: { id: string }) => e.id);
    expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
  });

  test('sorts ascending and descending correctly', async ({ request }) => {
    const asc = await request.post(`${server.baseURL}/query`, {
      data: { mode: 'event_log', sort: 'asc', limit: 100 },
    });
    const ascBody = await asc.json();
    const ascTimestamps = ascBody.json.events.map((e: { timestamp: string }) => e.timestamp);
    const sortedAsc = [...ascTimestamps].sort();
    expect(ascTimestamps).toEqual(sortedAsc);

    const desc = await request.post(`${server.baseURL}/query`, {
      data: { mode: 'event_log', sort: 'desc', limit: 100 },
    });
    const descBody = await desc.json();
    const descTimestamps = descBody.json.events.map((e: { timestamp: string }) => e.timestamp);
    const sortedDesc = [...descTimestamps].sort().reverse();
    expect(descTimestamps).toEqual(sortedDesc);
  });
});
