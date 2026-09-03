import { test, expect } from '@playwright/test';
import { openFreshEditor, openSetupSection, startBasicFace } from './editor-helpers.js';

/**
 * The 2.5D head turn (docs/HEAD_POSE_2_5D.md).
 *
 * The grid shipped empty, so `headX` only ran its own binding and turning the
 * head slid it sideways. These are the two things that were wrong, in the
 * browser: no turn to be had, and a pad whose vertical axis was inverted.
 */
const setParam = (page, name, value) => page.evaluate(([n, v]) => window.__BOOP_E2E__.setLiveParam(n, v), [name, value]);
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const shift = (page, id) => page.evaluate((elementId) => {
  const node = document.querySelector(`#canvas #${elementId}`);
  if (!node) return null;
  const match = /translate\(([-\d.]+) ([-\d.]+)\).*scale\(([-\d.]+) ([-\d.]+)\)/.exec(node.getAttribute('transform') || '');
  return match ? { x: Number(match[1]), y: Number(match[2]), scaleX: Number(match[3]), scaleY: Number(match[4]) } : null;
}, id);

async function openHeadPose(page) {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openSetupSection(page, 'head-pose');
  await expect(page.locator('#head-pose[data-head-pose-ready="true"]')).toBeVisible();
}

test('@critical a generated turn makes headX turn the head instead of sliding it', async ({ page }) => {
  await openHeadPose(page);
  const panel = page.locator('#head-pose');
  await expect(panel).toHaveAttribute('data-head-pose-captured', '0');
  await expect(panel).toContainText('only slides the head sideways');

  // Before: the head translates and nothing inside it moves at all.
  await setParam(page, 'headX', 1);
  expect((await shift(page, 'faceRoot')).x).toBeGreaterThan(0);
  expect(await shift(page, 'pupilLeft')).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
  expect(await shift(page, 'mouth')).toEqual({ x: 0, y: 0, scaleX: 1, scaleY: 1 });
  await setParam(page, 'headX', 0);

  await panel.getByRole('button', { name: 'Generate turn' }).click();
  await expect(panel).toHaveAttribute('data-head-pose-captured', '9', 'nine positions');
  await expect(panel).toContainText('Turn generated from');
  const keyforms = (await documentOf(page)).keyforms;
  expect(keyforms.length).toBeGreaterThan(0);
  expect(keyforms.every((keyform) => keyform.id.startsWith('headPose:'))).toBe(true);

  // After: the features travel further than the outline, the deeper the more,
  // and the two halves of a pair no longer do the same thing.
  await setParam(page, 'headX', 1);
  const [face, eyeL, eyeR, mouth] = await Promise.all(['faceRoot', 'eyeLeft', 'eyeRight', 'mouth'].map((id) => shift(page, id)));
  expect(mouth.x).toBeGreaterThan(eyeL.x);
  expect(eyeL.x).toBeGreaterThan(0);
  expect(face.scaleX).toBeLessThan(1);
  expect(eyeL.scaleX).toBeGreaterThan(1);
  expect(eyeR.scaleX).toBeLessThan(1);

  // Turning the other way is the mirror of it.
  await setParam(page, 'headX', -1);
  const mirrored = await shift(page, 'eyeRight');
  expect(mirrored.scaleX).toBeCloseTo(eyeL.scaleX, 5);

  // Halfway is halfway: it is an ordinary keyform grid.
  await setParam(page, 'headX', 0.5);
  const half = await shift(page, 'mouth');
  expect(half.x).toBeGreaterThan(0);
  expect(half.x).toBeLessThan(mouth.x);

  // And it is one undo step.
  await setParam(page, 'headX', 0);
  await page.keyboard.press('Control+z');
  await expect(panel).toHaveAttribute('data-head-pose-captured', '0');
  expect((await documentOf(page)).keyforms).toEqual([]);
});

test('the pad moves the head the way it is dragged', async ({ page }) => {
  await openHeadPose(page);
  const pad = page.locator('[data-head-pad]');
  await pad.scrollIntoViewIfNeeded();
  const box = await pad.boundingBox();
  const dragTo = async (x, y) => {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 5 });
    await page.mouse.up();
  };

  // `headY` grows downwards, so up is negative — and the head has to follow the
  // handle, not fight it.
  await dragTo(0.5, 0.02);
  expect((await shift(page, 'faceRoot')).y).toBeLessThan(0);
  await expect(page.locator('[data-head-live]')).toContainText('up');

  await dragTo(0.5, 0.98);
  expect((await shift(page, 'faceRoot')).y).toBeGreaterThan(0);
  await expect(page.locator('[data-head-live]')).toContainText('down');

  await dragTo(0.98, 0.5);
  expect((await shift(page, 'faceRoot')).x).toBeGreaterThan(0);
  await expect(page.locator('[data-head-live]')).toContainText('right');

  // Nothing of this is authored: the pad is a live preview.
  expect((await documentOf(page)).keyforms).toEqual([]);
});
