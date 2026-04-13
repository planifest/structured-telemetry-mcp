/**
 * req-006-performance: emit_event p95 latency < 100ms.
 * Runs 1000 sequential writes and reports p50/p95/p99/avg to stdout.
 * CI fails if p95 exceeds 100ms. Threshold chosen to tolerate slow CI disk
 * (Windows GH-hosted runners measure ~28ms p95) while catching regressions.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { openDatabase, closeDatabase } from '../src/db/index.js';
import { writeEvent } from '../src/db/events-repository.js';
import type { TelemetryEvent } from '../src/types/events.js';

const TEST_DB = join(tmpdir(), `telemetry-perf-${Date.now()}.db`);
const ITERATIONS = 1000;
const P95_THRESHOLD_MS = 100;

beforeAll(async () => {
  process.env['PLANIFEST_TELEMETRY_DB'] = TEST_DB;
  await openDatabase(TEST_DB);
});

afterAll(() => {
  closeDatabase();
  try { rmSync(TEST_DB); } catch { /* best effort */ }
  delete process.env['PLANIFEST_TELEMETRY_DB'];
});

describe('req-006-performance: emit_event latency', () => {
  it(`p95 write latency is below ${P95_THRESHOLD_MS}ms over ${ITERATIONS} iterations`, async () => {
    const latencies: number[] = [];

    const event: TelemetryEvent = {
      schema_version: '1.0',
      event: 'phase_start',
      session_id: 'perf-test',
      phase: 'codegen',
      agent: 'perf-runner',
      tool: 'vitest',
      model: 'n/a',
      mcp_mode: 'none',
      timestamp: new Date().toISOString(),
      data: { phase_name: 'codegen' },
    };

    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await writeEvent(event);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);

    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    const p99 = percentile(latencies, 99);
    const avg = latencies.reduce((s, v) => s + v, 0) / latencies.length;

    // Always print so results appear in CI logs.
    console.log('\n── emit_event latency report ──────────────────────');
    console.log(`  Iterations : ${ITERATIONS}`);
    console.log(`  p50        : ${p50.toFixed(3)} ms`);
    console.log(`  p95        : ${p95.toFixed(3)} ms`);
    console.log(`  p99        : ${p99.toFixed(3)} ms`);
    console.log(`  avg        : ${avg.toFixed(3)} ms`);
    console.log('───────────────────────────────────────────────────\n');

    expect(p95, `p95 latency ${p95.toFixed(3)}ms exceeds ${P95_THRESHOLD_MS}ms threshold`).toBeLessThan(P95_THRESHOLD_MS);
  }, 60_000);
});

function percentile(sorted: number[], pct: number): number {
  const index = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
}
