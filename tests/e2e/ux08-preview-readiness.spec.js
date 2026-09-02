import { test, expect } from '@playwright/test';
import { openFreshEditor, readSvgTranslation, startBasicFace } from './editor-helpers.js';

const checkpoint = (page) => page.evaluate(() => ({
  document: window.__BOOP_E2E__.document(), token: window.__BOOP_E2E__.documentVersionToken(), revisions: window.__BOOP_E2E__.documentRevisions(),
  history: window.__BOOP_E2E__.history(), dirty: window.__BOOP_E2E__.dirty(), mutations: window.__BOOP_E2E__.diagnostics().store.documentMutations
}));
const effective = (page, name) => page.evaluate((n) => window.__BOOP_E2E__.effectiveParams()[n], name);
const readiness = (page) => page.evaluate(() => window.__BOOP_E2E__.taskReadiness());
const task = (page) => page.evaluate(() => window.__BOOP_E2E__.task());

async function openPreview(page) {
  await page.locator('[data-task="preview"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'preview');
  await expect(page.locator('#preview-panel[data-preview-panel-ready="true"]')).toBeVisible();
}

test('@critical Preview offers live controls and a readiness list without writing to the project', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openPreview(page);
  await expect(page.getByRole('heading', { name: 'Preview', exact: true })).toBeVisible();
  const before = await checkpoint(page);
  await expect(page.locator('[data-preview-section="live"]')).toBeVisible();
  const pad = page.locator('[data-preview-xy="lookX:lookY"]');
  await expect(pad).toBeVisible();
  const pupil = page.locator('#pupilLeft'), base = await readSvgTranslation(pupil);
  const slider = page.locator('[data-preview-control="lookX"]');
  await slider.fill('0.8');
  await expect.poll(() => effective(page, 'lookX')).toBeCloseTo(.8);
  expect((await readSvgTranslation(pupil)).x).not.toBe(base.x);
  await pad.focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => effective(page, 'lookY')).toBeCloseTo(-.1);
  expect(await checkpoint(page)).toEqual(before);

  const list = page.locator('[data-preview-section="readiness"]');
  await expect(list.locator('[data-readiness-section="artwork"]')).toHaveAttribute('data-readiness-status', 'ready');
  await expect(list.locator('[data-readiness-section="faceSetup"]')).toHaveAttribute('data-readiness-status', 'warning');
  await expect(list.locator('[data-readiness-section="faceSetup"]')).toContainText('6 / 8 assigned');
  await expect(list.locator('[data-readiness-section="movements"]')).toHaveAttribute('data-readiness-status', 'warning');
  await expect(list.locator('[data-readiness-section="export"]')).toHaveAttribute('data-readiness-status', 'ready');
  const model = await readiness(page);
  expect(model.faceSetup.code).toBe('face.roles.missing');
  expect(model.movements.code).toBe('face.movements.uncalibrated');
  expect(model.next.id).toBe('faceSetup');
  await expect(page.locator('[data-task="face-setup"]')).toHaveText(/Face Setup ⚠/);

  await page.getByRole('button', { name: 'Reset mascot' }).click();
  await expect.poll(() => effective(page, 'lookX')).toBe(0);
  await expect.poll(() => effective(page, 'lookY')).toBe(0);
  expect(await checkpoint(page)).toEqual(before);

  await list.getByRole('button', { name: 'Go to Movements' }).click();
  await expect.poll(() => task(page)).toBe('face-setup');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'semantic-control');
  await expect(page.getByRole('heading', { name: 'Movement Inspector', exact: true })).toBeVisible();
  expect(await checkpoint(page)).toEqual(before);
});

test('@critical Preview poses, animations and automatic behaviors are preview-only and reset together', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('[data-home] [data-template-id="expressive"]').click();
  await expect(page.locator('#canvas svg svg #head')).toBeVisible();
  await openPreview(page);
  const before = await checkpoint(page);
  const automatic = page.locator('[data-preview-section="automatic"]');
  await expect(automatic).toBeVisible();
  const blink = automatic.locator('[data-preview-behavior="blink"]');
  await expect(blink).toBeChecked();
  await blink.uncheck();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.previewOverrides())).toEqual({ blink: false });
  expect((await checkpoint(page)).document.behaviors.find((behavior) => behavior.id === 'blink').enabled).toBe(true);
  await expect(automatic).toContainText('preview only');

  await page.locator('[data-preview-section="poses"] [data-preview-state="happy"]').click();
  await expect.poll(() => effective(page, 'smile'), { timeout: 3000 }).toBeCloseTo(1, 1);
  await expect(page.locator('[data-preview-state="happy"]')).toHaveAttribute('aria-pressed', 'true');

  const clip = page.locator('[data-preview-section="animations"] [data-preview-clip="look-around"]');
  await clip.click();
  await expect(clip).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.diagnostics().preview.playing)).toBe(true);
  await clip.click();
  await expect(clip).toHaveAttribute('aria-pressed', 'false');
  expect(await checkpoint(page)).toEqual(before);

  await page.getByRole('button', { name: 'Reset mascot' }).click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.previewOverrides())).toEqual({});
  await expect(automatic.locator('[data-preview-behavior="blink"]')).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.diagnostics().preview.playing)).toBe(false);
  expect(await checkpoint(page)).toEqual(before);
});

test('readiness deep links from Problems reach the task that fixes them', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('#home-svg-file').setInputFiles('tests/e2e/fixtures/product-face.svg');
  await expect(page.locator('#canvas svg svg #journeyMouth')).toBeVisible();
  await page.getByRole('button', { name: 'Problems' }).click();
  const panel = page.locator('#problems-panel');
  await expect(panel.locator('[data-readiness-section="faceSetup"]')).toHaveAttribute('data-readiness-status', 'todo');
  await expect(panel.locator('[data-readiness-section="faceSetup"]')).toContainText('No face parts assigned yet');
  await panel.getByRole('button', { name: 'Go to Face parts' }).click();
  await expect(panel).toBeHidden();
  await expect.poll(() => task(page)).toBe('face-setup');
  await expect(page.locator('#face-setup-checklist[data-face-setup-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Accept 8 suggestions' }).click();
  await expect(page.locator('[data-task="face-setup"]')).toHaveText(/Face Setup ○/);
  await page.getByRole('button', { name: 'Problems' }).click();
  await expect(panel.locator('[data-readiness-section="faceSetup"]')).toHaveAttribute('data-readiness-status', 'ready');
  await expect(panel.locator('[data-readiness-section="movements"]')).toContainText('No movement turned on');
});
