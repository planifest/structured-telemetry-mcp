/**
 * IQueryService — abstraction over all three query families.
 * DuckDbQueryService is the concrete implementation; mock implementations
 * can be injected in tests without touching the database.
 */

import type { DuckDBInstance } from '@duckdb/node-api';
import { queryBottlenecks, type BottleneckQuery } from './bottlenecks.js';
import { queryFailures, type FailureQuery } from './failures.js';
import { queryTokenEfficiency, type TokenEfficiencyQuery } from './token-efficiency.js';
import { queryEventLog, type EventLogQuery } from './event-log.js';
import { queryDistinctValues, type DistinctValuesQuery } from './distinct-values.js';
import type { QueryResponse } from './format-results.js';

export type { BottleneckQuery, FailureQuery, TokenEfficiencyQuery, EventLogQuery, DistinctValuesQuery, QueryResponse };

export interface IQueryService {
  bottlenecks(query: BottleneckQuery): Promise<QueryResponse>;
  failures(query: FailureQuery): Promise<QueryResponse>;
  tokenEfficiency(query: TokenEfficiencyQuery): Promise<QueryResponse>;
  eventLog(query: EventLogQuery): Promise<QueryResponse>;
  distinctValues(query: DistinctValuesQuery): Promise<QueryResponse>;
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

  eventLog(query: EventLogQuery): Promise<QueryResponse> {
    return queryEventLog(this.db, query);
  }

  distinctValues(query: DistinctValuesQuery): Promise<QueryResponse> {
    return queryDistinctValues(this.db, query);
  }
}
