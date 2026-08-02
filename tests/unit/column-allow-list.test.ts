/**
 * ADR-024: shared column allow-list — the single SQL-injection-via-identifier
 * defense for both event_log's sortField (req-003) and distinct_values'
 * field (req-002).
 */

import { describe, it, expect } from 'vitest';
import { ALLOWED_EVENT_COLUMNS, SORTABLE_FIELDS, SUGGESTIBLE_FIELDS } from '../../src/query/column-allow-list.js';

describe('ADR-024: column allow-list', () => {
  it('maps every key to a real events column name, identity except event_type -> event', () => {
    expect(ALLOWED_EVENT_COLUMNS['event_type']).toBeUndefined();
    expect(ALLOWED_EVENT_COLUMNS['event']).toBe('event');
    expect(ALLOWED_EVENT_COLUMNS['session_id']).toBe('session_id');
    expect(ALLOWED_EVENT_COLUMNS['initiative_id']).toBe('initiative_id');
    expect(ALLOWED_EVENT_COLUMNS['phase']).toBe('phase');
    expect(ALLOWED_EVENT_COLUMNS['agent']).toBe('agent');
    expect(ALLOWED_EVENT_COLUMNS['product_id']).toBe('product_id');
    expect(ALLOWED_EVENT_COLUMNS['timestamp']).toBe('timestamp');
  });

  it('SORTABLE_FIELDS is exactly the 6 table-displayed columns', () => {
    expect([...SORTABLE_FIELDS].sort()).toEqual(
      ['agent', 'event', 'phase', 'product_id', 'session_id', 'timestamp'].sort(),
    );
  });

  it('SUGGESTIBLE_FIELDS is exactly the 6 filterable form fields (as column names)', () => {
    expect([...SUGGESTIBLE_FIELDS].sort()).toEqual(
      ['agent', 'event', 'initiative_id', 'phase', 'product_id', 'session_id'].sort(),
    );
  });

  it('every SORTABLE_FIELDS entry resolves via ALLOWED_EVENT_COLUMNS', () => {
    for (const field of SORTABLE_FIELDS) {
      expect(ALLOWED_EVENT_COLUMNS[field]).toBeDefined();
    }
  });

  it('every SUGGESTIBLE_FIELDS entry resolves via ALLOWED_EVENT_COLUMNS', () => {
    for (const field of SUGGESTIBLE_FIELDS) {
      expect(ALLOWED_EVENT_COLUMNS[field]).toBeDefined();
    }
  });
});
