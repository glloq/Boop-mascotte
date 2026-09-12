import { test, expect } from '@playwright/test';
import { importArtworkFixture, openFreshEditor, readSvgTranslation, startBasicFace } from './editor-helpers.js';

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

  // The readiness rows live once in this column, in the Publish panel: the
  // Preview panel used to repeat the same seven rows right above it.
  await expect(page.locator('[data-preview-section="readiness"]')).toHaveCount(0);
  const list = page.locator('[data-publish-checklist]');
  await expect(list.locator('[data-publish-step="artwork"]')).toHaveAttribute('data-publish-status', 'ready');
  await expect(list.locator('[data-publish-step="faceSetup"]')).toHaveAttribute('data-publish-status', 'ready');
  await expect(list.locator('[data-publish-step="faceSetup"]')).toContainText('8 / 8 assigned');
  // The mouth is shaped by shape keys, which are their own calibration, so the
  // template no longer arrives with nothing captured at all.
  await expect(list.locator('[data-publish-step="movements"]')).toHaveAttribute('data-publish-status', 'ready');
  await expect(list.locator('[data-publish-step="movements"]')).toContainText('23 on · 5 set up');
  await expect(list.locator('[data-publish-step="export"]')).toHaveAttribute('data-publish-status', 'ready');
  const model = await readiness(page);
  expect(model.faceSetup.status).toBe('ready');
  expect(model.movements.code).toBe(null);
  // A template that arrives finished has nothing left to fix.
  expect(model.next).toBe(null);

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
  await startBasicFace(page);
  await openPreview(page);
  const before = await checkpoint(page);
  const automatic = page.locator('[data-preview-section="automatic"]');
  await expect(automatic).toBeVisible();
  const blink = automatic.locator('[data-preview-behavior="auto-blink"]');
  await expect(blink).toBeChecked();
  await blink.uncheck();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.previewOverrides())).toEqual({ 'auto-blink': false });
  expect((await checkpoint(page)).document.behaviors.find((behavior) => behavior.id === 'auto-blink').enabled).toBe(true);
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
  await expect(automatic.locator('[data-preview-behavior="auto-blink"]')).toBeChecked();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.diagnostics().preview.playing)).toBe(false);
  expect(await checkpoint(page)).toEqual(before);
});

/**
 * One reset, in the project bar (docs/STILL_WHILE_DESIGNING.md).
 *
 * It used to be a button inside the Preview panel, which meant the only way
 * back to rest was a tab away from every place the mascot is actually posed --
 * the puppet handles in Character, the pads in Face Setup. The control moved to
 * the project bar and the Preview copy went with it, so the name below resolves
 * to exactly one button on every tab.
 */
test('@critical the reset is in the project bar, works on any tab, and touches nothing authored', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="character"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'character');
  const before = await checkpoint(page);
  await page.evaluate(() => { window.__BOOP_E2E__.setLiveParam('lookX', .8); window.__BOOP_E2E__.setLiveParam('headX', .5); });
  await expect.poll(() => effective(page, 'lookX')).toBeCloseTo(.8);

  const reset = page.getByRole('button', { name: 'Reset mascot' });
  await expect(reset).toBeVisible();
  await reset.click();
  await expect.poll(() => effective(page, 'lookX')).toBe(0);
  await expect.poll(() => effective(page, 'headX')).toBe(0);
  expect(await checkpoint(page), 'the reset writes no command, no history step and no revision').toEqual(before);

  // One control, not one per tab, and never two on the same tab.
  for (const task of ['artwork', 'face-setup', 'expressions', 'animate', 'reactions', 'preview']) {
    await page.locator(`[data-task="${task}"]`).click();
    await expect(page.getByRole('button', { name: 'Reset mascot' }), `${task} carries the one reset`).toHaveCount(1);
  }
  await expect(page.locator('#preview-reset'), 'the Preview panel no longer carries a second copy').toHaveCount(0);
});

test('readiness deep links from Problems reach the task that fixes them', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await importArtworkFixture(page, 'product-face.svg');
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
