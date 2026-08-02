/**
 * ADR-024: single shared source of truth for every `events` column name that
 * may be interpolated into SQL as an identifier (ORDER BY / SELECT DISTINCT).
 * DuckDB has no parameterized-identifier binding — this allow-list is the
 * only defense against SQL-injection-via-identifier for req-002 (distinct
 * values) and req-003 (sortField).
 */

export const ALLOWED_EVENT_COLUMNS = {
  timestamp: 'timestamp',
  event: 'event',
  session_id: 'session_id',
  initiative_id: 'initiative_id',
  phase: 'phase',
  agent: 'agent',
  product_id: 'product_id',
} as const;

export type AllowedEventColumnKey = keyof typeof ALLOWED_EVENT_COLUMNS;

/** The 6 columns shown in the event log table — valid `sortField` values (req-003). */
export const SORTABLE_FIELDS: readonly AllowedEventColumnKey[] =
  ['timestamp', 'event', 'session_id', 'phase', 'agent', 'product_id'];

/** The 6 filterable form fields — valid `distinct_values` field values (req-002). */
export const SUGGESTIBLE_FIELDS: readonly AllowedEventColumnKey[] =
  ['session_id', 'initiative_id', 'event', 'phase', 'agent', 'product_id'];
