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

test('@critical the grouped preset catalogue, Timeline parity and the explicit preset → custom transition', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAnimate(page);
  const cards = page.locator('[data-motion-preset-card]');
  // Twenty motions do not fit one panel: they are grouped, with Head open.
  expect(await cards.count()).toBeGreaterThanOrEqual(18);
  await expect(page.locator('[data-preset-catalogue="motions"] .preset-group')).toHaveCount(3);
  await expect(page.locator('[data-preset-group="Head"] [data-motion-preset-card][data-preset-usable="true"]')).toHaveCount(10);
  await expect(page.locator('[data-motion-preset-card="head-pop"]')).toContainText('Head · Move up / down, Mouth · Open / close');

  await page.getByRole('button', { name: 'Add Head Pop motion' }).click();
  const pop = await clipOf(page, 'head-pop');
  expect(pop.motion).toEqual({ preset: 'head-pop', amplitude: .7, repeats: 1, controls: { headY: 'headY', mouthOpen: 'mouthOpen' } });
  expect(values(pop, 'mouthOpen')).toEqual([[0, 0], [.12, .7], [.36, 0], [.6, 0]]);
  await page.locator('[data-motion-stop]').click();
  await page.locator('[data-preset-group="Eyes"] > summary').click();
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

/**
 * Make your own (VNX-27). The catalogue is head, eyes and face: a mascot that
 * wiggles its ears finds nothing in it, and its only way to animate that
 * movement was the Timeline, key by key. This is the same compiler with the
 * movement and the shape chosen instead of looked up.
 */
test('@critical any movement can be given a shape without opening the Timeline', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAnimate(page);

  const section = page.locator('[data-motion-compose-section]');
  await expect(section, 'the composer is Advanced, not the first thing offered').not.toHaveAttribute('open', /.*/);
  await section.locator('summary').click();

  // Every movement the project has, named the way the rest of the editor names
  // it — including the ones no fixed catalogue could list.
  const movement = section.locator('[data-motion-compose-control]');
  const offered = await movement.locator('option').evaluateAll((nodes) => nodes.map((node) => node.value));
  expect(offered).toContain('earWiggle');
  expect(offered.length, 'the whole project, not a hand-written subset').toBeGreaterThan(8);
  await expect(section.locator('optgroup[label="Ears"]')).toHaveCount(1);

  const before = (await documentOf(page)).animationClips.length;
  await movement.selectOption('earWiggle');
  await section.locator('[data-motion-compose-shape]').selectOption('settle');
  await expect(section.locator('[data-motion-compose-hint]')).toContainText('Overshoots');
  await section.locator('[data-motion-compose]').click();

  const clips = (await documentOf(page)).animationClips;
  expect(clips.length).toBe(before + 1);
  const made = clips.at(-1);
  expect(made.motion.preset).toBe('shape:settle:earWiggle');
  expect(Object.keys(made.tracks)).toEqual(['earWiggle']);
  expect(await kindOf(page, made.id), 'it is an ordinary preset motion, not a third kind').toBe('simple');

  // And the Inspector drives it like any other: amplitude, duration, repeats.
  const inspector = page.locator('#motion-inspector');
  await expect(inspector).toHaveAttribute('data-motion-kind', 'simple');
  await inspector.locator('[data-motion-setting="duration"]').fill('2');
  await inspector.locator('[data-motion-setting="duration"]').dispatchEvent('change');
  await expect.poll(async () => (await clipOf(page, made.id)).duration).toBe(2);
  expect(await kindOf(page, made.id)).toBe('simple');
});
