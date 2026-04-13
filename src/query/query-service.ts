/**
 * IQueryService — abstraction over all three query families.
 * DuckDbQueryService is the concrete implementation; mock implementations
 * can be injected in tests without touching the database.
 */

import type { DuckDBInstance } from '@duckdb/node-api';
import { queryBottlenecks, type BottleneckQuery } from './bottlenecks.js';
import { queryFailures, type FailureQuery } from './failures.js';
import { queryTokenEfficiency, type TokenEfficiencyQuery } from './token-efficiency.js';
import type { QueryResponse } from './format-results.js';

export type { BottleneckQuery, FailureQuery, TokenEfficiencyQuery, QueryResponse };

export interface IQueryService {
  bottlenecks(query: BottleneckQuery): Promise<QueryResponse>;
  failures(query: FailureQuery): Promise<QueryResponse>;
  tokenEfficiency(query: TokenEfficiencyQuery): Promise<QueryResponse>;
}

export class DuckDbQueryService implements IQueryService {
  constructor(private readonly db: DuckDBInstance) {}

  bottlenecks(query: BottleneckQuery): Promise<QueryResponse> {
    return queryBottlenecks(this.db, query);
  }

  failures(query: FailureQuery): Promise<QueryResponse> {
    return queryFailures(this.db, query);
  }

  tokenEfficiency(query: TokenEfficiencyQuery): Promise<QueryResponse> {
    return queryTokenEfficiency(this.db, query);
  }
}
