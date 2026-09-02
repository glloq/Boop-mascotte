import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const clipOf = async (page, id) => (await documentOf(page)).animationClips.find((clip) => clip.id === id);
const kindOf = (page, id) => page.evaluate((clipId) => window.__BOOP_E2E__.motions().motions.find((item) => item.id === clipId)?.kind, id);
const values = (clip, name) => clip.tracks[name].map((frame) => [frame.time, frame.value]);

async function openAnimate(page) {
  await page.locator('[data-task="animate"]').click();
  await expect(page.locator('#motion-panel[data-motions-ready="true"]')).toBeVisible();
}
async function showTimeline(page) {
  const app = page.locator('#app');
  if (await app.evaluate((el) => el.classList.contains('timeline-collapsed'))) await page.locator('#collapse-timeline').click();
  await expect(app).not.toHaveClass(/timeline-collapsed/);
}

test('@critical seven presets, Timeline parity and the explicit preset → custom transition', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAnimate(page);
  const cards = page.locator('[data-motion-preset-card]');
  await expect(cards).toHaveCount(7);
  await expect(page.locator('[data-motion-preset-card][data-preset-usable="true"]')).toHaveCount(7);
  await expect(page.locator('[data-motion-preset-card="head-pop"]')).toContainText('Head · Move up / down, Mouth · Open / close');

  await page.getByRole('button', { name: 'Add Head Pop motion' }).click();
  const pop = await clipOf(page, 'head-pop');
  expect(pop.motion).toEqual({ preset: 'head-pop', amplitude: .7, repeats: 1, controls: { headY: 'headY', mouthOpen: 'mouthOpen' } });
  expect(values(pop, 'mouthOpen')).toEqual([[0, 0], [.12, .7], [.36, 0], [.6, 0]]);
  await page.locator('[data-motion-stop]').click();
  await page.getByRole('button', { name: 'Add Look Around motion' }).click();
  expect(Object.keys((await clipOf(page, 'look-around-2')).tracks)).toEqual(['lookX', 'lookY']);
  await page.locator('[data-motion-stop]').click();
  await expect(page.locator('[data-motion-select="look-around-2"] [data-motion-badge="simple"]')).toHaveText('Preset');
  await expect(page.locator('[data-motion-select="look-around"] [data-motion-badge="custom"]')).toHaveText('Timeline');

  // Timeline navigator and Motion list drive the same selection.
  await showTimeline(page);
  await page.locator('[data-clip-id="look-around"]').click();
  await expect(page.locator('[data-motion-select="look-around"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#motion-inspector')).toHaveAttribute('data-motion-kind', 'custom');
  await page.locator('[data-motion-select="head-pop"]').click();
  await expect(page.locator('#clip-name')).toHaveValue('Head Pop');
  await expect(page.locator('[data-clip-id="head-pop"]')).toHaveAttribute('aria-selected', 'true');

  // Editing a key in the Timeline is an explicit transition: notice, then Reset or Keep as custom.
  await page.locator('[data-key="mouthOpen|0.12"]').click();
  await page.locator('[data-key-edit="value"]').fill('0.3');
  await page.locator('[data-key-edit="value"]').dispatchEvent('change');
  await expect.poll(() => kindOf(page, 'head-pop')).toBe('edited');
  await expect(page.locator('#toast')).toContainText('now edited by hand');
  await expect(page.locator('#context-inspector')).toHaveAttribute('data-context-kind', 'timeline-track');
  await expect(page.getByRole('heading', { name: 'Motion Inspector', exact: true })).toBeVisible();
  await expect(page.locator('[data-motion-status="edited"]')).toBeVisible();
  await expect(page.locator('[data-motion-select="head-pop"] [data-motion-badge="edited"]')).toHaveText('Edited');
  await page.locator('[data-motion-reset]').click();
  await page.locator('[data-motion-reset-cancel]').click();
  await expect.poll(() => kindOf(page, 'head-pop')).toBe('edited');
  await page.locator('[data-motion-reset]').click();
  await page.locator('[data-motion-reset-confirm]').click();
  await expect.poll(() => kindOf(page, 'head-pop')).toBe('simple');
  expect(values(await clipOf(page, 'head-pop'), 'mouthOpen')[1]).toEqual([.12, .7]);
  await expect(page.locator('[data-motion-setting="amplitude"]')).toHaveValue('0.7');

  await page.locator('[data-key="mouthOpen|0.12"]').click();
  await page.locator('[data-key-edit="value"]').fill('0.3');
  await page.locator('[data-key-edit="value"]').dispatchEvent('change');
  await expect.poll(() => kindOf(page, 'head-pop')).toBe('edited');
  await page.locator('[data-motion-detach]').click();
  await expect.poll(() => kindOf(page, 'head-pop')).toBe('custom');
  expect((await clipOf(page, 'head-pop')).motion).toBeUndefined();
  expect(values(await clipOf(page, 'head-pop'), 'mouthOpen')[1]).toEqual([.12, .3]);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => kindOf(page, 'head-pop')).toBe('edited');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => kindOf(page, 'head-pop')).toBe('simple');
});
