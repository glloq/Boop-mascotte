import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

test('@critical first run offers safe project entry', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  const before = await page.evaluate(() => ({ document: window.__BOOP_E2E__.document(), revisions: window.__BOOP_E2E__.documentRevisions(), history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty() }));
  await expect(page.locator('[data-home]')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'New Mascot' })).toBeVisible();
  await expect(page.locator('[data-home]').getByRole('heading', { name: 'Open Project' })).toBeVisible();
  await expect(page.locator('[data-home] label').filter({ hasText: 'Import SVG' })).toBeVisible();
  await expect(page.locator('[data-home]').getByText('Artwork only', { exact: true })).toBeVisible();
  const after = await page.evaluate(() => ({ document: window.__BOOP_E2E__.document(), revisions: window.__BOOP_E2E__.documentRevisions(), history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty() }));
  expect(after).toEqual(before);
});

test('@critical user can import SVG artwork from fresh Home', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('#home-svg-file').setInputFiles('tests/e2e/fixtures/product-head.svg');
  await expect(page.locator('[data-home]')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.task())).toBe('artwork');
  await expect(page.locator('#canvas svg svg #journeyHead')).toBeVisible();
  const document = await page.evaluate(() => window.__BOOP_E2E__.document());
  expect(document.svgMarkup).toContain('journeyHead');
  expect(document.semanticParts).toEqual({});
});

test('@critical invalid Home SVG import preserves the blank project and Home', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  const checkpoint=()=>page.evaluate(()=>({document:window.__BOOP_E2E__.document(),token:window.__BOOP_E2E__.documentVersionToken(),revisions:window.__BOOP_E2E__.documentRevisions(),history:window.__BOOP_E2E__.history(),dirty:window.__BOOP_E2E__.dirty()}));
  const before=await checkpoint();
  await page.locator('#home-svg-file').setInputFiles({name:'invalid.svg',mimeType:'image/svg+xml',buffer:Buffer.from('not an svg')});
  await expect(page.locator('[data-home]')).toBeVisible();
  await expect(page.locator('#toast')).toHaveAttribute('data-tone','error');
  await expect(page.locator('#toast')).toContainText('Invalid or unsupported SVG');
  expect(await checkpoint()).toEqual(before);
  await expect(page.locator('#canvas svg svg')).toHaveCount(0);
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
