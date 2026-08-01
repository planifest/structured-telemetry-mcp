/**
 * DuckDB implementation of IEventRepository.
 * Takes a DuckDBInstance in its constructor — no singletons, no globals.
 */

import type { DuckDBInstance } from '@duckdb/node-api';
import type { TelemetryEvent, StoredEvent } from '../types/events.js';
import type { IEventRepository, WriteResult, WriteError } from './repository.js';

export class DuckDbEventRepository implements IEventRepository {
  constructor(private readonly db: DuckDBInstance) {}

  async write(event: TelemetryEvent): Promise<WriteResult | WriteError> {
    try {
      const conn = await this.db.connect();
      try {
        const stmt = await conn.prepare(
          `INSERT INTO events
             (schema_version, event, session_id, initiative_id, product_id, phase, agent, tool, model, mcp_mode,
              timestamp, model_config, data)
           VALUES
             ($schema_version, $event, $session_id, $initiative_id, $product_id, $phase, $agent, $tool, $model,
              $mcp_mode, $timestamp::TIMESTAMPTZ, $model_config::JSON, $data::JSON)
           RETURNING id`,
        );

        await stmt.bind({
          schema_version: event.schema_version,
          event: event.event,
          session_id: event.session_id,
          initiative_id: event.initiative_id ?? null,
          product_id: event.product_id ?? null,
          phase: event.phase,
          agent: event.agent,
          tool: event.tool,
          model: event.model,
          mcp_mode: event.mcp_mode,
          timestamp: event.timestamp,
          model_config: event.model_config !== undefined ? JSON.stringify(event.model_config) : null,
          data: event.data !== undefined ? JSON.stringify(event.data) : null,
        });

        const result = await stmt.runAndReadAll();
        const rows = result.getRows() as Array<[string]>;
        const id = rows[0]?.[0] ?? crypto.randomUUID();
        return { ok: true, id };
      } finally {
        conn.disconnectSync();
      }
    } catch (err) {
      process.stderr.write(`[structured-telemetry-mcp] storage error: ${err}\n`);
      return { ok: false, errors: ['storage error'] };
    }
  }

  async findById(id: string): Promise<StoredEvent | null> {
    try {
      const conn = await this.db.connect();
      try {
        const stmt = await conn.prepare(
          `SELECT id, schema_version, event, session_id, initiative_id, product_id, phase, agent, tool, model,
                  mcp_mode, timestamp::VARCHAR AS timestamp, model_config::VARCHAR AS model_config,
                  data::VARCHAR AS data, inserted_at::VARCHAR AS inserted_at
           FROM events WHERE id = $id`,
        );
        await stmt.bind({ id });
        const result = await stmt.runAndReadAll();
        const rows = result.getRows() as Array<unknown[]>;
        if (rows.length === 0) return null;
        return rowToStoredEvent(rows[0]);
      } finally {
        conn.disconnectSync();
      }
    } catch {
      return null;
    }
  }
}

function rowToStoredEvent(row: unknown[]): StoredEvent {
  const [id, schema_version, event, session_id, initiative_id, product_id, phase, agent, tool, model,
    mcp_mode, timestamp, modelConfigRaw, dataRaw, inserted_at] = row as (string | null)[];

  return {
    id: id ?? '',
    schema_version: (schema_version ?? '1.0') as '1.0',
    event: (event ?? '') as StoredEvent['event'],
    session_id: session_id ?? '',
    initiative_id: initiative_id ?? undefined,
    product_id: product_id ?? undefined,
    phase: (phase ?? '') as StoredEvent['phase'],
    agent: agent ?? '',
    tool: tool ?? '',
    model: model ?? '',
    mcp_mode: (mcp_mode ?? 'none') as StoredEvent['mcp_mode'],
    timestamp: timestamp ?? '',
    model_config: modelConfigRaw ? JSON.parse(modelConfigRaw) : undefined,
    data: dataRaw ? JSON.parse(dataRaw) : undefined,
    inserted_at: inserted_at ?? '',
  };
}
