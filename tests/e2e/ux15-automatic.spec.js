import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const mutations = (page) => page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);
const statusOf = (page, id) => page.evaluate((presetId) => window.__BOOP_E2E__.automatic().presets.find((item) => item.id === presetId).status, id);

async function openAnimate(page) {
  await page.locator('[data-task="animate"]').click();
  await expect(page.locator('#automatic-panel[data-automatic-ready="true"]')).toBeVisible();
}

test('@critical Blink, Natural gaze and Idle head movement turn ordinary behaviors on and off, testable and exported', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAnimate(page);
  // Every preset is listed; Basic Face has the movements for these three, and
  // the V2 cartoon idles that need hands or a body are shown as unavailable.
  await expect(page.locator('[data-automatic-card="blink"]')).toHaveAttribute('data-automatic-status', 'off');
  await expect(page.locator('[data-automatic-card="natural-gaze"]')).toHaveAttribute('data-automatic-status', 'off');
  await expect(page.locator('[data-automatic-card="idle-head"]')).toHaveAttribute('data-automatic-status', 'off');
  await expect(page.locator('[data-automatic-card="hand-drift"]')).toHaveAttribute('data-automatic-status', 'unavailable');
  expect((await documentOf(page)).behaviors).toEqual([]);
  const before = await mutations(page);

  await page.locator('[data-automatic-toggle="blink"]').check();
  await expect(page.locator('[data-automatic-card="blink"]')).toHaveAttribute('data-automatic-status', 'on');
  expect(await mutations(page)).toBe(before + 1);
  const behaviors = (await documentOf(page)).behaviors;
  expect(behaviors).toHaveLength(1);
  expect(behaviors[0]).toMatchObject({ id: 'auto-blink', type: 'blink', name: 'Blink', enabled: true, parameter: 'eyeOpen', intervalMin: 2, intervalMax: 6, duration: .12, closedValue: 0 });
  await expect(page.locator('#automatic-panel')).toHaveAttribute('data-automatic-on', '1');
  await page.locator('[data-automatic-test="blink"]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.previewSession().testBehavior?.id)).toBe('auto-blink');
  expect(await mutations(page)).toBe(before + 1);

  await page.locator('[data-task="preview"]').click();
  await expect(page.locator('[data-preview-section="automatic"] [data-preview-behavior="auto-blink"]')).toBeChecked();
  expect(await page.evaluate(() => window.__BOOP_E2E__.taskReadiness().animate.summary)).toContain('1 automatic behavior');
  await openAnimate(page);
  await page.locator('[data-automatic-toggle="blink"]').uncheck();
  await expect(page.locator('[data-automatic-card="blink"]')).toHaveAttribute('data-automatic-status', 'disabled');
  await expect(page.locator('[data-automatic-card="blink"]')).toContainText('kept');
  expect((await documentOf(page)).behaviors[0].enabled).toBe(false);
  await page.locator('[data-automatic-toggle="natural-gaze"]').check();
  await expect(page.locator('[data-automatic-card="natural-gaze"]')).toHaveAttribute('data-automatic-status', 'on');
  expect((await documentOf(page)).behaviors.map((item) => [item.id, item.type, item.parameter, item.enabled])).toEqual([['auto-blink', 'blink', 'eyeOpen', false], ['auto-gaze-x', 'randomIdle', 'lookX', true], ['auto-gaze-y', 'randomIdle', 'lookY', true]]);
  expect(await mutations(page)).toBe(before + 3);
  const rig = await page.evaluate(() => JSON.parse(window.__BOOP_E2E__.exportArtifacts().find((item) => item.name === 'rig.json').content));
  expect(rig.behaviors.map((item) => item.id)).toEqual(['auto-blink', 'auto-gaze-x', 'auto-gaze-y']);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await documentOf(page)).behaviors.length).toBe(1);
  await expect(page.locator('[data-automatic-card="natural-gaze"]')).toHaveAttribute('data-automatic-status', 'off');
});

test('hand authored behaviors are recognized: the Expressive Face has Blink on and one advanced behavior', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('[data-home] [data-template-id="expressive"]').click();
  await expect(page.locator('#canvas svg svg')).toBeVisible();
  await openAnimate(page);
  await expect(page.locator('[data-automatic-card="blink"]')).toHaveAttribute('data-automatic-status', 'on');
  await expect(page.locator('[data-automatic-other]')).toContainText('1 advanced behavior');
  await expect(page.locator('[data-automatic-other]')).toContainText('Idle');
  expect(await statusOf(page, 'idle-head')).toBe('off');
  await page.locator('[data-automatic-advanced]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.session().authorMode)).toBe('behaviors');
  await expect(page.locator('#state-editor')).toContainText('Idle');
});

test('presets wait for movements and guide to Face Setup', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('#home-svg-file').setInputFiles('tests/e2e/fixtures/product-face.svg');
  await expect(page.locator('#canvas svg svg #journeyMouth')).toBeVisible();
  await openAnimate(page);
  await expect(page.locator('[data-automatic-card][data-automatic-status="unavailable"]')).toHaveCount(3);
  await expect(page.locator('[data-automatic-card="blink"]')).toContainText('Needs Eyes');
  await page.locator('[data-automatic-card="blink"] [data-automatic-fix-movements]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.task())).toBe('face-setup');
  await page.getByRole('button', { name: 'Accept 8 suggestions' }).click();
  await page.getByRole('button', { name: /Turn on all 10 available movements/ }).click();
  await openAnimate(page);
  await expect(page.locator('[data-automatic-card][data-automatic-status="off"]')).toHaveCount(3);
  await page.locator('[data-automatic-toggle="idle-head"]').check();
  expect((await documentOf(page)).behaviors[0]).toMatchObject({ id: 'auto-idle-head', type: 'oscillator', parameter: 'headY', amplitude: .05, frequency: .3, enabled: true });
});
