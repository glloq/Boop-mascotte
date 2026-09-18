import { test, expect } from '@playwright/test';
import { openArtwork, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The selection box, around a mascot that is being posed
 * (docs/SELECTION_GIZMO.md, docs/STILL_WHILE_DESIGNING.md §1).
 *
 * Artwork holds the mascot still but leaves it **posable**: the puppet handles
 * are on, the head-pose pad turns the head, a movement slider moves a part. So
 * the transform a piece is drawn with is not the transform the project holds,
 * and the gizmo used to read the project's one — with the head turned, the
 * nose was painted seventy-four screen pixels away from its own box, every
 * handle with it.
 *
 * The arithmetic is held to in `core/tests/pose-transform.test.js`. What needs
 * a browser is that the box the author aims at is drawn around the artwork
 * they can see.
 */

/** Where the piece is painted, and where its box is drawn. */
const framed = (page, id) => page.evaluate((elementId) => {
  const art = document.querySelector(`#canvas svg svg #${elementId}`);
  const outline = document.querySelector('[data-gizmo-part="outline"]');
  const box = (node) => { if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
  return { art: box(art), gizmo: box(outline) };
}, id);

const select = (page, id) => page.evaluate((elementId) => {
  const button = document.querySelector(`[data-layer-id="${elementId}"] [data-action="select"]`);
  if (!button) throw new Error(`No layer row for ${elementId}`);
  button.click();
}, id);

/**
 * A point where this piece is genuinely the topmost painted thing.
 *
 * The centre of a bounding box is not a point on the piece: the template's
 * nose is a stroked arc with `fill="none"`, so its middle is the cheek behind
 * it, and a press there is a press on the cheek. The gizmo knows that — it
 * refuses to drag the body when the pointer is on somebody else's artwork —
 * so a drag test has to aim at ink.
 */
const inkOf = (page, id) => page.evaluate((elementId) => {
  const node = document.querySelector(`#canvas svg svg #${elementId}`);
  if (!node) throw new Error(`${elementId} is not on the canvas`);
  const b = node.getBoundingClientRect();
  const found = [];
  for (let gy = 1; gy < 24; gy++) for (let gx = 1; gx < 24; gx++) {
    const x = b.x + (b.width * gx) / 24, y = b.y + (b.height * gy) / 24;
    if (document.elementFromPoint(x, y) === node) found.push({ x, y });
  }
  if (!found.length) throw new Error(`No reachable point on ${elementId}: it is entirely under something else`);
  // The most central one. Near an edge the press lands within grabbing
  // distance of a resize handle, and the gizmo would scale the piece instead
  // of moving it -- which is correct behaviour and the wrong gesture to test.
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  found.sort((a, z) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(z.x - cx, z.y - cy));
  return found[0];
}, id);

/**
 * The centres agree, to within a pixel.
 *
 * Centres rather than corners: the box hugs the *inked* edge of a stroked
 * shape, which is half a stroke outside the geometry `getBoundingClientRect`
 * reports, so the two rectangles are concentric and not identical.
 */
function concentric(framedBoxes, why) {
  const { art, gizmo } = framedBoxes;
  expect(art, 'the artwork is on the canvas').toBeTruthy();
  expect(gizmo, 'and it has a selection box').toBeTruthy();
  expect(gizmo.x + gizmo.w / 2, `${why}: x`).toBeCloseTo(art.x + art.w / 2, 0);
  expect(gizmo.y + gizmo.h / 2, `${why}: y`).toBeCloseTo(art.y + art.h / 2, 0);
}

test('@critical the selection box follows the piece when the mascot is posed', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArtwork(page);
  await select(page, 'nose');
  const rest = await framed(page, 'nose');
  concentric(rest, 'at rest');

  // Turn the head, which is what the puppet handles and the head-pose pad do.
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('headX', 0.9));
  await expect.poll(async () => {
    const { art, gizmo } = await framed(page, 'nose');
    return Math.round(Math.abs((gizmo.x + gizmo.w / 2) - (art.x + art.w / 2)));
  }, { message: 'the box follows the turn' }).toBeLessThanOrEqual(1);
  const turned = await framed(page, 'nose');
  concentric(turned, 'head turned');
  // And it really did move. Without this the test would also pass on a canvas
  // where the turn did nothing at all, which is the one way a box and its
  // artwork can agree for the wrong reason. Measured against where the nose
  // started rather than an absolute pixel, so it holds at any window size.
  expect(turned.art.x - rest.art.x, 'the turn moved the nose a long way').toBeGreaterThan(20);

  // The other way, and back to centre.
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('headX', -0.7));
  await page.waitForTimeout(150);
  concentric(await framed(page, 'nose'), 'turned the other way');
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('headX', 0));
  await page.waitForTimeout(150);
  concentric(await framed(page, 'nose'), 'back at centre');
});

test('@critical a piece dragged while the head is turned keeps its resting artwork', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArtwork(page);
  // The face highlight, because the template moves it with the head by a plain
  // binding — `translateX = -7 · headX` — so the pose on it is exactly the
  // thing the commit has to take back out, and it is a large filled shape a
  // drag can grab by the middle.
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('headX', 0.8));
  await select(page, 'faceLight');
  await page.waitForTimeout(150);
  concentric(await framed(page, 'faceLight'), 'the box is on the moved highlight');

  const before = await page.evaluate(() => window.__BOOP_E2E__.state().elements.faceLight.baseTransform);
  const grab = await inkOf(page, 'faceLight');
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x + 60, grab.y + 30, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(250);

  const after = await page.evaluate(() => window.__BOOP_E2E__.state().elements.faceLight.baseTransform);
  expect(Math.abs(after.x - before.x), 'the drag moved the artwork').toBeGreaterThan(1);
  expect(Math.abs(after.y - before.y)).toBeGreaterThan(1);
  // And the turn is *not* in the artwork. Committing the drawn transform would
  // have written `-5.6` into `baseTransform.x` along with the drag, so the
  // highlight would slide again the moment the head came back to centre.
  expect(after.x, 'the binding’s own -5.6 is not in the artwork').toBeGreaterThan(before.x + 1);
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('headX', 0));
  await page.waitForTimeout(250);
  const rested = await page.evaluate(() => window.__BOOP_E2E__.state().elements.faceLight.baseTransform);
  expect(rested, 'resting the head authors nothing').toEqual(after);
  concentric(await framed(page, 'faceLight'), 'and the box is still on it at rest');
});
