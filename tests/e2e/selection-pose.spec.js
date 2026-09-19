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
 * it. The gizmo will now drag from there — what is *behind* the selection is
 * background, and the box is the author's claim on that area — but a press on
 * ink is what a person aiming at a shape does, so a drag test aims at ink.
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

/**
 * An edit shows at once, and stays.
 *
 * ```text
 * « les modification ne sont pas mise a jour directement, et retourne a
 *   l'etat precedent après selection d'un autre element »
 * ```
 *
 * Two faults, one cause each. The box was drawn from the channels the last
 * *frame* wrote, and a typed field is not a frame — so the nose moved and its
 * handles stayed a hundred pixels behind, for good: re-selecting it read the
 * same stale entry. And the canvas had armed a rebuild against itself, by
 * writing markup into the store without recording what it wrote, so the next
 * unrelated change reloaded the artwork from that older markup and every edit
 * made since came undone. Selecting another piece was enough to trigger it.
 */
test('@critical a typed edit moves the artwork, takes its box with it, and stays put', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArtwork(page);
  await select(page, 'nose');
  concentric(await framed(page, 'nose'), 'before the edit');
  const before = await framed(page, 'nose');

  const field = page.locator('#inspector input[data-transform="x"]');
  await field.fill('40');
  await field.press('Enter');
  await expect.poll(async () => Math.round((await framed(page, 'nose')).art.x - before.art.x),
    { message: 'the artwork moves' }).toBeGreaterThan(20);
  const moved = await framed(page, 'nose');
  concentric(moved, 'straight after the edit');

  // The part that used to come undone: look at something else, then come back.
  await select(page, 'mouth');
  await select(page, 'nose');
  const later = await framed(page, 'nose');
  expect(Math.round(later.art.x), 'the nose stayed where it was put').toBe(Math.round(moved.art.x));
  expect(later.art.x - before.art.x, 'and did not slide back').toBeGreaterThan(20);
  concentric(later, 'after selecting something else and back');
  await expect(page.locator('#inspector input[data-transform="x"]')).toHaveValue('40');
});

/**
 * A piece you have selected drags from the middle of its own box.
 *
 * The rule was "the pointer is on somebody else's artwork, so select that
 * instead", which is right for the mouth inside the head's box and wrong for
 * everything thin. A nose is a stroked arc: the middle of its own box is the
 * cheek showing through, so pressing the middle of the thing you had just
 * selected deselected it and picked the face. Paint order decides now — what
 * is behind the selection is background, what is in front of it is a piece the
 * author can see and is more likely reaching for.
 */
test('@critical the middle of a selected piece drags it, even where another piece shows through', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArtwork(page);
  await select(page, 'nose');
  const start = await framed(page, 'nose');
  const middle = { x: start.gizmo.x + start.gizmo.w / 2, y: start.gizmo.y + start.gizmo.h / 2 };
  // The premise: that point is somebody else's paint, and somebody drawn
  // *before* the nose -- the cheek showing through the arc.
  const under = await page.evaluate((point) => {
    const node = document.elementFromPoint(point.x, point.y), nose = document.querySelector('#canvas svg svg #nose');
    return { id: node?.id || '', behind: Boolean(node && nose && (nose.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_PRECEDING)) };
  }, middle);
  expect(under.id, 'the middle of the nose box is not the nose').not.toBe('nose');
  expect(under.behind, `${under.id} is painted behind the nose`).toBe(true);

  await page.mouse.move(middle.x, middle.y);
  await page.mouse.down();
  await page.mouse.move(middle.x + 45, middle.y + 20, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => Math.round((await framed(page, 'nose')).art.x - start.art.x),
    { message: 'the nose went with the pointer' }).toBeGreaterThan(30);
  expect(await page.evaluate(() => window.__BOOP_E2E__.session().selectedId), 'and it is still the selection').toBe('nose');
  concentric(await framed(page, 'nose'), 'after the drag');

  // The rule it was written for still holds: the mouth is painted over the
  // head, so a press there picks the mouth rather than dragging the head.
  await select(page, 'head');
  const mouth = await page.evaluate(() => { const r = document.querySelector('#canvas svg svg #mouth').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  await page.mouse.click(mouth.x, mouth.y);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.session().selectedId),
    { message: 'a press on a piece in front selects it' }).toBe('mouth');
});
