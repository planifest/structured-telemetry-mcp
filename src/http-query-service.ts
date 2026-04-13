/**
 * HTTP implementation of IQueryService.
 * Forwards all calls to the backend REST service — no DuckDB dependency.
 */

import type {
  IQueryService,
  BottleneckQuery,
  FailureQuery,
  TokenEfficiencyQuery,
  QueryResponse,
} from './query/query-service.js';

export class HttpQueryService implements IQueryService {
  constructor(private readonly baseUrl: string) {}

  bottlenecks(query: BottleneckQuery): Promise<QueryResponse> {
    return this.post(query);
  }

  failures(query: FailureQuery): Promise<QueryResponse> {
    return this.post(query);
  }

  tokenEfficiency(query: TokenEfficiencyQuery): Promise<QueryResponse> {
    return this.post(query);
  }

  private async post(body: unknown): Promise<QueryResponse> {
    const res = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`backend query failed: ${res.status}`);
    return res.json() as Promise<QueryResponse>;
  }
}
