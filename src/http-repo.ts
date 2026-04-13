/**
 * HTTP implementation of IEventRepository.
 * Forwards all calls to the backend REST service — no DuckDB dependency.
 */

import type { TelemetryEvent, StoredEvent } from './types/events.js';
import type { IEventRepository, WriteResult, WriteError } from './db/repository.js';

export class HttpEventRepository implements IEventRepository {
  constructor(private readonly baseUrl: string) {}

  async write(event: TelemetryEvent): Promise<WriteResult | WriteError> {
    try {
      const res = await fetch(`${this.baseUrl}/emit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });
      return res.json() as Promise<WriteResult | WriteError>;
    } catch (err) {
      return { ok: false, errors: [`backend unreachable: ${err}`] };
    }
  }

  async findById(_id: string): Promise<StoredEvent | null> {
    return null; // not used by MCP tools
  }
}
