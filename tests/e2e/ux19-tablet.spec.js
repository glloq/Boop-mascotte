import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

const layout = (page) => page.evaluate(() => window.__BOOP_E2E__.layout());
const box = (locator) => locator.boundingBox();

test('@critical tablet: drawer and one bottom sheet keep the canvas dominant and never stack', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-layout', 'tablet');
  await expect(app).toHaveAttribute('data-sheet', 'collapsed');
  expect(await layout(page)).toEqual({ layout: 'tablet', drawerOpen: false, sheet: 'collapsed' });
  const canvas = await box(page.locator('#canvas'));
  expect(canvas.width).toBeGreaterThanOrEqual(768 * .9);
  expect((await box(page.locator('#left'))).x).toBeLessThan(0);

  const toggle = page.locator('#drawer-toggle');
  expect((await box(toggle)).height).toBeGreaterThanOrEqual(44);
  expect((await box(page.locator('[data-task="face-setup"]'))).height).toBeGreaterThanOrEqual(44);
  await toggle.click();
  await expect(app).toHaveClass(/drawer-open/);
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(async () => (await box(page.locator('#left'))).x).toBeGreaterThanOrEqual(0);
  await page.locator('[data-task="face-setup"]').click();
  await expect(page.locator('#face-setup-checklist[data-face-setup-ready="true"]')).toBeVisible();
  await page.locator('#drawer-scrim').click();
  await expect(app).not.toHaveClass(/drawer-open/);

  await page.locator('[data-sheet-detent="half"]').click();
  await expect(app).toHaveAttribute('data-sheet', 'half');
  await expect.poll(async () => (await box(page.locator('.panel-right'))).height).toBeGreaterThan(300);
  expect((await box(page.locator('.panel-right'))).height).toBeLessThan(700);
  await page.locator('[data-sheet-detent="full"]').click();
  await expect(app).toHaveAttribute('data-sheet', 'full');
  await expect.poll(async () => (await box(page.locator('.panel-right'))).height).toBeGreaterThan(700);
  await toggle.click();
  await expect(app).toHaveClass(/drawer-open/);
  await expect(app).toHaveAttribute('data-sheet', 'collapsed');
  await page.keyboard.press('Escape');
  await expect(app).not.toHaveClass(/drawer-open/);
  await page.locator('[data-sheet-detent="half"]').click();
  await page.keyboard.press('Escape');
  await expect(app).toHaveAttribute('data-sheet', 'collapsed');

  // Selecting something reveals the Inspector sheet and closes the drawer.
  await toggle.click();
  await page.locator('[data-face-role-select="head"]').click();
  await expect(app).not.toHaveClass(/drawer-open/);
  await expect(app).toHaveAttribute('data-sheet', 'half');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'semantic-part');
  await expect(page.locator('[data-sheet-subject]')).toContainText('Face Part Inspector');
  await expect(page.locator('#rig-panel')).toBeVisible();
});

test('mobile: preview opens its sheet with touch-sized controls and tasks stay reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const app = page.locator('#app');
  await expect(app).toHaveAttribute('data-layout', 'mobile');
  for (const task of ['artwork', 'face-setup', 'expressions', 'animate', 'reactions', 'preview']) await expect(page.locator(`[data-task="${task}"]`)).toBeVisible();
  await page.locator('[data-task="preview"]').click();
  await expect(app).toHaveAttribute('data-sheet', 'half');
  await expect(page.locator('#preview-panel')).toBeVisible();
  const reset = page.getByRole('button', { name: 'Reset mascot' });
  await expect(reset).toBeVisible();
  expect((await box(reset)).height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('[data-sheet-subject]')).toContainText('Preview');
  await page.locator('[data-sheet-detent="collapsed"]').click();
  await expect(app).toHaveAttribute('data-sheet', 'collapsed');
  await expect.poll(async () => (await box(page.locator('#canvas'))).height).toBeGreaterThan(400);
  await expect(page.getByRole('button', { name: 'Save Project' })).toBeVisible();
});
