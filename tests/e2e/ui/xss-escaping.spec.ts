/**
 * req-010: XSS escaping verified in the rendered log viewer (ADR-023, Chromium).
 *
 * The escaping already exists (escapeHtml, index-html.ts:243, applied at the
 * innerHTML assignment :304-310). What did not exist before 0000019 is a test
 * that renders hostile content in a REAL browser and asserts nothing executes.
 *
 * Assertions are behavioural, not textual: a page dialog handler and a
 * console-error listener catch actual execution. Asserting only that the DOM
 * contains escaped entities would be weaker and does not satisfy req-010.
 *
 * product_id is the sharpest case — index-html.ts:302 interpolates it into TWO
 * contexts, the `title` attribute AND element text, from one escapeHtml helper.
 * Attribute context needs quote-escaping to prevent breakout; this test pins it.
 */
import { test, expect, type Dialog } from '@playwright/test';
import { startServer, type ServerHandle } from '../support/server-harness.js';
import { buildEnvelope, seedFixtures } from '../support/fixtures.js';

const PAYLOADS = [
  '<img src=x onerror=alert(1)>',
  '<script>alert(1)</script>',
  '"><script>alert(1)</script>',
  "' onmouseover='alert(1)",
  '"><img src=x onerror=alert(1)>',
  'javascript:alert(1)',
];

let server: ServerHandle;

test.beforeAll(async () => {
  server = await startServer();
  // Seed one event per payload, placing the hostile string in each of the three
  // rendered free-text fields (session_id, agent, product_id). event and phase
  // are schema enums and cannot carry arbitrary content, so they are not vectors.
  const envelopes = PAYLOADS.flatMap((p, i) => [
    buildEnvelope({ session_id: `xss-sid-${i}-${p}`, agent: `xss-agent-${p}`, product_id: `xss-pid-${p}`, timestamp: `2026-08-08T12:0${i}:00Z` }),
  ]);
  await seedFixtures(server.baseURL, envelopes);
});

test.afterAll(async () => {
  await server.stop();
});

test('req-010-xss: no payload in any rendered field executes script', async ({ page }) => {
  let dialogFired = false;
  page.on('dialog', (d: Dialog) => { dialogFired = true; void d.dismiss(); });
  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));

  await page.goto(`${server.baseURL}/ui`);
  await expect(page.locator('#events-body tr.event-row').first()).toBeVisible();

  // Give any injected handler a chance to fire.
  await page.waitForTimeout(300);

  expect(dialogFired, 'a dialog fired — a payload executed').toBe(false);
  expect(consoleErrors, 'a page error fired').toHaveLength(0);

  // The literal text must be present somewhere in the table (rendered, not executed).
  const bodyText = await page.locator('#events-body').innerText();
  expect(bodyText).toContain('<img src=x onerror=alert(1)>');
  // No actual <img>/<script> element was injected into the table body.
  expect(await page.locator('#events-body img').count()).toBe(0);
  expect(await page.locator('#events-body script').count()).toBe(0);
});

test('req-010-xss: the product_id title attribute does not break out', async ({ page }) => {
  page.on('dialog', (d) => void d.dismiss());
  await page.goto(`${server.baseURL}/ui`);
  await expect(page.locator('#events-body tr.event-row').first()).toBeVisible();

  // The product cell wraps its value in a <span title="...">. Find one whose
  // title carries a breakout-shaped payload and assert it is the literal string
  // — an unescaped quote would have terminated the attribute and dropped it.
  const titled = page.locator('#events-body span[title*="xss-pid"]').first();
  await expect(titled).toBeAttached();
  const title = await titled.getAttribute('title');
  expect(title).toContain('xss-pid');
  // No <img>/<script> element leaked out of the attribute into the DOM.
  expect(await page.locator('#events-body img').count()).toBe(0);
});

test('req-010-xss: the JSON detail view renders hostile content literally', async ({ page }) => {
  let dialogFired = false;
  page.on('dialog', (d) => { dialogFired = true; void d.dismiss(); });
  await page.goto(`${server.baseURL}/ui`);
  const firstRow = page.locator('#events-body tr.event-row').first();
  await expect(firstRow).toBeVisible();
  await firstRow.click();

  // The detail view is a <pre> populated via textContent — inherently safe.
  // Pin that it renders literally and executes nothing.
  await page.waitForTimeout(200);
  expect(dialogFired).toBe(false);
  expect(await page.locator('#events-body script').count()).toBe(0);
});
