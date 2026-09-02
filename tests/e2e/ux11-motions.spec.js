import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';
import { openEditableProject, saveEditableProject, startNewProject } from './product-journey-helpers.js';

const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const clipOf = async (page, id) => (await documentOf(page)).animationClips.find((clip) => clip.id === id);
const mutations = (page) => page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);
const playing = (page) => page.evaluate(() => window.__BOOP_E2E__.diagnostics().preview.playing);
const times = (clip, name) => clip.tracks[name].map((frame) => frame.time);
const nodMotion = (amplitude, repeats) => ({ preset: 'nod', amplitude, repeats, controls: { headY: 'headY' } });

async function openAnimate(page) {
  await page.locator('[data-task="animate"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'animate');
  await expect(page.locator('#motion-panel[data-motions-ready="true"]')).toBeVisible();
}

test('@critical user adds Nod, tests it, tunes amplitude, duration and repeats, then opens it in the Timeline', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAnimate(page);
  await expect(page.locator('[data-motion-preset-card]')).toHaveCount(2);
  await expect(page.locator('[data-motion-preset-card="nod"]')).toHaveAttribute('data-preset-usable', 'true');
  const before = await mutations(page), count = (await documentOf(page)).animationClips.length;

  await page.getByRole('button', { name: 'Add Nod motion' }).click();
  await expect(page.locator('#motion-panel')).toHaveAttribute('data-motions-count', String(count + 1));
  expect(await mutations(page)).toBe(before + 1);
  expect(await clipOf(page, 'nod')).toEqual({ id: 'nod', name: 'Nod', duration: .8, loop: false, tracks: { headY: [{ time: 0, value: 0, easing: 'linear' }, { time: .4, value: .5, easing: 'easeInOut' }, { time: .8, value: 0, easing: 'easeInOut' }] }, motion: nodMotion(.5, 1) });
  await expect.poll(() => playing(page)).toBe(true);
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'clip');
  await expect(page.getByRole('heading', { name: 'Motion Inspector', exact: true })).toBeVisible();
  await expect(page.locator('#motion-inspector')).toHaveAttribute('data-motion-kind', 'simple');
  await expect(page.locator('[data-motion-select="nod"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-motion-stop]').click();
  await expect.poll(() => playing(page)).toBe(false);

  await page.locator('[data-motion-setting="amplitude"]').fill('1');
  await expect.poll(async () => (await clipOf(page, 'nod')).tracks.headY[1].value).toBe(1);
  await page.locator('[data-motion-setting="duration"]').fill('1.2');
  await page.locator('[data-motion-setting="duration"]').dispatchEvent('change');
  await expect.poll(async () => times(await clipOf(page, 'nod'), 'headY')).toEqual([0, .6, 1.2]);
  await page.locator('[data-motion-setting="repeats"]').fill('2');
  await page.locator('[data-motion-setting="repeats"]').dispatchEvent('change');
  await expect.poll(async () => times(await clipOf(page, 'nod'), 'headY')).toEqual([0, .3, .6, .9, 1.2]);
  expect(await mutations(page)).toBe(before + 4);
  expect((await clipOf(page, 'nod')).motion).toEqual(nodMotion(1, 2));
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => times(await clipOf(page, 'nod'), 'headY')).toEqual([0, .6, 1.2]);
  await expect(page.locator('[data-motion-setting="repeats"]')).toHaveValue('1');
  await page.locator('[data-motion-play]').click();
  await expect.poll(() => playing(page)).toBe(true);
  await page.locator('[data-motion-stop]').click();

  const app = page.locator('#app');
  if (!(await app.evaluate((el) => el.classList.contains('timeline-collapsed')))) await page.locator('#collapse-timeline').click();
  await expect(app).toHaveClass(/timeline-collapsed/);
  await page.locator('[data-motion-open-timeline]').click();
  await expect(app).not.toHaveClass(/timeline-collapsed/);
  await expect(page.locator('#clip-name')).toHaveValue('Nod');
  await page.locator('[data-key="headY|0.6"]').click();
  await page.locator('[data-key-edit="value"]').fill('0.2');
  await page.locator('[data-key-edit="value"]').dispatchEvent('change');
  await expect(page.locator('[data-motion-select="nod"]')).toHaveAttribute('data-motion-kind', 'edited');
  // Selecting a key shows the Timeline context; selecting the motion again brings the Motion Inspector back.
  await page.locator('[data-motion-select="nod"]').click();
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'clip');
  await expect(page.locator('#motion-inspector')).toHaveAttribute('data-motion-kind', 'edited');
  await expect(page.locator('[data-motion-status="edited"]')).toBeVisible();
  await expect(page.locator('[data-motion-setting="amplitude"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#motion-inspector')).toHaveAttribute('data-motion-kind', 'simple');
  await expect(page.locator('[data-motion-setting="amplitude"]')).toHaveValue('1');

  const saved = await saveEditableProject(page);
  expect(saved.snapshot.document.editor.animationClips.find((clip) => clip.id === 'nod').motion).toEqual(nodMotion(1, 1));
  const rig = JSON.parse(saved.snapshot ? await page.evaluate(() => window.__BOOP_E2E__.exportArtifacts().find((item) => item.name === 'rig.json').content) : '{}');
  expect(rig.animationClips).toBeUndefined();
  await startNewProject(page);
  await openEditableProject(page, saved.path);
  expect((await clipOf(page, 'nod')).motion).toEqual(nodMotion(1, 1));
  expect((await page.evaluate(() => window.__BOOP_E2E__.motions())).motions.find((item) => item.id === 'nod').kind).toBe('simple');
});

test('presets wait for movements, then Shake plays from Preview and can be deleted', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('#home-svg-file').setInputFiles('tests/e2e/fixtures/product-face.svg');
  await expect(page.locator('#canvas svg svg #journeyMouth')).toBeVisible();
  await openAnimate(page);
  await expect(page.locator('#motion-panel')).toContainText('Turn on a head movement');
  await expect(page.getByRole('button', { name: 'Add Nod motion' })).toBeDisabled();
  await expect(page.locator('[data-motion-preset-card="nod"]')).toContainText('Needs Head');
  await page.locator('#motion-panel [data-motion-fix-movements]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.task())).toBe('face-setup');
  await page.getByRole('button', { name: 'Accept 8 suggestions' }).click();
  await page.getByRole('button', { name: /Turn on all 10 available movements/ }).click();
  await openAnimate(page);
  await page.getByRole('button', { name: 'Add Shake motion' }).click();
  const shake = await clipOf(page, 'shake');
  expect(shake.motion).toEqual({ preset: 'shake', amplitude: .5, repeats: 2, controls: { headX: 'headX' } });
  expect(times(shake, 'headX')).toEqual([0, .1, .3, .4, .5, .7, .8]);
  await page.locator('[data-motion-stop]').click();
  await page.locator('[data-task="preview"]').click();
  const chip = page.locator('[data-preview-section="animations"] [data-preview-clip="shake"]');
  await chip.click();
  await expect.poll(() => playing(page)).toBe(true);
  await page.getByRole('button', { name: 'Reset mascot' }).click();
  await expect.poll(() => playing(page)).toBe(false);
  await openAnimate(page);
  await page.locator('[data-motion-select="shake"]').click();
  await expect(page.locator('#motion-inspector')).toHaveAttribute('data-motion-id', 'shake');
  await page.locator('[data-motion-delete]').click();
  await expect(page.locator('#motion-panel')).toHaveAttribute('data-motions-count', '0');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'none');
  expect((await documentOf(page)).animationClips).toEqual([]);
});
