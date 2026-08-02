/**
 * req-002-ui-e2e-suite: Chromium-driven coverage for GET /ui (ADR-023) —
 * load/render, filters + URL-state, pagination, zero-result state, detail
 * view with no new network request. Real server-http.ts + ephemeral DuckDB
 * per file (ADR-022), seeded via real POST /emit calls (fixtures.ts).
 */
import { test, expect } from '@playwright/test';
import { startServer, type ServerHandle } from '../support/server-harness.js';
import { buildEnvelope, buildFixtureSet, seedFixtures } from '../support/fixtures.js';

let server: ServerHandle;

test.beforeAll(async () => {
  server = await startServer();
  await seedFixtures(server.baseURL, buildFixtureSet());
});

test.afterAll(async () => {
  await server.stop();
});

test('req-002-ui-e2e-suite: GET /ui loads and renders the event table', async ({ page }) => {
  await page.goto(`${server.baseURL}/ui`);
  await expect(page.locator('#events-table')).toBeVisible();
  const rows = page.locator('#events-body tr.event-row');
  await expect(rows.first()).toBeVisible();
  expect(await rows.count()).toBeGreaterThan(0);
});

test('req-002-ui-e2e-suite: phase filter narrows results and updates URL state', async ({ page }) => {
  await page.goto(`${server.baseURL}/ui`);
  await page.fill('#f-phase', 'codegen');
  await page.click('form#filters button[type="submit"]');
  await expect(page).toHaveURL(/phase=codegen/);

  const rows = page.locator('#events-body tr.event-row');
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText('codegen');
  }
});

test('req-002-ui-e2e-suite: agent filter narrows results and updates URL state', async ({ page }) => {
  await page.goto(`${server.baseURL}/ui`);
  await page.fill('#f-agent', 'planifest-spec-agent');
  await page.click('form#filters button[type="submit"]');
  await expect(page).toHaveURL(/agent=planifest-spec-agent/);

  const rows = page.locator('#events-body tr.event-row');
  await expect(rows.first()).toBeVisible();
});

test('req-002-ui-e2e-suite: product_id filter narrows results and updates URL state', async ({ page }) => {
  await page.goto(`${server.baseURL}/ui`);
  await page.fill('#f-product_id', '/repo/product-a');
  await page.click('form#filters button[type="submit"]');
  await expect(page).toHaveURL(/product_id=/);

  const rows = page.locator('#events-body tr.event-row');
  await expect(rows.first()).toBeVisible();
});

test('req-002-ui-e2e-suite: date range filter narrows results and updates URL state', async ({ page }) => {
  await page.goto(`${server.baseURL}/ui`);
  await page.fill('#f-from', '2026-08-01T09:00');
  await page.fill('#f-to', '2026-08-01T11:00');
  await page.click('form#filters button[type="submit"]');
  await expect(page).toHaveURL(/from=/);
  await expect(page).toHaveURL(/to=/);
  await expect(page.locator('#events-table')).toBeVisible();
});

test('req-002-ui-e2e-suite: pagination controls move between pages', async ({ page }) => {
  await page.goto(`${server.baseURL}/ui`);
  await page.selectOption('#pageSize', '10');
  await page.waitForSelector('#page-label');
  await expect(page.locator('#page-label')).toContainText('Page 1');

  await page.click('#next');
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('#page-label')).toContainText('Page 2');

  await page.click('#prev');
  await expect(page).toHaveURL(/page=1/);
  await expect(page.locator('#page-label')).toContainText('Page 1');
});

test('req-002-ui-e2e-suite: zero-result state renders when a filter matches nothing', async ({ page }) => {
  await page.goto(`${server.baseURL}/ui`);
  await page.fill('#f-phase', 'nonexistent-phase-xyz');
  await page.click('form#filters button[type="submit"]');

  await expect(page.locator('#status')).toContainText('No matching events');
  await expect(page.locator('#events-table')).toBeHidden();
});

test('req-003-ui-e2e-suite: clicking a column header sorts the table and updates the URL, in sync with the dropdown', async ({ page }) => {
  await page.goto(`${server.baseURL}/ui`);
  await expect(page.locator('#events-table')).toBeVisible();

  await page.click('th.th-sort[data-field="agent"]');
  await expect(page).toHaveURL(/sortField=agent/);
  await expect(page).toHaveURL(/sort=asc/);
  await expect(page.locator('#sort')).toHaveValue('agent:asc');
  await expect(page.locator('th.th-sort[data-field="agent"]')).toContainText('▲');

  // Clicking the same header again toggles direction.
  await page.click('th.th-sort[data-field="agent"]');
  await expect(page).toHaveURL(/sort=desc/);
  await expect(page.locator('#sort')).toHaveValue('agent:desc');
  await expect(page.locator('th.th-sort[data-field="agent"]')).toContainText('▼');
});

test('req-003-ui-e2e-suite: changing the sort dropdown updates the active header glyph, in sync with headers', async ({ page }) => {
  await page.goto(`${server.baseURL}/ui`);
  await expect(page.locator('#events-table')).toBeVisible();

  await page.selectOption('#sort', 'phase:asc');
  await expect(page).toHaveURL(/sortField=phase/);
  await expect(page.locator('th.th-sort[data-field="phase"]')).toContainText('▲');
  await expect(page.locator('th.th-sort[data-field="timestamp"]')).not.toContainText('▲');
  await expect(page.locator('th.th-sort[data-field="timestamp"]')).not.toContainText('▼');
});

test('req-003-ui-e2e-suite: loading a URL with sortField/sort params renders sorted, with header and dropdown pre-synced', async ({ page }) => {
  await page.goto(`${server.baseURL}/ui?sortField=agent&sort=asc`);
  await expect(page.locator('#events-table')).toBeVisible();
  await expect(page.locator('#sort')).toHaveValue('agent:asc');
  await expect(page.locator('th.th-sort[data-field="agent"]')).toContainText('▲');
});

test('req-002-ui-e2e-suite: focusing a filter field populates its datalist with suggested values', async ({ page }) => {
  await page.goto(`${server.baseURL}/ui`);
  await page.locator('#f-agent').click();
  await expect(async () => {
    const options = await page.locator('#dl-agent option').count();
    expect(options).toBeGreaterThan(0);
  }).toPass({ timeout: 5000 });
  const values = await page.locator('#dl-agent option').evaluateAll((els) => els.map((el) => (el as HTMLOptionElement).value));
  expect(values).toContain('planifest-spec-agent');
});

test('req-001-ui-e2e-suite: toggling auto-refresh updates the URL and picks up a newly-emitted event without a manual reload', async ({ page }) => {
  await page.goto(`${server.baseURL}/ui`);
  await page.fill('#f-session_id', 'e2e-auto-refresh-target');
  await page.click('form#filters button[type="submit"]');
  await expect(page.locator('#status')).toContainText('No matching events.');

  await page.check('#auto-refresh');
  await expect(page).toHaveURL(/autoRefresh=1/);

  await seedFixtures(server.baseURL, [
    buildEnvelope({ session_id: 'e2e-auto-refresh-target', timestamp: '2026-08-01T20:00:00Z' }),
  ]);

  await expect(page.locator('#events-table')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('#events-body tr.event-row')).toHaveCount(1);

  await page.uncheck('#auto-refresh');
  await expect(page).not.toHaveURL(/autoRefresh=1/);
});

test('req-002-ui-e2e-suite: clicking a row expands JSON detail with no new network request', async ({ page }) => {
  await page.goto(`${server.baseURL}/ui`);
  const firstRow = page.locator('#events-body tr.event-row').first();
  await expect(firstRow).toBeVisible();

  let requestFired = false;
  page.on('request', (req) => {
    if (req.url().includes('/query') || req.url().includes('/emit')) {
      requestFired = true;
    }
  });

  await firstRow.click();

  const detailRow = firstRow.locator('xpath=following-sibling::tr[1]');
  await expect(detailRow).toBeVisible();
  await expect(detailRow.locator('pre')).toContainText('"session_id"');

  // Give any accidental network activity a moment to fire before asserting none did.
  await page.waitForTimeout(250);
  expect(requestFired).toBe(false);
});
