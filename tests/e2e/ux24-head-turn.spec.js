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
  // 120 transform records plus the 19 depth ones a projected turn writes (3D-08).
  expect((await documentOf(page)).keyforms.length).toBe(139);
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


/**
 * A position can hold the artwork's *outline*, not only the box around it
 * (3D-06). It is stored as a `pathShape` keyform over an ordinary additive
 * shape key, so what proves it is the `d` on the canvas changing with `headX`
 * — which nothing but a shape can do.
 */
const attrOf = (page, id, name) => page.evaluate(([i, a]) => document.querySelector(`#canvas #${i}`)?.getAttribute(a), [id, name]);
const centreOf = (page, selector) => page.evaluate((s) => { const box = document.querySelector(s).getBoundingClientRect(); return { x: box.x + box.width / 2, y: box.y + box.height / 2 }; }, selector);
const paramsNow = (page) => page.evaluate(() => window.__BOOP_E2E__.effectiveParams());

/** Put the mascot at a position of the grid, whatever the axes happen to be. */
async function goTo(page, values) {
  for (const name of ['headX', 'headY']) await setParam(page, name, values[name]);
}

async function dragBy(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

test('@critical a head position can hold an outline, and the turn deforms it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  // What a position reshapes is real artwork, picked the way anything is.
  const mouth = await centreOf(page, '#canvas #mouth');
  await page.mouse.click(mouth.x, mouth.y);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.session().selectedId)).toBe('mouth');

  await openSetupSection(page, 'head-pose');
  const panel = page.locator('#head-pose');
  await expect(panel).toHaveAttribute('data-head-pose-ready', 'true');

  // Rest, and one position that is not rest. Both are read off the grid rather
  // than assumed: the axes are ordinary keyform axes and may be retuned, and
  // which cell means what is a convention this test has no business fixing.
  const rest = await paramsNow(page);
  await panel.locator('[data-head-cell]:not([aria-pressed="true"])').first().click();
  const turned = await paramsNow(page);
  expect(turned).not.toEqual(rest);

  // Before: the turn moves the outline and squashes its box, but the shape it
  // draws is the same shape everywhere. That is the whole gap this closes.
  await goTo(page, rest);
  const drawn = await attrOf(page, 'mouth', 'd');
  await goTo(page, turned);
  expect(await attrOf(page, 'mouth', 'd')).toBe(drawn);

  // The offer lives in the panel the author already has open, at the tier that
  // names artwork: new function, not a new panel.
  const section = panel.locator('[data-disclosure="head-pose-shape"]');
  await expect(section).toHaveAttribute('data-disclosure-level', 'advanced');
  await section.locator(':scope > summary').click();
  await section.getByRole('button', { name: /Shape mouth here/ }).click();
  await expect(page.locator('#canvas')).toHaveClass(/rig-morph-pose/);

  // The session's own handles, by what they are called: `.rig-node-handle` is
  // also what a hand anchor wears, and one of those is on the page, hidden.
  const handle = page.locator('.rig-node-handle[aria-label^="Path node"]').first();
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  await dragBy(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 0, -30);
  // From the keyboard: the pose dots the canvas draws around the head handle
  // are painted over the banner, and pressing a focused button is a real way to
  // press it -- the editor has a keyboard gate for exactly that reason.
  await page.locator('[data-canvas-mode-capture]').focus();
  await page.keyboard.press('Enter');
  await expect(panel).toHaveAttribute('data-head-pose-shapes', '1');

  // After: rest is still the drawing, the captured position is not, and between
  // them is neither — an ordinary keyform grid, on an ordinary shape key.
  await goTo(page, rest);
  expect(await attrOf(page, 'mouth', 'd')).toBe(drawn);
  await goTo(page, turned);
  const deformed = await attrOf(page, 'mouth', 'd');
  expect(deformed).not.toBe(drawn);
  expect(deformed).not.toContain('NaN');
  await goTo(page, Object.fromEntries(Object.entries(turned).map(([name, value]) => [name, (value + rest[name]) / 2])));
  const between = await attrOf(page, 'mouth', 'd');
  expect(between).not.toBe(drawn);
  expect(between).not.toBe(deformed);

  // Nothing head-pose-shaped reached the runtime: a shape key and the
  // `pathShape` keyform that weights it, which is what plays an export back.
  const stored = await documentOf(page);
  const shape = stored.shapeKeys.find((key) => key.target === 'mouth' && key.id.startsWith('headPose'));
  expect(shape).toBeTruthy();
  const weight = stored.keyforms.find((keyform) => keyform.channel === 'pathShape' && keyform.shapeKey === shape.id);
  expect(weight).toBeTruthy();
  expect(weight.axes.map((axis) => axis.parameter)).toEqual(['headX', 'headY']);
  expect(stored.elements.mouth.restPath).toBeTruthy();

  // And regenerating the movement leaves the outline alone: a generated turn is
  // transform channels, and an authored shape is a channel of its own.
  await panel.getByRole('button', { name: 'Regenerate turn' }).click();
  await expect(panel).toHaveAttribute('data-head-pose-shapes', '1');
  const after = await documentOf(page);
  expect(after.keyforms.find((keyform) => keyform.id === weight.id)).toEqual(weight);
  await goTo(page, turned);
  expect(await attrOf(page, 'mouth', 'd')).toBe(deformed);
});

/**
 * Secondary motion (3D-10, docs/SECONDARY_MOTION.md). The lag itself is unit
 * tested against the spring; what only the browser can show is that pressing
 * Generate turn writes it, that the checkbox takes it away again, and that it
 * reaches the file the author ships.
 */
test('@critical generating a turn also makes the hair and ears arrive late', async ({ page }) => {
  await openHeadPose(page);
  const followers = (document) => (document.followers || []).map((item) => item.element).sort();

  // The template ships them, because the template ships the turn.
  const shipped = followers(await documentOf(page));
  expect(shipped.length, 'nothing trails behind the head').toBeGreaterThan(0);
  for (const element of shipped) expect(element).toMatch(/hair|ear/i);

  // Every one of them is switched on, aimed at the head, and has a spring that
  // can actually move: a follower that cannot catch up is a part coming off.
  for (const follower of (await documentOf(page)).followers) {
    expect(follower.enabled).toBe(true);
    expect(follower.parameterX).toBe('headX');
    expect(follower.inertia.stiffness).toBeGreaterThan(0);
    expect(Math.abs(follower.amount.x)).toBeGreaterThan(0);
  }

  // It travels: this is what the author ships, not editor state.
  const exported = await page.evaluate(() => JSON.parse(window.__BOOP_E2E__.exportArtifacts().find((item) => item.name === 'rig.json').content));
  expect(followers(exported)).toEqual(shipped);

  // And it is a choice, not a fact of life. Clearing the box and regenerating
  // takes it away in one undoable step.
  await page.locator('[data-head-trail]').uncheck();
  await page.locator('[data-head-action="generate"]').click();
  await expect.poll(async () => followers(await documentOf(page))).toEqual([]);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => followers(await documentOf(page))).toEqual(shipped);
});
