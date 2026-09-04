import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const mutations = (page) => page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);
const statusOf = (page, id) => page.evaluate((presetId) => window.__BOOP_E2E__.automatic().presets.find((item) => item.id === presetId).status, id);

async function openAnimate(page) {
  await page.locator('[data-task="animate"]').click();
  await expect(page.locator('#automatic-panel[data-automatic-ready="true"]')).toBeVisible();
}

test('@critical Blink, Natural gaze and Idle head movement turn ordinary behaviors off and on, testable and exported', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAnimate(page);
  // The template ships its life running: a mascot that arrives frozen reads as
  // broken. The V2 cartoon idles that need hands or a body stay unavailable.
  await expect(page.locator('[data-automatic-card="blink"]')).toHaveAttribute('data-automatic-status', 'on');
  await expect(page.locator('[data-automatic-card="natural-gaze"]')).toHaveAttribute('data-automatic-status', 'on');
  await expect(page.locator('[data-automatic-card="idle-head"]')).toHaveAttribute('data-automatic-status', 'on');
  await expect(page.locator('[data-automatic-card="hand-drift"]')).toHaveAttribute('data-automatic-status', 'unavailable');
  await expect(page.locator('#automatic-panel')).toHaveAttribute('data-automatic-on', '3');
  expect((await documentOf(page)).behaviors.map((item) => item.id)).toEqual(['auto-blink', 'auto-gaze-x', 'auto-gaze-y', 'auto-idle-head']);
  const before = await mutations(page);

  // Turning one off keeps it, so an author's tweaks survive switching it back on.
  await page.locator('[data-automatic-toggle="blink"]').uncheck();
  await expect(page.locator('[data-automatic-card="blink"]')).toHaveAttribute('data-automatic-status', 'disabled');
  await expect(page.locator('[data-automatic-card="blink"]')).toContainText('kept');
  expect(await mutations(page)).toBe(before + 1);
  expect((await documentOf(page)).behaviors.find((item) => item.id === 'auto-blink').enabled).toBe(false);

  await page.locator('[data-automatic-toggle="blink"]').check();
  await expect(page.locator('[data-automatic-card="blink"]')).toHaveAttribute('data-automatic-status', 'on');
  expect(await mutations(page)).toBe(before + 2);
  expect((await documentOf(page)).behaviors).toHaveLength(4, 'switched back on, not added again');
  await page.locator('[data-automatic-test="blink"]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.previewSession().testBehavior?.id)).toBe('auto-blink');
  expect(await mutations(page)).toBe(before + 2);

  await page.locator('[data-task="preview"]').click();
  await expect(page.locator('[data-preview-section="automatic"] [data-preview-behavior="auto-blink"]')).toBeChecked();
  expect(await page.evaluate(() => window.__BOOP_E2E__.taskReadiness().animate.summary)).toContain('automatic behavior');

  const rig = await page.evaluate(() => JSON.parse(window.__BOOP_E2E__.exportArtifacts().find((item) => item.name === 'rig.json').content));
  expect(rig.behaviors.map((item) => item.id)).toEqual(['auto-blink', 'auto-gaze-x', 'auto-gaze-y', 'auto-idle-head']);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await documentOf(page)).behaviors.find((item) => item.id === 'auto-blink').enabled).toBe(false);
});

test('every behavior the template ships is a recognized preset, so none is listed as advanced', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('[data-home] [data-template-id="basic"]').click();
  await expect(page.locator('#canvas svg svg')).toBeVisible();
  await openAnimate(page);
  await expect(page.locator('[data-automatic-card="blink"]')).toHaveAttribute('data-automatic-status', 'on');
  // Detection is by type and parameter, so the four shipped behaviors map onto
  // three presets and nothing falls through to the advanced list.
  await expect(page.locator('[data-automatic-other]')).toHaveCount(0);
  expect(await statusOf(page, 'idle-head')).toBe('on');

  // A behavior that matches no preset is the one that shows up there.
  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => {
    state.behaviors = [...state.behaviors, { id: 'hand-made', type: 'oscillator', name: 'Hand made', enabled: true, parameter: 'headTilt', amplitude: .1, frequency: .5, offset: 0, waveform: 'sine' }];
  }));
  await expect(page.locator('[data-automatic-other]')).toContainText('1 advanced behavior');
  await expect(page.locator('[data-automatic-other]')).toContainText('Hand made');
  await page.locator('[data-automatic-advanced]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.session().authorMode)).toBe('behaviors');
});

test('presets wait for movements and guide to Face Setup', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('#home-svg-file').setInputFiles('tests/e2e/fixtures/product-face.svg');
  await expect(page.locator('#canvas svg svg #journeyMouth')).toBeVisible();
  await openAnimate(page);
  // No movements yet, so every preset waits -- the three original ones and the
  // V2 cartoon idles alike.
  for (const id of ['blink', 'natural-gaze', 'idle-head', 'eye-wander', 'head-drift', 'hand-drift']) {
    await expect(page.locator(`[data-automatic-card="${id}"]`)).toHaveAttribute('data-automatic-status', 'unavailable');
  }
  await expect(page.locator('[data-automatic-card="blink"]')).toContainText('Needs Eyes');
  await page.locator('[data-automatic-card="blink"] [data-automatic-fix-movements]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.task())).toBe('face-setup');
  await page.getByRole('button', { name: 'Accept 8 suggestions' }).click();
  await page.getByRole('button', { name: /Turn on all 13 available movements/ }).click();
  await openAnimate(page);
  // The face movements now exist, so the face presets are available; the ones
  // that need a body or hands still wait.
  for (const id of ['blink', 'natural-gaze', 'idle-head', 'eye-wander', 'head-drift']) {
    await expect(page.locator(`[data-automatic-card="${id}"]`)).toHaveAttribute('data-automatic-status', 'off');
  }
  await expect(page.locator('[data-automatic-card="hand-drift"]')).toHaveAttribute('data-automatic-status', 'unavailable');
  await page.locator('[data-automatic-toggle="idle-head"]').check();
  expect((await documentOf(page)).behaviors[0]).toMatchObject({ id: 'auto-idle-head', type: 'oscillator', parameter: 'headY', amplitude: .05, frequency: .3, enabled: true });
});
