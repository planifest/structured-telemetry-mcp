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

  // req-009: the two tests that stood here (":34-38" / ":40-44" pre-0000019)
  // asserted that every entry of a `readonly AllowedEventColumnKey[]` resolves
  // in ALLOWED_EVENT_COLUMNS — true by construction of the type, so they could
  // not fail. Replaced with tests that CAN fail: the allow-lists must exclude
  // injection-shaped and prototype-pollution keys. (The membership tests above,
  // "is exactly the 6", are real coverage and are kept.)

  const HOSTILE_KEYS = ["'", '"', ';', '--', '/* */', 'UNION SELECT', '`', 'constructor', '__proto__', 'prototype', 'not_a_real_field'];

  it('SORTABLE_FIELDS excludes every injection-shaped and prototype key', () => {
    for (const bad of HOSTILE_KEYS) {
      expect((SORTABLE_FIELDS as readonly string[]).includes(bad), `SORTABLE_FIELDS must not contain ${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it('SUGGESTIBLE_FIELDS excludes every injection-shaped and prototype key', () => {
    for (const bad of HOSTILE_KEYS) {
      expect((SUGGESTIBLE_FIELDS as readonly string[]).includes(bad), `SUGGESTIBLE_FIELDS must not contain ${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it('the allow-list lookup is guarded by array membership, so a prototype key never reaches the object index', () => {
    // ALLOWED_EVENT_COLUMNS['constructor'] would return the inherited Object
    // constructor (truthy) under a bare lookup — but the query builders gate on
    // SORTABLE_FIELDS.includes()/SUGGESTIBLE_FIELDS.includes() FIRST, and neither
    // array contains 'constructor', so the object index is never reached for it.
    expect((SORTABLE_FIELDS as readonly string[]).includes('constructor')).toBe(false);
    expect((SUGGESTIBLE_FIELDS as readonly string[]).includes('__proto__')).toBe(false);
  });
});
