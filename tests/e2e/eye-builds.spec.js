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
 * and that construction had a `<clipPath>` of an anonymous ellipse in `<defs>`
 * — invisible in the layer tree and in `document.elements` — with its lids
 * drawn open and parked *outside* the clip. So the eye's bounding box was
 * three times the eye and the selection handles sat a hundred pixels off it.
 *
 * The **box** is fixed by where a lid is drawn: on the rim it swings from,
 * inside the eye at rest and inside it shut. The **cut** is still there,
 * because a lid sweeping across an ellipse is wider than the ellipse
 * everywhere but its middle — what changed is that the shape doing the cutting
 * is the eye's own white, referenced (`<use href="#eyeWhite…">`). It has a
 * name, a row in the layer tree and a selection box; move it and the cut
 * moves. What you see is what cuts.
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

  // Each lidded preview carries its own socket, made of its own white: a card
  // that cut with a copy of the shape could drift from it, and one that shared
  // an id with the card beside it would cut to that card's eye.
  for (const id of ['eyes.simple', 'eyes.iris']) {
    const preview = await panel.locator(`[data-face-library-card="${id}"] svg.face-library-preview`).innerHTML();
    const prefix = `preview-${id.replace('.', '-')}-`;
    expect(preview, `${id} cuts with its own white`).toContain(`href="#${prefix}eyeWhiteLeft"`);
    expect(preview, `${id} borrows nobody's socket`).not.toContain('"#eyeWhiteLeft"');
  }
  const dot = await panel.locator('[data-face-library-card="eyes.dot"] svg.face-library-preview').innerHTML();
  expect(dot, 'a dot has no white to be cut by, and no lid to cut').not.toContain('<clipPath');

  await wear(page, 'eyes.simple');
  const eyes = await partOfType(page, 'eyes');

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

  // Shut, the two lids cover the eye between them and neither runs past it onto
  // the cheek — the cut sees to that. Measured against the *shut* eye, because
  // the eye squashes a little under a closing lid, as a real one does and as
  // the shipped sets did (the 0.88).
  //
  // The upper one covers down to the seam and the lower up to it, which is a
  // little over half each. It is tempting to ask the upper lid for the whole
  // eye -- a real blink is mostly the upper lid -- but then the two edges never
  // coincide and a shut eye keeps a white wedge in each corner. What reads as
  // "mostly the upper lid" is the seam sitting below the middle.
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('eyeOpen', 0));
  await page.waitForTimeout(200);
  const shut = await painted(page, 'lidUpperLeft');
  const below = await painted(page, 'lidLowerLeft');
  const squashed = await painted(page, 'eyeWhiteLeft');
  expect(squashed.height, 'the eye squashes a little rather than vanishing').toBeGreaterThan(eye.height * 0.8);
  expect(shut.height, 'the upper lid reaches past the middle of the eye').toBeGreaterThan(squashed.height * 0.5);
  expect(shut.height, 'and stops at the seam rather than running onto the cheek').toBeLessThan(squashed.height * 0.8);
  expect(shut.y, 'from the rim it swings from').toBeLessThan(squashed.y + 2);
  // Between them, every row of the eye: the two edges land on one seam.
  expect(shut.y + shut.height, 'the two lids leave a gap between them').toBeGreaterThanOrEqual(below.y - 1);
  expect(below.y + below.height, 'and the lower one reaches the bottom of the eye')
    .toBeGreaterThanOrEqual(squashed.y + squashed.height - 2);

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
test('@critical the socket is a drawing an author can find, and the eye\'s box is the eye', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArtwork(page);

  // The clip used to be an anonymous ellipse in `<defs>`: in the markup, and in
  // neither the layer tree nor `document.elements`. Unseeable, unmovable,
  // undeletable. It is the eye's own white now, referenced -- so the shape that
  // cuts is a drawing with a name, a row and a selection box.
  const socket = await page.evaluate(() => {
    const document_ = window.__BOOP_E2E__.state();
    const clip = /<clipPath id="eyeSocketLeft">([\s\S]*?)<\/clipPath>/.exec(document_.svgMarkup);
    return {
      clip: Boolean(clip && /<use[^>]+href="#eyeWhiteLeft"/.test(clip[1])),
      copies: Boolean(clip && /<(ellipse|path|circle|rect)/.test(clip[1])),
      white: Boolean(document_.elements.eyeWhiteLeft),
      cut: Boolean(document_.elements.lidsLeft)
    };
  });
  expect(socket.clip, 'the cut is a `use` of the white').toBe(true);
  expect(socket.copies, 'and never a second copy of the shape').toBe(false);
  expect(socket.white, 'so the shape that cuts is an element an author can select').toBe(true);
  expect(socket.cut, 'and the pieces it cuts are grouped, because a lid carrying the cut would scale it').toBe(true);

  // What is cutting a lid is said out loud, by name, where an author is already
  // looking: the layer tree names the socket, and the menu on the artwork names
  // what cuts the piece under the pointer (docs/VECTOR_EDITING.md).
  const named = await page.evaluate(() => window.__BOOP_E2E__.document().layers);
  const find = (nodes) => nodes.flatMap((node) => [node, ...find(node.children || [])]);
  expect(find(named).find((layer) => layer.id === 'eyeWhiteLeft')?.name).toBe('Left eye socket');

  // 191 x 281 around an eye of 100 x 94, because two lids were parked outside
  // the clip. Now the group is the eye it draws.
  const group = await painted(page, 'eyeLeft');
  const white = await painted(page, 'eyeWhiteLeft');
  expect(group.height).toBeLessThan(white.height * 1.05);
  expect(group.width).toBeLessThan(white.width * 1.05);
  // And each lid is a band on its own rim, inside the eye, not a slab above it.
  const lid = await painted(page, 'lidUpperLeft');
  expect(lid.height).toBeLessThan(white.height * 0.2);
  expect(lid.y).toBeGreaterThanOrEqual(white.y - 1);
});

/**
 * A shut eye is shut, and a half-shut one stays inside its own outline.
 *
 * ```text
 * « les yeux sont quand meme vachement laid, les paupieres depassent des yeux
 *   et ne se ferme pas bien »
 * ```
 *
 * Two faults, measured here because both are about pixels on a canvas. A lid
 * scaled in `y` alone keeps its full width, so at a quarter shut it hung past
 * the outline on both sides; and two lid edges that bulge towards each other
 * meet in the middle and leave a white wedge at each corner, so a "closed" eye
 * was a pair of white slivers with two curves crossing over them.
 */
test('@critical a closing eye stays inside its outline, and a shut one shows no eye', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArtwork(page);
  const set = (value) => page.evaluate((v) => window.__BOOP_E2E__.setLiveParam('eyeOpen', v), value);

  const white = await painted(page, 'eyeWhiteLeft');
  for (const value of [0.75, 0.5, 0.25, 0]) {
    await set(value);
    await page.waitForTimeout(160);
    for (const id of ['lidUpperLeft', 'lidLowerLeft', 'creaseUpperLeft', 'creaseLowerLeft']) {
      const box = await painted(page, id);
      if (!box) continue;
      // Two pixels of slack for the crease's own stroke, which is drawn on the
      // line rather than inside it.
      expect(box.x, `eyeOpen ${value}: ${id} hangs off the left of the eye`).toBeGreaterThanOrEqual(white.x - 2);
      expect(box.x + box.width, `eyeOpen ${value}: ${id} hangs off the right of the eye`).toBeLessThanOrEqual(white.x + white.width + 2);
      expect(box.y, `eyeOpen ${value}: ${id} is above the eye`).toBeGreaterThanOrEqual(white.y - 2);
      expect(box.y + box.height, `eyeOpen ${value}: ${id} is below the eye`).toBeLessThanOrEqual(white.y + white.height + 2);
    }
  }

  // And shut is shut: the two lids cover every row of the eye, corners
  // included. Sampled down the eye's own widest line, where the wedges were.
  const skin = await page.evaluate(() => {
    const white_ = document.querySelector('#canvas #eyeWhiteLeft').getBoundingClientRect();
    const middle = white_.y + white_.height / 2;
    const at = (fraction) => {
      const x = white_.x + white_.width * fraction;
      return document.elementsFromPoint(x, middle).map((node) => node.id).filter(Boolean)[0] || '';
    };
    return [0.1, 0.25, 0.5, 0.75, 0.9].map(at);
  });
  for (const hit of skin) {
    expect(['lidUpperLeft', 'lidLowerLeft', 'creaseUpperLeft', 'creaseLowerLeft', 'rimLeft'],
      `a shut eye still shows ${hit} along its widest line`).toContain(hit);
  }
  await page.evaluate(() => window.__BOOP_E2E__.clearLiveParam('eyeOpen'));
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

/**
 * The circle that cuts, and what an author can do to it.
 *
 * ```text
 * « je t'avais demandé d'afficher le cercle qui faisait le cut autour de l'œil
 *   mais tu l'as supprimé »
 * ```
 *
 * The ask was to **show** it, not to remove it. So the whole of it is here:
 * it is on the canvas, it has a name, pressing it selects it, the gizmo lands
 * on it, dragging it moves it — and the cut goes where it goes, because the cut
 * is a `<use>` of it rather than a copy that could stay behind.
 */
test('@critical the socket can be found, selected and moved, and the cut follows it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArtwork(page);

  // Half-shut, so there is a lid inside the socket for the cut to act on.
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('eyeOpen', 0.4));
  await page.waitForTimeout(180);

  /**
   * What is painted at a point, which is the only honest way to ask where a
   * cut is. A clipped element's own `getBoundingClientRect` is its geometry,
   * not the part of it that survives — the cut is on the group above it — so
   * measuring boxes here would report that nothing had happened.
   */
  const paintedAt = (fraction) => page.evaluate((f) => {
    const box = document.querySelector('#canvas #eyeWhiteLeft').getBoundingClientRect();
    const lid = document.querySelector('#canvas #lidUpperLeft').getBoundingClientRect();
    const x = box.x + box.width * f, y = lid.y + lid.height * 0.5;
    // The outline is drawn over the lids and is three units wide, so near the
    // edge it is what the pointer lands on first. It is not what is being
    // asked about.
    return document.elementsFromPoint(x, y).map((node) => node.id)
      .filter((id) => id && !/^rim/.test(id))[0] || '';
  }, fraction);
  // Inside the socket's left edge, on the lid's own line.
  expect(await paintedAt(0.14), 'the lid is painted at the left of the socket').toBe('lidUpperLeft');

  // It is a piece of artwork like any other: selected by name, with the gizmo
  // on it. The old socket was an anonymous ellipse in `<defs>` and none of this
  // was possible.
  await select(page, 'eyeWhiteLeft');
  const white = await painted(page, 'eyeWhiteLeft');
  const gizmo = await gizmoBox(page);
  expect(Math.abs(gizmo.x - white.x), 'the handles are on the socket').toBeLessThan(10);
  expect(Math.abs(gizmo.height - white.height)).toBeLessThan(20);

  // Moved, and the cut moves with it: the lid inside is trimmed somewhere else
  // than it was, because what cuts is the drawing that just moved.
  await page.evaluate(() => window.__BOOP_E2E__.setAuthoredTransform('eyeWhiteLeft', { x: 14, y: 6 }));
  await page.waitForTimeout(180);
  const moved = await painted(page, 'eyeWhiteLeft');
  expect(moved.x - white.x, 'the socket moved').toBeGreaterThan(5);
  // That same point is now outside the socket, so the cut takes the lid away
  // there. The lid itself has not moved -- what moved is what cuts it, which
  // is the whole claim `<use>` makes.
  expect(await paintedAt(0.14), 'the cut stayed behind when the socket moved')
    .not.toBe('lidUpperLeft');
  // And it is still painted inside the socket, where the socket now is.
  expect(await paintedAt(0.5), 'the lid is cut to the socket wherever it goes').toBe('lidUpperLeft');

  await page.evaluate(() => {
    window.__BOOP_E2E__.setAuthoredTransform('eyeWhiteLeft', { x: 0, y: 0 });
    window.__BOOP_E2E__.clearLiveParam('eyeOpen');
  });
});
