/**
 * IEventRepository — abstraction over telemetry event persistence.
 * Implemented by DuckDbEventRepository; can be replaced with any in-memory or
 * mock implementation for testing without a real DuckDB instance.
 */

import type { TelemetryEvent, StoredEvent } from '../types/events.js';

export interface WriteResult {
  readonly ok: true;
  readonly id: string;
}

export interface WriteError {
  readonly ok: false;
  readonly errors: readonly string[];
}

export interface IEventRepository {
  write(event: TelemetryEvent): Promise<WriteResult | WriteError>;
  findById(id: string): Promise<StoredEvent | null>;
}
