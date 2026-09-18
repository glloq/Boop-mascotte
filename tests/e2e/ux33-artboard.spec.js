import { test, expect } from '@playwright/test';
import { goToMode, hitTestablePoint, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The working area, and the clips (docs/VECTOR_EDITING.md).
 *
 * "Il y a des soucis avec la plage de travail: si j'utilise des cheveux plus
 * haut ils sont coupés sans raison apparente." Two invisible edges were doing
 * the cutting — the artboard (a nested `<svg>` clips to its own viewBox) and a
 * `clip-path` on the artwork. Both are drawn now, and both can be changed.
 */
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const viewBox = async (page) => /viewBox="([^"]+)"/.exec((await documentOf(page)).svgMarkup)?.[1];

async function openArtwork(page) {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  await expect(page.locator('[data-artboard]')).toBeVisible();
}

test('@critical the working area is drawn, resizable, and says when it is cutting', async ({ page }) => {
  await openArtwork(page);
  // The edge is on the canvas, in the artwork's own units.
  await expect(page.locator('.canvas-artboard')).toHaveCount(1);
  // Taller than it is wide: the template ships a pair of floating hands, and
  // they hang below the mascot (docs/HAND_RIGGING.md).
  // And it starts above the origin: the face keeps headroom over the head for
  // a hat or a tall head of hair (`core/sample/templates/face-artwork.js`).
  expect(await viewBox(page)).toBe('0 -60 240 384');
  await expect(page.locator('[data-artboard-field="height"]')).toHaveValue('384');
  await expect(page.locator('[data-artboard-overflow]')).toContainText('inside it');
  await expect(page.locator('[data-artboard-action="fit"]')).toBeDisabled();

  // Making it smaller cuts the drawing — and now the editor says so instead of
  // leaving an author to wonder where their hair went. The area shrinks around
  // its own centre: 384 → 150 keeps the middle, so `y` moves by half the
  // difference rather than the top-left corner staying nailed down.
  await page.locator('[data-artboard-field="height"]').fill('150');
  await page.locator('[data-artboard-field="height"]').press('Enter');
  await expect.poll(() => viewBox(page)).toBe('0 57 240 150');
  await expect(page.locator('[data-artboard-overflow]')).toContainText('past the bottom');
  await expect(page.locator('[data-artboard-action="fit"]')).toBeEnabled();

  // And Fit puts the border back around everything.
  await page.locator('[data-artboard-action="fit"]').click();
  await expect(page.locator('[data-artboard-overflow]')).toContainText('inside it');
  const fitted = (await viewBox(page)).split(' ').map(Number);
  expect(fitted[3]).toBeGreaterThan(150);

  // One undo step each, and the working area is part of the artwork.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => viewBox(page)).toBe('0 57 240 150');
});

/**
 * "Quand on change la dimension ça cache la mascotte et déplace les holdings
 * hors de la vue... on doit seulement changer l'échelle."
 *
 * Two things were doing it. A `viewBox` is an origin *and* a size, so writing
 * the size alone nailed the top-left corner down and the mascot slid away:
 * measured, 240 → 160 moved the head 107 px right, and 384 → 120 left it below
 * the canvas at three times its size. And `setArtboard` re-placed the artboard
 * edge and nothing else, so every handle drawn over the mascot stayed where the
 * mascot used to be — the selection chrome ended up at −9,−37, off the corner
 * of the screen, pointing at nothing.
 */
test('@critical resizing the working area changes the scale, and nothing leaves the canvas', async ({ page }) => {
  await openArtwork(page);
  const canvas = await page.locator('#canvas').boundingBox();
  const middle = canvas.x + canvas.width / 2;
  // Selected, so the chrome that is placed by the artwork matrix is on screen.
  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => { state.selectedId = 'head'; }));
  const head = async () => page.locator('#canvas #head').boundingBox();
  const chrome = async () => page.evaluate(() => {
    const layer = document.querySelector('[data-gizmo-layer]');
    if (!layer?.children.length) return null;
    const box = layer.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
  await expect.poll(chrome).not.toBe(null);

  const before = await head();
  for (const [field, value] of [['width', '160'], ['width', '120'], ['height', '200'], ['width', '480']]) {
    await page.locator(`[data-artboard-field="${field}"]`).fill(value);
    await page.locator(`[data-artboard-field="${field}"]`).press('Enter');
    // Wait for the working area the document actually holds, not for a frame:
    // everything below measures what the canvas drew from it.
    const side = field === 'width' ? 2 : 3;
    await expect.poll(async () => (await viewBox(page)).split(' ')[side]).toBe(value);

    const now = await head();
    // Still on the canvas, and still centred on it: only the scale changed.
    expect(now.x + now.width, `${field}=${value} pushed the mascot off the left`).toBeGreaterThan(canvas.x);
    expect(now.x, `${field}=${value} pushed the mascot off the right`).toBeLessThan(canvas.x + canvas.width);
    expect(Math.abs(now.x + now.width / 2 - middle), `${field}=${value} slid the mascot sideways`).toBeLessThan(2);

    // And the chrome went with it, instead of staying where the mascot was.
    const marks = await chrome();
    expect(Math.abs(marks.x - now.x), `${field}=${value} left the selection chrome behind`).toBeLessThan(12);
    expect(Math.abs(marks.width - now.width)).toBeLessThan(24);
  }

  // Narrower means larger on screen, which is the whole of what a size means
  // here: the same mascot, framed the same way, at a different scale.
  await page.locator('[data-artboard-field="width"]').fill('120');
  await page.locator('[data-artboard-field="width"]').press('Enter');
  await page.locator('[data-artboard-field="height"]').fill('120');
  await page.locator('[data-artboard-field="height"]').press('Enter');
  await expect.poll(async () => (await head()).width > before.width).toBe(true);
});

test('a clipped piece says what is cutting it, and the clip can be taken off', async ({ page }) => {
  await openArtwork(page);
  // The fringe is clipped to the head on purpose, so it cannot cross the
  // outline. Invisible on its own: selecting it draws the shape it is cut to.
  await page.locator('[data-layer-id="hair"] [data-action="select"]').first().click();
  await expect(page.locator('.canvas-clip-outline')).toHaveCount(1);

  // And the menu on the artwork itself names it and offers to stop.
  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => { for (const behavior of state.behaviors) behavior.enabled = false; }));
  const point = await hitTestablePoint(page.locator('#canvas #hair'));
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(page.locator('[data-canvas-menu]')).toBeVisible();
  await expect(page.locator('[data-canvas-menu-clip]')).toContainText('headShape');
  // The menu's rigging entries sit under Advanced now (ui/piece-actions.js).
  await page.locator('[data-canvas-menu-advanced] summary').click();
  await page.locator('[data-canvas-menu-action="release-clip"]').click();
  const clipOn = async (id) => new RegExp(`<g id="${id}"[^>]*clip-path=`).test((await documentOf(page)).svgMarkup);
  await expect.poll(() => clipOn('hairFront')).toBe(false, 'the fringe stops being cut');
  // And only the fringe's: the face shading is cut to the same `headShape`.
  // The eyes are not in this list any more -- they had a socket each, and a
  // lid is now a sliver on the eye's own rim that cannot leave it, so there is
  // nothing left to clip them with (docs/EYE_BUILDS.md).
  expect(await clipOn('faceShading')).toBe(true);
  expect(await clipOn('eyeLeft')).toBe(false, 'an eye is its own shape now, cut by nothing');
  await expect(page.locator('.canvas-clip-outline')).toHaveCount(0);

  // Taking a clip off is one undo step, like every other edit to the artwork.
  // The toast offers it now, so the topbar button is named exactly.
  await page.locator('#undo').click();
  await expect.poll(async () => (await documentOf(page)).svgMarkup.includes('clip-path="url(#headShape)"')).toBe(true);
});

/**
 * A cut lands on the shape that did the cutting, and can be taken off without
 * knowing to right-click.
 *
 * Both halves of this were wrong. `setClip` divided out only the cut piece's
 * *own* transform, so cutting something inside a turned group sent the cut
 * wherever that group's turn sent it -- a hand rests rotated two hundred
 * degrees, which put the cut clean off the mascot. And the outline that draws
 * it overwrote the cutting shape's own transform with the chain instead of
 * composing the two, so it was drawn somewhere neither of them meant.
 */
test('a cut lands on the shape that cut it, even inside a turned group', async ({ page }) => {
  await openArtwork(page);
  await page.locator('.canvas-toolbar [data-zoom="fit"]').click();
  await page.waitForTimeout(200);

  // The left hand rests behind the head, turned two hundred degrees: one of
  // its drawings is the hardest thing on this mascot to cut correctly.
  const palm = await page.locator('#canvas #handLeftStyle-relaxed').boundingBox();
  await page.locator('[data-design-tool="ellipse"]').click();
  await page.mouse.move(palm.x - 20, palm.y - 20);
  await page.mouse.down();
  await page.mouse.move(palm.x + palm.width + 20, palm.y + palm.height + 20, { steps: 8 });
  await page.mouse.up();
  const cutter = await page.evaluate(() => window.__BOOP_E2E__.session().selectedId);
  const drawnAt = await page.locator(`#canvas #${cutter}`).boundingBox();

  // Select the drawing as well, and cut it to the shape in front.
  await page.locator('[data-design-tool="select"]').click();
  for (let pass = 0; pass < 4; pass += 1) {
    for (const toggle of await page.locator('#left [data-action="toggle"]').all()) {
      if ((await toggle.textContent())?.includes('\u25b6')) await toggle.click().catch(() => {});
    }
  }
  await page.locator('[data-layer-id="handLeftStyle-relaxed"] [data-action="select"]').first().click();
  await page.keyboard.down('Shift');
  await page.locator(`[data-layer-id="${cutter}"] [data-action="select"]`).first().click();
  await page.keyboard.up('Shift');
  await page.locator('[data-arrange="clip:selection"]').click();

  // The cut is drawn where the shape was drawn, not where the group's turn
  // would have sent it.
  await expect(page.locator('.canvas-clip-outline')).toHaveCount(1);
  const outline = await page.locator('.canvas-clip-outline').boundingBox();
  for (const key of ['x', 'y', 'width', 'height']) {
    expect(Math.abs(outline[key] - drawnAt[key]), `the cut is ${key} ${Math.round(outline[key])} where the shape was ${Math.round(drawnAt[key])}`).toBeLessThan(3);
  }

  // And it can be taken off from the bar the author is already looking at,
  // rather than only from a menu they would have to know to right-click for.
  const release = page.locator('[data-arrange^="release:"]');
  await expect(release).toHaveText('Stop cutting');
  await release.click();
  await expect(page.locator('.canvas-clip-outline')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => Boolean(document.querySelector('#canvas #handLeftStyle-relaxed')?.getAttribute('clip-path')))).toBe(false);
  // And the shape that was doing the cutting is back in the drawing, where it
  // was drawn -- that is how a cut is changed.
  await expect(page.locator(`#canvas #${cutter}`)).toHaveCount(1);
  const back = await page.locator(`#canvas #${cutter}`).boundingBox();
  for (const key of ['x', 'y', 'width', 'height']) expect(Math.abs(back[key] - drawnAt[key])).toBeLessThan(3);
});
