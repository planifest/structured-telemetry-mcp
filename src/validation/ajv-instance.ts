/**
 * AJV 8 interop module.
 *
 * AJV 8 uses `export =` which is incompatible with NodeNext ESM default imports.
 * All interop is isolated here so the rest of the codebase imports a clean interface.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface ValidateFunction {
  (data: unknown): boolean;
  errors: Array<{ instancePath: string; message?: string; [key: string]: unknown }> | null;
}

interface AjvConstructor {
  new(opts: { allErrors: boolean }): { compile(schema: object): ValidateFunction };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Ajv2020 = require('ajv/dist/2020') as unknown as AjvConstructor;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const addFormats = require('ajv-formats') as (ajv: unknown) => void;

export const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
