import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

test('@critical first run offers safe project entry', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  const before = await page.evaluate(() => ({ document: window.__BOOP_E2E__.document(), revisions: window.__BOOP_E2E__.documentRevisions(), history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty() }));
  await expect(page.locator('[data-home]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New Mascot' })).toBeVisible();
  await expect(page.locator('[data-home]').getByRole('heading', { name: 'Open Project' })).toBeVisible();
  const after = await page.evaluate(() => ({ document: window.__BOOP_E2E__.document(), revisions: window.__BOOP_E2E__.documentRevisions(), history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty() }));
  expect(after).toEqual(before);
});

test('@critical user can create a new Basic Face from Home', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await expect(page.locator('[data-home]')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.task())).toBe('artwork');
  const state = await page.evaluate(() => window.__BOOP_E2E__.document());
  expect(Object.keys(state.semanticParts)).toEqual(expect.arrayContaining(['head', 'eyes', 'gaze', 'mouth']));
  expect(state.semanticParts.gaze.controls).toContain('lookX');
});

test('Home opens and returns without changing the active project', async ({ page }) => {
  await openFreshEditor(page, { e2e: true }); await startBasicFace(page);
  const before = await page.evaluate(() => ({ document: window.__BOOP_E2E__.document(), session: window.__BOOP_E2E__.session(), revisions: window.__BOOP_E2E__.documentRevisions(), history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty() }));
  await page.getByRole('button', { name: 'Home' }).click();
  await page.getByRole('button', { name: 'Back to current project' }).click();
  const after = await page.evaluate(() => ({ document: window.__BOOP_E2E__.document(), session: window.__BOOP_E2E__.session(), revisions: window.__BOOP_E2E__.documentRevisions(), history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty() }));
  expect(after).toEqual(before);
});
