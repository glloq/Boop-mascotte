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
/** What is actually on screen: the box the user sees, not the transform we wrote. */
const onScreen = (page, id) => page.evaluate((elementId) => {
  const box = document.querySelector(`#canvas #${elementId}`)?.getBoundingClientRect();
  return box ? { cx: box.x + box.width / 2, w: box.width } : null;
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
  // The template ships the turn generated. Clearing the grid is its exact
  // inverse — it hands headX back to the head's own translate binding — which
  // is the state an imported drawing starts in.
  await expect(panel).toHaveAttribute('data-head-pose-captured', '9');
  await panel.getByRole('button', { name: 'Reset all' }).click();
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

/**
 * The assertions above are all about signs — something moved, something got
 * narrower — and they passed for a year while the effect on screen was still a
 * slide. What was missing is size: the head's own translate binding kept
 * sliding the whole face, and the parallax on top of it was a few per cent.
 * These measure the rendered boxes, so "it only moves the head" cannot pass.
 */
test('@critical the turn reads as a turn and not as a slide', async ({ page }) => {
  await openHeadPose(page);
  // Already generated: the template ships the turn (docs/HEAD_POSE_2_5D.md).
  await expect(page.locator('#head-pose')).toHaveAttribute('data-head-pose-captured', '9');

  await setParam(page, 'headX', 0);
  const rest = Object.fromEntries(await Promise.all(['faceRoot', 'head', 'eyeLeft', 'eyeRight', 'mouth']
    .map(async (id) => [id, await onScreen(page, id)])));
  await setParam(page, 'headX', 1);
  const turned = Object.fromEntries(await Promise.all(['faceRoot', 'head', 'eyeLeft', 'eyeRight', 'mouth']
    .map(async (id) => [id, await onScreen(page, id)])));

  const headWidth = rest.faceRoot.w;
  const travel = (id) => turned[id].cx - rest[id].cx;

  // The outline barely goes anywhere: a turn is not a translation. Measured on
  // the head shape rather than the whole group, whose box also holds the ear
  // tucking away behind it.
  expect(travel('head')).toBeGreaterThan(0);
  expect(travel('head')).toBeLessThan(headWidth * 0.05);

  // The features do, by a large multiple of it, deeper features furthest.
  expect(travel('mouth')).toBeGreaterThan(travel('head') * 3);
  expect(travel('eyeLeft')).toBeGreaterThan(travel('head') * 3);
  expect(travel('mouth')).toBeGreaterThan(travel('eyeLeft'));

  // The far side compresses hard — the strongest cue that this is a rotation.
  expect(turned.eyeRight.w).toBeLessThan(rest.eyeRight.w * 0.7);
  expect(turned.eyeLeft.w).toBeGreaterThan(turned.eyeRight.w * 1.4);
  // And so do the outline and anything drawn on the middle line.
  expect(turned.faceRoot.w).toBeLessThan(headWidth * 0.95);
  expect(turned.mouth.w).toBeLessThan(rest.mouth.w * 0.9);

  // The head's own translate binding is off: `headX` drove a slide and a turn
  // at once, and the slide is what the eye saw.
  const faceRoot = (await documentOf(page)).elements.faceRoot;
  expect(faceRoot.bindings.translateX.enabled).toBe(false);
  expect(faceRoot.bindings.translateY.enabled).toBe(false);

  // Clearing the grid is the exact inverse: headX goes back to the head's own
  // binding rather than being left driving nothing at all.
  await setParam(page, 'headX', 0);
  await page.locator('#head-pose').getByRole('button', { name: 'Reset all' }).click();
  await expect(page.locator('#head-pose')).toHaveAttribute('data-head-pose-captured', '0');
  expect((await documentOf(page)).elements.faceRoot.bindings.translateX.enabled).toBe(true);
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

  // Nothing of this is authored: the pad is a live preview, and the grid it
  // shipped with is untouched.
  expect((await documentOf(page)).keyforms.length).toBe(120);
});

test('@critical the turn moves both sides of the face the same way', async ({ page }) => {
  await openHeadPose(page);
  // Already generated: the template ships the turn (docs/HEAD_POSE_2_5D.md).
  await expect(page.locator('#head-pose')).toHaveAttribute('data-head-pose-captured', '9');
  await setParam(page, 'headX', 1);

  const pairs = await page.evaluate(() => {
    const read = (id) => { const node = document.querySelector(`#canvas #${id}`); if (!node) return null; const match = /translate\(([-\d.]+) ([-\d.]+)\).*scale\(([-\d.]+)/.exec(node.getAttribute('transform') || ''); return match ? { x: Number(match[1]), scaleX: Number(match[3]) } : null; };
    return { eyeL: read('eyeLeft'), eyeR: read('eyeRight'), pupilL: read('pupilLeft'), pupilR: read('pupilRight'), face: read('faceRoot'), mouth: read('mouth') };
  });

  // The two halves of a pair travel together. They used to differ wildly —
  // the correction that held a part's centre under an off-centre scale grew
  // with its distance from the origin, so one pupil moved 0.9 and the other
  // 26.5, and all that read as was the head sliding sideways.
  expect(pairs.eyeL.x).toBeCloseTo(pairs.eyeR.x, 3);
  expect(pairs.pupilL.x).toBeCloseTo(pairs.pupilR.x, 3);
  // What differs between them is the foreshortening, which is the turn itself.
  expect(pairs.eyeL.scaleX).toBeGreaterThan(1);
  expect(pairs.eyeR.scaleX).toBeLessThan(1);
  // And the deeper a feature is, the further it travels.
  expect(Math.abs(pairs.mouth.x)).toBeGreaterThan(Math.abs(pairs.eyeL.x));

  // Generating set the pivots that make a scale turn a part instead of
  // sliding it, and that is part of the same undo step.
  const pivots = await page.evaluate(() => ({ eyeLeft: window.__BOOP_E2E__.document().elements.eyeLeft.baseTransform, faceRoot: window.__BOOP_E2E__.document().elements.faceRoot.baseTransform }));
  expect(pivots.eyeLeft.pivotX).toBeGreaterThan(0);
  expect(pivots.faceRoot.pivotX).toBeGreaterThan(0);
});

test('the canvas offers the turn where the head is dragged', async ({ page }) => {
  await openHeadPose(page);
  // With an empty grid `headX` only slides the head, and that is exactly where
  // to say so: on the mascot, next to the handle being dragged. The template
  // ships the grid filled, so clear it to reach that state.
  await page.locator('#head-pose').getByRole('button', { name: 'Reset all' }).click();
  const offer = page.locator('[data-halo-generate]');
  await expect(offer).toBeVisible();
  await offer.click();
  await expect(page.locator('#head-pose')).toHaveAttribute('data-head-pose-captured', '9');
  await expect(offer).toHaveCount(0);
  await expect(page.locator('.puppet-halo [data-halo-cell]')).toHaveCount(9);
});
