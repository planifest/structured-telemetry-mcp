import { ajv, type ValidateFunction } from './ajv-instance.js';
import type { TelemetryEvent } from '../types/events.js';
import schema from '../../schemas/telemetry-event.schema.json' with { type: 'json' };

const validateSchema: ValidateFunction = ajv.compile(schema as object);

export interface ValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly string[];
}

/**
 * Validates a telemetry event envelope against the JSON Schema.
 * Returns a structured result — never throws.
 */
export function validateEvent(event: unknown): ValidationResult {
  const isValid = validateSchema(event);

  if (isValid) {
    return { isValid: true, errors: [] };
  }

  const errors = (validateSchema.errors ?? []).map((err) => {
    const path = err.instancePath !== '' ? err.instancePath : '(root)';
    return `${path}: ${err.message ?? 'unknown error'}`;
  });

  return { isValid: false, errors };
}

export type { TelemetryEvent };
