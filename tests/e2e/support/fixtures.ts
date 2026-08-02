/**
 * Shared envelope builders and fixture-seeding helpers for the E2E suites
 * (req-001, req-002). Fixture events are seeded via real POST /emit calls —
 * the suites never write to the ephemeral DB directly.
 */

export interface TelemetryEnvelope {
  schema_version: '1.0';
  event: string;
  session_id: string;
  phase: string;
  agent: string;
  tool: string;
  model: string;
  mcp_mode: string;
  timestamp: string;
  product_id?: string;
  data: Record<string, unknown>;
}

export function buildEnvelope(overrides: Partial<TelemetryEnvelope> = {}): TelemetryEnvelope {
  return {
    schema_version: '1.0',
    event: 'phase_start',
    session_id: 'e2e-session',
    phase: 'spec',
    agent: 'planifest-spec-agent',
    tool: 'claude-code',
    model: 'claude-sonnet-5',
    mcp_mode: 'none',
    timestamp: '2026-08-01T10:00:00Z',
    data: { phase_name: 'spec' },
    ...overrides,
  };
}

/** A schema-invalid envelope — missing the required `agent` field. */
export function buildInvalidEnvelope(): Record<string, unknown> {
  const envelope = buildEnvelope() as Record<string, unknown>;
  delete envelope['agent'];
  return envelope;
}

/**
 * A known, deterministic fixture set covering: two phases, two agents, two
 * product_ids, a spread of timestamps (for from/to filtering), and enough
 * rows (12) to exercise pagination at a page size below the default 50.
 */
export function buildFixtureSet(): TelemetryEnvelope[] {
  const phases = ['spec', 'codegen'] as const;
  const agents = ['planifest-spec-agent', 'planifest-codegen-agent'] as const;
  const productIds = ['/repo/product-a', '/repo/product-b'] as const;

  const events: TelemetryEnvelope[] = [];
  for (let i = 0; i < 12; i++) {
    const hour = 8 + i; // 2026-08-01T08:00Z .. T19:00Z
    events.push(
      buildEnvelope({
        session_id: `e2e-fixture-session-${i}`,
        phase: phases[i % 2],
        agent: agents[i % 2],
        product_id: productIds[i % 2],
        timestamp: `2026-08-01T${String(hour).padStart(2, '0')}:00:00Z`,
        event: 'phase_start',
        data: { phase_name: phases[i % 2] },
      }),
    );
  }
  return events;
}

/**
 * Parses a timestamp string as returned by /query (DuckDB TIMESTAMPTZ::VARCHAR,
 * e.g. "2026-08-01 11:00:00+01" — space-separated, and rendered in the DB
 * session's local timezone with a bare (colonless) offset that JS's Date
 * parser rejects unless normalized to "+01:00").
 */
export function parseDbTimestamp(ts: string): number {
  let iso = ts.includes('T') ? ts : ts.replace(' ', 'T');
  iso = iso.replace(/([+-]\d{2})$/, '$1:00');
  return new Date(iso).getTime();
}

/** Seeds the given fixture set into a running server via real POST /emit calls. */
export async function seedFixtures(baseURL: string, events: TelemetryEnvelope[]): Promise<void> {
  for (const event of events) {
    const res = await fetch(`${baseURL}/emit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (!res.ok) {
      throw new Error(`fixture seed failed: HTTP ${res.status} for session ${event.session_id}`);
    }
  }
}
