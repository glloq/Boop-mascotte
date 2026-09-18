import { test, expect } from '@playwright/test';
import { openArtwork, openAssemble, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The eyes, in the browser: three builds, a box you can grab, and a blink
 * (docs/EYE_BUILDS.md).
 *
 * The complaint was two things and they turned out to be one:
 *
 * ```text
 * « les preset des yeux sont relativement similaire »
 * « le montage des yeux utilisent un cercle pour cacher les paupiere
 *   ⇒ il n'apparait nul part et je ne peut pas redimenssionner
 *      ou deplacer un ou plusieurs oeil ! »
 * ```
 *
 * Seventeen of the twenty-one pairs were one construction at different radii,
 * and that construction needed a `<clipPath>` in `<defs>` — invisible in the
 * layer tree and in `document.elements` — because its lids were drawn open and
 * parked *outside* the clip. So the eye's bounding box was three times the eye
 * and the selection handles sat a hundred pixels off it on every side. Both
 * halves go away together: a lid that grows about the rim it sits on needs no
 * mask, so the box is the eye.
 *
 * This is the half the unit suite cannot see, because it is about a box drawn
 * on a screen and a handle an author aims at.
 */

const state = (page) => page.evaluate(() => window.__BOOP_E2E__.state());
const partOfType = async (page, type) => Object.values((await state(page)).semanticParts).find((part) => part.type === type);

async function wear(page, id) {
  await openAssemble(page);
  const panel = page.locator('#face-library[data-face-library-ready="true"]');
  await expect(panel).toBeVisible();
  await panel.locator(`[data-face-library-card="${id}"] [data-face-library-wear]`).click();
  await expect(panel.locator(`[data-face-library-card="${id}"]`)).toHaveClass(/face-library-worn/);
}

/** What the canvas actually paints for one element, in screen pixels. */
const painted = (page, id) => page.evaluate((elementId) => {
  const node = document.querySelector(`#canvas svg svg #${elementId}`);
  if (!node) return null;
  const box = node.getBoundingClientRect();
  return { x: box.x, y: box.y, width: box.width, height: box.height };
}, id);

/** Where the selection gizmo has drawn its box. */
const gizmoBox = (page) => page.evaluate(() => {
  const outline = document.querySelector('[data-gizmo-part="outline"]');
  if (!outline) return null;
  const r = outline.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});

const select = (page, id) => page.evaluate((elementId) => {
  const button = document.querySelector(`[data-layer-id="${elementId}"] [data-action="select"]`);
  if (!button) throw new Error(`No layer row for ${elementId}`);
  button.click();
}, id);

test('@critical three builds, and each one\'s box is the eye it draws', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAssemble(page);
  const panel = page.locator('#face-library[data-face-library-ready="true"]');
  await expect(panel).toHaveAttribute('data-face-library-category', 'eyes');

  // Three, and named for what they draw rather than for a size or a mood.
  const ids = await panel.locator('[data-face-library-card]').evaluateAll(
    (cards) => cards.map((card) => card.dataset.faceLibraryCard).filter((id) => !id.includes('robot')));
  expect(ids).toEqual(['eyes.dot', 'eyes.simple', 'eyes.iris']);

  // Not one of the three previews carries a mask, where every retired set did.
  for (const id of ids) {
    const preview = await panel.locator(`[data-face-library-card="${id}"] svg.face-library-preview`).innerHTML();
    expect(preview, `${id} previews without a hidden mask`).not.toContain('<clipPath');
  }

  await wear(page, 'eyes.simple');
  const eyes = await partOfType(page, 'eyes');
  expect(await page.evaluate(() => window.__BOOP_E2E__.state().svgMarkup.includes('clipPath id="socket')),
    'and the drawing brings no socket onto the face').toBe(false);

  // The measurement the complaint was about. The eye group's painted box has to
  // *be* the eye: an old set's white measured 114 × 107 and its group reported
  // 219 × 321, because two lids were parked outside a mask.
  await openArtwork(page);
  const group = await painted(page, eyes.roles.leftEye);
  const white = await painted(page, 'eyeWhiteLeft');
  expect(group, 'the eye group is on the canvas').toBeTruthy();
  expect(white, 'and so is its white').toBeTruthy();
  expect(group.height, 'the group is no taller than the eye it draws').toBeLessThan(white.height * 1.1);
  expect(group.width).toBeLessThan(white.width * 1.1);
});

test('@critical a selection box lands on the eye, and dragging a handle resizes it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await wear(page, 'eyes.simple');
  await openArtwork(page);

  const eyes = await partOfType(page, 'eyes');
  await select(page, eyes.roles.leftEye);

  // The gizmo is where the eye is. A hundred pixels of parked lid used to sit
  // between the two, which is what made an eye impossible to grab.
  const box = await painted(page, eyes.roles.leftEye);
  const gizmo = await gizmoBox(page);
  expect(gizmo, 'a selection box is drawn').toBeTruthy();
  expect(Math.abs(gizmo.x - box.x), 'the box is on the eye, left').toBeLessThan(12);
  expect(Math.abs(gizmo.y - box.y), 'the box is on the eye, top').toBeLessThan(12);
  expect(Math.abs(gizmo.width - box.width), 'and is the eye\'s width').toBeLessThan(24);
  expect(Math.abs(gizmo.height - box.height), 'and its height').toBeLessThan(24);

  // And it resizes: one corner handle, dragged, changes the authored scale of
  // the eye and nothing else.
  const before = (await state(page)).elements[eyes.roles.leftEye].baseTransform;
  const handle = await page.locator('[data-gizmo-handle="se"]').boundingBox();
  expect(handle, 'a resize handle is drawn').toBeTruthy();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 - 24, handle.y + handle.height / 2 - 24, { steps: 8 });
  await page.mouse.up();
  const after = (await state(page)).elements[eyes.roles.leftEye].baseTransform;
  expect(after.scaleX !== before.scaleX || after.scaleY !== before.scaleY || after.x !== before.x || after.y !== before.y,
    `the drag changed the eye: ${JSON.stringify(before)} → ${JSON.stringify(after)}`).toBe(true);
});

test('@critical a lid grows across the eye to shut it, and rests exactly as drawn', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await wear(page, 'eyes.simple');
  await openArtwork(page);

  const eyes = await partOfType(page, 'eyes');
  const open = await painted(page, 'lidUpperLeft');
  const eye = await painted(page, 'eyeWhiteLeft');
  // Open, the lid is the sliver the artwork draws: a shade of skin on the rim.
  expect(open.height, 'an open eye shows a sliver of lid').toBeLessThan(eye.height * 0.35);

  // Shut, it covers the eye — and does not run past it onto the cheek. Measured
  // against the *shut* eye, because the eye squashes a little under a closing
  // lid, as a real one does and as the shipped sets did (the 0.88).
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('eyeOpen', 0));
  await page.waitForTimeout(200);
  const shut = await painted(page, 'lidUpperLeft');
  const squashed = await painted(page, 'eyeWhiteLeft');
  expect(squashed.height, 'the eye squashes a little rather than vanishing').toBeGreaterThan(eye.height * 0.8);
  expect(shut.height, 'a shut eye is covered by its lid').toBeGreaterThan(squashed.height * 0.95);
  expect(shut.height, 'and the lid stops on the far rim').toBeLessThan(squashed.height * 1.1);
  expect(shut.y, 'from the rim it swings from').toBeLessThan(squashed.y + 2);

  // Back open, the lid is where it was drawn: the live pose is a pose, and the
  // artwork it rests at is unchanged.
  await page.evaluate(() => window.__BOOP_E2E__.clearLiveParam('eyeOpen'));
  await page.waitForTimeout(160);
  const again = await painted(page, 'lidUpperLeft');
  expect(Math.abs(again.height - open.height), 'and rests exactly as drawn').toBeLessThan(1.5);
  expect((await state(page)).semanticParts[eyes.id].controlDrivers.eyeOpen, 'the eyes still carry the blink').toBeTruthy();
});

/**
 * The template's own eyes, which is what an author opens the editor on.
 *
 * The library's cards were half the complaint; the default mascot was the other
 * half, and it had the same socket. Three things had to become true, and the
 * third was not about the eyes at all:
 *
 * ```text
 * 1  the clip an author cannot see is gone
 * 2  the eye's box is the eye, so the handles land on it
 * 3  a group you can select is a group you can drag
 * ```
 */
test('@critical the template eye has no socket, and its box is the eye', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArtwork(page);

  // The clip used to live in `<defs>`: in the markup, and in neither the layer
  // tree nor `document.elements`. Unseeable, unmovable, undeletable.
  expect(await page.evaluate(() => /clipPath id="eyeSocket/.test(window.__BOOP_E2E__.state().svgMarkup)),
    'the socket is gone from the drawing').toBe(false);
  expect(await page.evaluate(() => Object.keys(window.__BOOP_E2E__.state().elements).filter((id) => /socket/i.test(id))),
    'and there is nothing socket-shaped left to look for').toEqual([]);

  // 191 x 281 around an eye of 100 x 94, because two lids were parked outside
  // the clip. Now the group is the eye it draws.
  const group = await painted(page, 'eyeLeft');
  const white = await painted(page, 'eyeWhiteLeft');
  expect(group.height).toBeLessThan(white.height * 1.05);
  expect(group.width).toBeLessThan(white.width * 1.05);
  // And each lid is a sliver on its own rim, inside the eye, not a slab above it.
  const lid = await painted(page, 'lidUpperLeft');
  expect(lid.height).toBeLessThan(white.height * 0.2);
  expect(lid.y).toBeGreaterThanOrEqual(white.y - 1);
});

test('@critical an eye can be grabbed and moved, which is what a group is for', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArtwork(page);
  await select(page, 'eyeLeft');

  // The box is on the eye, where a hundred pixels of parked lid used to sit
  // between the two.
  const box = await painted(page, 'eyeLeft');
  const gizmo = await gizmoBox(page);
  expect(Math.abs(gizmo.x - box.x)).toBeLessThan(10);
  expect(Math.abs(gizmo.height - box.height)).toBeLessThan(20);

  // A point on the white, genuinely inside the selected eye.
  const at = { x: gizmo.x + gizmo.width * 0.28, y: gizmo.y + gizmo.height * 0.62 };
  expect(await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id, [at.x, at.y]),
    'the pointer is genuinely on a child of the eye').toBe('eyeWhiteLeft');

  // A plain *click* there reaches the shape under the pointer, which is what a
  // vector editor is for: the rule below is about the gesture, not the target.
  await page.mouse.click(at.x, at.y);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.session().selectedId)).toBe('eyeWhiteLeft');

  // Dragged, the same press moves the **eye**, and the selection does not jump
  // to the white. A group is covered by its own children, so without this there
  // is no point on it that is not on one of them -- an eye an author could
  // select and never move.
  await select(page, 'eyeLeft');
  const before = await page.evaluate(() => window.__BOOP_E2E__.state().elements.eyeLeft.baseTransform);
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await page.mouse.move(at.x + 30, at.y + 10, { steps: 8 });
  await page.mouse.up();
  const after = await page.evaluate(() => window.__BOOP_E2E__.state().elements.eyeLeft.baseTransform);
  expect(await page.evaluate(() => window.__BOOP_E2E__.session().selectedId), 'the eye is still what is selected').toBe('eyeLeft');
  expect(Math.hypot(after.x - before.x, after.y - before.y), `the eye moved: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`).toBeGreaterThan(5);
  expect([after.pivotX, after.pivotY], 'and its pivot stayed put').toEqual([before.pivotX, before.pivotY]);
});

test('@critical the template blinks by growing its lids, and a shut eye is a seam', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArtwork(page);

  const open = { lid: await painted(page, 'lidUpperLeft'), crease: await painted(page, 'creaseUpperLeft'), eye: await painted(page, 'eyeWhiteLeft') };
  expect(open.crease, 'each lid draws its edge as its own line').toBeTruthy();

  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('eyeOpen', 0));
  await page.waitForTimeout(220);
  const shut = { lid: await painted(page, 'lidUpperLeft'), crease: await painted(page, 'creaseUpperLeft'), eye: await painted(page, 'eyeWhiteLeft') };

  // The lid grows from its sliver to half the eye and stops on the seam, where
  // the lower lid has come up to meet it.
  expect(shut.lid.height).toBeGreaterThan(open.lid.height * 4);
  expect(shut.lid.y, 'from the rim it swings from').toBeLessThan(shut.eye.y + 2);
  expect(shut.lid.y + shut.lid.height, 'to the middle of the eye, not past it')
    .toBeLessThan(shut.eye.y + shut.eye.height * 0.62);
  const lower = await painted(page, 'lidLowerLeft');
  expect(lower.y, 'and the lower lid meets it there').toBeLessThan(shut.lid.y + shut.lid.height + 4);
  // The crease rides its lid exactly: it *is* the lid's edge, so the lowest
  // point of the line is the lowest point of the skin it draws the edge of.
  expect(Math.abs((shut.crease.y + shut.crease.height) - (shut.lid.y + shut.lid.height))).toBeLessThan(6);

  // And the eye's own outline goes out with the light: a shut cartoon eye is a
  // line, not a circle with a line through it.
  expect(await page.evaluate(() => window.__BOOP_E2E__.state().elements.rimLeft.bindings.opacity.expression)).toBe('eyeOpen + eyeOpenLeft');

  await page.evaluate(() => window.__BOOP_E2E__.clearLiveParam('eyeOpen'));
  await page.waitForTimeout(220);
  expect(Math.abs((await painted(page, 'lidUpperLeft')).height - open.lid.height), 'and rests exactly as drawn').toBeLessThan(1.5);
});
