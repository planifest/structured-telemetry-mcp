#!/usr/bin/env node
/**
 * postinstall — prints setup instructions after npm install.
 * Does not block installation on error.
 */

try {
  console.log('');
  console.log('  structured-telemetry-mcp installed.');
  console.log('');
  console.log('  Next steps:');
  console.log('    npx structured-telemetry-mcp setup   — register with your agent tool');
  console.log('    npx structured-telemetry-mcp doctor  — verify the installation');
  console.log('');
  console.log('  Docs: https://github.com/planifest/structured-telemetry-mcp');
  console.log('');
} catch {
  // Best effort — never block npm install.
}
