/**
 * E2E suites (req-001, req-002; ADR-020, ADR-022, ADR-023). Two independent
 * projects: `backend` (HTTP-only, no browser) and `ui` (Chromium-only, per
 * ADR-023). Each spec file starts its own ephemeral server-http.ts instance
 * via tests/e2e/support/server-harness.ts — no shared `webServer` config.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['html', { open: 'never' }], ['list']] : 'list',
  projects: [
    {
      name: 'backend',
      testDir: 'tests/e2e/backend',
    },
    {
      name: 'ui',
      testDir: 'tests/e2e/ui',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
