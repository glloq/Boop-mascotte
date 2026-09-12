import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * Home is presets, or the mascot as it comes (V3-08, docs/V3_ROADMAP.md).
 *
 * Everything else that used to be here -- Open Project, Import SVG, Blank
 * canvas, the Face Builder -- is somewhere it belongs, and these tests hold
 * Home to the two doors it has left plus the two contracts that make the
 * narrowing safe: the ••• menu is usable while Home is open, and Home refuses
 * to close over an empty editor.
 */

test('@critical first run offers two ways to start a mascot, and changes nothing', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  const before = await page.evaluate(() => ({ document: window.__BOOP_E2E__.document(), revisions: window.__BOOP_E2E__.documentRevisions(), history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty() }));
  const home = page.locator('[data-home]');
  await expect(home).toBeVisible();
  await expect(home.getByRole('heading', { name: 'New Mascot' })).toBeVisible();
  await expect(home.locator('[data-home-action="character"]')).toBeVisible();
  await expect(home.locator('[data-template-id="basic"]')).toBeVisible();
  await expect(home.locator('[data-template-id]'), 'the preset and the mascot as it comes, and nothing else').toHaveCount(1);
  // The four that left, each gone from Home and named where they went.
  for (const selector of ['#home-svg-file', '#home-project-file', '[data-template-id="blank"]', '#face-builder']) {
    await expect(home.locator(selector), `${selector} does not belong on Home any more`).toHaveCount(0);
  }
  await expect(home.locator('.home-elsewhere')).toContainText('Open Project');
  await expect(home.locator('.home-elsewhere')).toContainText('Import SVG');
  expect(await page.evaluate(() => ({ document: window.__BOOP_E2E__.document(), revisions: window.__BOOP_E2E__.documentRevisions(), history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty() }))).toEqual(before);
});

test('@critical the ••• menu is reachable over Home, and carries Open Project and Import SVG', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await expect(page.locator('[data-home]')).toBeVisible();
  // The topbar sits above Home, which is the whole reason Home can be this
  // small: a returning author reaches their saved project from a first run.
  await page.getByLabel('More project actions').click();
  const menu = page.locator('details.file-menu .menu-popover');
  await expect(menu).toBeVisible();
  await expect(menu.locator('label').filter({ hasText: 'Open Project' })).toBeVisible();
  await expect(menu.locator('label').filter({ hasText: 'Import SVG' })).toBeVisible();
  await expect(page.locator('#project-file')).toHaveCount(1);
  await expect(page.locator('#svg-file')).toHaveCount(1);
});

test('@critical Home refuses to close while no project is loaded', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await expect(page.locator('[data-home] .home-back'), 'nothing to go back to yet').toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-home]'), 'Escape must not leave an empty editor to interact with').toBeVisible();
});

test('@critical user can import SVG artwork while Home is open', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('#svg-file').setInputFiles('tests/e2e/fixtures/product-head.svg');
  await expect(page.locator('[data-home]')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.task())).toBe('design.artwork');
  await expect(page.locator('#canvas svg svg #journeyHead')).toBeVisible();
  const document = await page.evaluate(() => window.__BOOP_E2E__.document());
  expect(document.svgMarkup).toContain('journeyHead');
  expect(document.semanticParts).toEqual({});
});

test('@critical an invalid SVG import preserves the blank project and Home', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  const checkpoint=()=>page.evaluate(()=>({document:window.__BOOP_E2E__.document(),token:window.__BOOP_E2E__.documentVersionToken(),revisions:window.__BOOP_E2E__.documentRevisions(),history:window.__BOOP_E2E__.history(),dirty:window.__BOOP_E2E__.dirty()}));
  const before=await checkpoint();
  await page.locator('#svg-file').setInputFiles({name:'invalid.svg',mimeType:'image/svg+xml',buffer:Buffer.from('not an svg')});
  await expect(page.locator('[data-home]')).toBeVisible();
  await expect(page.locator('#toast')).toHaveAttribute('data-tone', 'error');
  await expect(page.locator('#toast')).toContainText('Invalid or unsupported SVG');
  expect(await checkpoint()).toEqual(before);
  await expect(page.locator('#canvas svg svg')).toHaveCount(0);
});

test('@critical user can create a new Basic Face from Home', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await expect(page.locator('[data-home]')).toBeVisible();
  await page.locator('[data-home] [data-template-id="basic"]').click();
  await expect(page.locator('[data-home]')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.task())).toBe('design.artwork');
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
