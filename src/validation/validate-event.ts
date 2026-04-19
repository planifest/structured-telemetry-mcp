import { ajv, type ValidateFunction } from './ajv-instance.js';
import type { TelemetryEvent } from '../types/events.js';
import schema from '../../schemas/telemetry-event.schema.json' with { type: 'json' };

const validateSchema: ValidateFunction = ajv.compile(schema as object);

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

/**
 * Maps each event type to the data fields it requires.
 * JSON Schema oneOf validates data structure but cannot discriminate by event type —
 * this map enforces the cross-field constraint in TypeScript.
 */
const EVENT_REQUIRED_DATA_FIELDS: Record<string, readonly string[]> = {
  phase_start:          ['phase_name'],
  phase_end:            ['phase_name', 'status', 'duration_ms'],
  spec_gap:             ['question', 'phase_name'],
  validation_failure:   ['failure_type', 'phase_name', 'attempt_number', 'action_id'],
  deviation:            ['component_id', 'description', 'severity'],
  migration_proposal:   ['component_id', 'proposal_path', 'destructive'],
  context_pressure:     ['context_fill_pct', 'unused_sources', 'trigger'],
  mcp_impact:           ['mcp_mode', 'avg_token_delta', 'peak_fill_pct'],
  self_correction:      ['phase_name', 'attempt_number', 'action_id', 'correction_type'],
  phase_skip:           ['phase_name', 'reason'],
  security_finding:     ['component_id', 'title', 'severity'],
  retry_limit_exceeded: ['phase_name', 'action_id', 'attempt_count'],
  adr_decision:         ['adr_id', 'title', 'chosen_option'],
  doc_gap:              ['component_id', 'description'],
  context_reset:           ['phase_name', 'reason'],
  approval_requested:      ['phase_name', 'subject', 'action_id'],
  fast_path_engaged:       ['change_type', 'reason'],
  test_failure:            ['test_name', 'phase_name', 'attempt_number'],
  performance_regression:  ['metric', 'threshold', 'actual', 'phase_name'],
  dependency_blocked:      ['phase_name', 'dependency', 'reason'],
  schema_migration_applied: ['component_id', 'migration_path', 'destructive'],
};

function validateEventDataFields(event: unknown): string | null {
  if (typeof event !== 'object' || event === null) return null;
  const ev = event as Record<string, unknown>;
  const eventType = ev['event'];
  if (typeof eventType !== 'string') return null;

  const required = EVENT_REQUIRED_DATA_FIELDS[eventType];
  if (required === undefined) return null;

  const data = ev['data'];
  if (data === undefined || data === null) return null; // missing data caught by schema

  if (typeof data !== 'object') return `/data: must be an object`;

  const dataObj = data as Record<string, unknown>;
  for (const field of required) {
    if (!(field in dataObj)) {
      return `/data: event '${eventType}' requires field '${field}'`;
    }
  }
  return null;
}

/**
 * Validates a telemetry event envelope against the JSON Schema, then applies
 * cross-field validation to ensure data fields match the declared event type.
 * Returns a structured result — never throws.
 */
export function validateEvent(event: unknown): ValidationResult {
  const isValid = validateSchema(event);

  if (!isValid) {
    const errors = (validateSchema.errors ?? []).map((err) => {
      const path = err.instancePath !== '' ? err.instancePath : '(root)';
      return `${path}: ${err.message ?? 'unknown error'}`;
    });
    return { isValid: false, errors };
  }

  // Cross-field check: ensure data fields match the event type.
  const crossFieldError = validateEventDataFields(event);
  if (crossFieldError !== null) {
    return { isValid: false, errors: [crossFieldError] };
  }

  return { isValid: true, errors: [] };
}

export type { TelemetryEvent };
