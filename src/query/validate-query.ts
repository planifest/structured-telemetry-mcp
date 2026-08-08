/**
 * req-005: the single shared query validation gate.
 *
 * Both the HTTP `/query` path (src/server-http.ts) and the MCP query_telemetry
 * path (src/server-factory.ts) call this before dispatch, so the two paths can
 * no longer disagree on what a valid query is — the defect this closes.
 *
 * Design notes that are load-bearing, not decoration:
 *
 *  - Rejection is a positive type/range test, never a failed comparison.
 *    `NaN > 1000` evaluates to `false`, which is precisely how the pre-existing
 *    cap in event-log.ts was bypassed (a string `limit` coerced to NaN slipped
 *    through). Here a value must positively BE a number and an integer within
 *    range; anything else is rejected.
 *
 *  - The ceiling is per-mode. There is no single global `MAX_LIMIT`: event_log
 *    caps at 1000, distinct_values at 20, and `trend`'s `limit` is a DAY count
 *    (not a row count) capped at 365. A single global ceiling would let
 *    `{"mode":"distinct_values","limit":500}` through the gate only to be
 *    reduced downstream — the exact class of silent-mismatch defect req-005
 *    exists to remove. This table is the single source of truth for those
 *    ceilings (ADR-016 precedent).
 *
 *  - Exceeding a ceiling REJECTS; it never clamps. event_log already rejected
 *    (event-log.ts:40 throws); distinct_values previously clamped silently and
 *    is changed to reject here — a deliberate, disclosed behaviour change
 *    (req-005, risk-register R-018).
 */

/** A field-level validation error, safe to return to a caller — names the field, quotes no value. */
export interface QueryFieldError {
  readonly field: string;
  readonly message: string;
}

export type QueryValidationResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly errors: QueryFieldError[] };

/**
 * Per-mode ceiling for the `limit` field. For every mode except `trend` this is
 * a row-count ceiling; for `trend` it is a DAY-count ceiling, because
 * `token-efficiency.ts` reinterprets the top-level `limit` as a number of days
 * (there is no separate `trend.limit` field). Modes not listed here — the
 * bottleneck family, retry_summary, loop_candidates, etc. — use `_default`.
 */
export const QUERY_LIMIT_CEILINGS = {
  event_log: 1000,
  distinct_values: 20,
  failure_sequence: 1000,
  drill_down: 1000,
  trend: 365,
  _default: 1000,
} as const;

/** Offset ceiling. A million rows deep into a local single-user telemetry store is already absurd; this only needs to reject pathological values like 1e21 while accepting any realistic pagination. */
const OFFSET_CEILING = 1_000_000;

/** Loop-threshold ceiling. Consecutive-repeat detection over a run; a generous upper bound. */
const LOOP_THRESHOLD_CEILING = 1000;

function ceilingForMode(mode: unknown): number {
  if (typeof mode === 'string' && mode in QUERY_LIMIT_CEILINGS) {
    return QUERY_LIMIT_CEILINGS[mode as keyof typeof QUERY_LIMIT_CEILINGS];
  }
  return QUERY_LIMIT_CEILINGS._default;
}

/** True only when `value` positively is a number and an integer within [min, max]. NaN, strings, floats, and out-of-range all return false. */
function isIntegerInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Validates the numeric fields of a raw query object against the per-mode
 * ceiling table. Returns every field that failed, so a caller sees all the
 * problems at once rather than one at a time. Non-numeric fields (session_id,
 * group_by, sortField, field) are validated elsewhere — sortField/field by the
 * ADR-024 allow-list (req-009), the rest by dispatchQuery's own shape checks.
 */
export function validateQuery(q: Record<string, unknown>): QueryValidationResult {
  const errors: QueryFieldError[] = [];
  const mode = q['mode'];

  if ('limit' in q && q['limit'] !== undefined) {
    const ceiling = ceilingForMode(mode);
    if (!isIntegerInRange(q['limit'], 1, ceiling)) {
      const unit = mode === 'trend' ? 'days' : 'rows';
      errors.push({
        field: 'limit',
        message: `must be an integer between 1 and ${ceiling} (${unit}) for this query mode`,
      });
    }
  }

  if ('offset' in q && q['offset'] !== undefined) {
    if (!isIntegerInRange(q['offset'], 0, OFFSET_CEILING)) {
      errors.push({
        field: 'offset',
        message: `must be an integer between 0 and ${OFFSET_CEILING}`,
      });
    }
  }

  if ('loop_threshold' in q && q['loop_threshold'] !== undefined) {
    if (!isIntegerInRange(q['loop_threshold'], 1, LOOP_THRESHOLD_CEILING)) {
      errors.push({
        field: 'loop_threshold',
        message: `must be an integer between 1 and ${LOOP_THRESHOLD_CEILING}`,
      });
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
