import { test, expect } from '@playwright/test';
import { goToMode, hitTestablePoint, openAddParts as openAddPartsStrip, openArtwork, openFreshEditor, openSetupSection, startBasicFace, startBlankCanvas } from './editor-helpers.js';
import { FACE_PALETTE } from '../../project/editor/core/sample/templates/face-artwork.js';

/**
 * The tools an author reaches for while building a mascot (docs/UX44_TOOL_ACCESS.md).
 *
 * "il reste des outils non accessible pour la creation/modification … il faut
 * rechercher tout les outils qu'on a et verifier qu'ils sont tous accessible
 * facilement pour la construction d'une mascotte". Each test here is one tool
 * an author could see the *result* of but could not reach: the parts that can
 * be added whole, the clip that cuts a drawing, the colour of a piece.
 */
/**
 * The parts that can be added whole are on Design ▸ Assemble, in the open.
 *
 * They were in Artwork, inside a disclosure called *Add / Create artwork*, and
 * are now one of the four things Assemble is made of — Assemble being where a
 * mascot comes from, and the screen the editor opens on (UIR-18,
 * docs/DESIGN_SCREENS.md). No disclosure to open any more.
 */
const openAddParts = async (page) => {
  await openAddPartsStrip(page);
  await expect(page.locator('[data-feature-card="eyelids"]')).toBeVisible();
};

test('@critical a part the mascot already has says so instead of failing on the press', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAddParts(page);

  // The template draws eyelids and brows of its own, under its own ids. The
  // card used to read "+ Add" for the lids and throw "Semantic part id
  // collision: eyelids already exists" on the press.
  // Hands among them: the template ships a pair, so that card says so too
  // rather than offering a press that would collide with the artwork it has.
  for (const id of ['eyebrows', 'eyelids', 'hands']) {
    const card = page.locator(`[data-feature-card="${id}"]`);
    await expect(card.locator('button')).toHaveText('✓ Added');
    await expect(card.locator('button')).toBeDisabled();
  }
});

test('@critical artwork with no head yet says what to do before a part can be added', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBlankCanvas(page);
  await openAddParts(page);

  const reason = page.locator('[data-feature-reason="eyelids"]');
  await expect(reason).toBeVisible();
  await expect(reason).toContainText('Assign the head');
  await expect(page.locator('[data-feature-card="eyelids"] button')).toBeDisabled();
  // Hands are drawn from nothing, so they are on offer for any artwork.
  await expect(page.locator('[data-feature-card="hands"] button')).toBeEnabled();
});

test('@critical a clip can be made, seen and taken back off', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBlankCanvas(page);
  await expect(page.locator('#canvas svg svg')).toHaveCount(1);

  // Two shapes, the ellipse drawn last and therefore in front.
  const box = await page.locator('#canvas').boundingBox();
  const at = (fx, fy) => ({ x: Math.round(box.x + box.width * fx), y: Math.round(box.y + box.height * fy) });
  const drag = async (tool, from, to) => {
    await page.locator(`[data-design-tool="${tool}"]`).click();
    const a = at(...from), b = at(...to);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
  };
  await drag('rect', [0.35, 0.35], [0.65, 0.55]);
  await drag('ellipse', [0.40, 0.30], [0.60, 0.60]);
  await page.locator('[data-design-tool="select"]').click();

  // The rectangle, then the ellipse in front of it. Nothing could ever make a
  // clip before this: the fringe arrived cut to the head and that was that.
  const edge = at(0.365, 0.45), middle = at(0.5, 0.45);
  await page.mouse.click(edge.x, edge.y);
  await page.keyboard.down('Shift');
  await page.mouse.click(middle.x, middle.y);
  await page.keyboard.up('Shift');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.state().selectedIds)).toEqual(['rect-1', 'ellipse-1']);

  await page.locator('[data-arrange="clip:selection"]').click();
  // The shape in front stops being drawn and does the cutting instead.
  await expect.poll(() => page.evaluate(() => Object.keys(window.__BOOP_E2E__.document().elements))).toEqual(['rect-1']);
  await expect(page.locator('#canvas #rect-1')).toHaveAttribute('clip-path', /url\(#/);
  // And the canvas draws the shape that is cutting it, on the artwork itself.
  await expect(page.locator('.canvas-clip-outline')).toHaveCount(1);

  // Taking the cut off gives the shape back, which is how a cut is changed.
  await page.mouse.click(middle.x, middle.y, { button: 'right' });
  // "Stop cutting it" names a rigging concept, so it sits under Advanced in
  // the menu now (ui/piece-actions.js) rather than above Duplicate.
  await page.locator('[data-canvas-menu-advanced] summary').click();
  await page.locator('[data-canvas-menu-action="release-clip"]').click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.__BOOP_E2E__.document().elements))).toEqual(['rect-1', 'ellipse-1']);
  await expect(page.locator('#canvas #rect-1')).not.toHaveAttribute('clip-path', /url/);
});

/**
 * The cut the template ships with, in the tree and in the menu.
 *
 * « j'ai un soucis avec la fringe du model de base, il y a une decoupe avec un
 *   autre element mais ca n'apparait nul part. on devrais pouvoir gerer le cut
 *   et la gemotrie de coupe de facon simple mais ca n'apparait nul part (ni
 *   dans les layers) »
 *
 * The fringe is cut to the head so it cannot cross the outline, and a
 * `<clipPath>` is in no layer and no `elements` record -- so the one thing in
 * the artwork an author could not see was also the one they could not reach.
 * The cut names a drawing now (`<use href="#head">`), which is what gives the
 * tree something to say and the menu something to press.
 */
test('@critical the fringe says what cuts it, and goes to the shape', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 950 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArtwork(page);

  // The cut is a `<use>` of the head, not a copy of it. A copy is what was
  // there, and a copy cannot follow the head's jaw -- so the fringe kept its
  // cut forty units above an open mouth's outline.
  const markup = await page.evaluate(() => window.__BOOP_E2E__.document().svgMarkup);
  expect(markup).toContain('<clipPath id="headShape"><use href="#head"');
  expect(markup).not.toMatch(/<clipPath id="headShape">\s*<path/);

  await page.locator('#layer-filter').fill('hair');
  const row = (id) => page.locator(`#layers-panel [data-layer-id="${id}"]`);
  const badge = row('hairFront').locator('> .layer-row > .cut-badge');
  await expect(badge).toHaveCount(1);
  await expect(badge).toHaveAttribute('title', /cut to the shape of Head shape/);

  // Pressing it goes to the drawing that does the cutting, which is the whole
  // of "where is the geometry of this cut".
  await badge.click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.state().selectedId)).toBe('head');
  // And the head's own row says what rides on it, because hiding or redrawing
  // it takes them with it.
  await page.locator('#layer-filter').fill('head');
  await expect(row('head').locator('.layer-cut')).toContainText('cuts Face shading, Hair front');

  // The same answer on the artwork itself: right-click the fringe, press the
  // name, and the head is selected.
  await page.locator('#layer-filter').fill('');
  const point = await hitTestablePoint(page.locator('#canvas svg svg #hairFront'));
  await page.mouse.click(point.x, point.y, { button: 'right' });
  const menu = page.locator('[data-canvas-menu]');
  await expect(menu.locator('[data-canvas-menu-clip]')).toContainText('Cut to the shape of Head shape');
  await menu.locator('[data-canvas-menu-cutter]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.state().selectedId)).toBe('head');

  // Hiding the shape that cuts hides everything it was keeping -- measured, on
  // `display:none` and on `visibility:hidden` alike -- so the row says so
  // instead of leaving an author staring at a face with no hair.
  await page.locator('#layer-filter').fill('head');
  await row('head').locator('[data-action="visibility"]').click();
  await page.locator('#layer-filter').fill('hair');
  await expect(badge).toHaveAttribute('title', /Head shape is hidden — so none of Hair front shows/);
});

/**
 * Releasing a cut that points at a drawing takes the cut off and leaves the
 * drawing alone.
 *
 * The restore path was written when every cut owned a frozen copy of its shape,
 * and it put that copy back into the artwork. Run against a `<use href="#head">`
 * it would have dropped a second head into the drawing.
 */
test('@critical stopping a cut that points at a drawing leaves the drawing alone', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArtwork(page);
  const before = await page.evaluate(() => Object.keys(window.__BOOP_E2E__.document().elements).length);

  const release = async (id) => {
    const point = await hitTestablePoint(page.locator(`#canvas svg svg #${id}`));
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await page.locator('[data-canvas-menu-advanced] summary').click();
    await page.locator('[data-canvas-menu-action="release-clip"]').click();
  };
  await release('hairFront');
  // Shared: the shading is still cut to the head, so the definition stays.
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.document().svgMarkup.includes('id="headShape"'))).toBe(true);
  await release('faceShading');

  const after = await page.evaluate(() => window.__BOOP_E2E__.document());
  expect(after.svgMarkup).not.toContain('id="headShape"');
  expect(after.svgMarkup).not.toContain('href="#head"');
  expect(Object.keys(after.elements).length, 'no second head came back into the drawing').toBe(before);
  await expect(page.locator('#canvas svg svg #head')).toHaveCount(1);
});

test('@critical a colour is chosen from the mascot\'s own palette', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  await page.locator('#layers-panel [data-layer-id="hair"]').click();

  // The fringe, and the dialog that opens on its fill.
  const fill = () => page.locator('#canvas #hair').getAttribute('fill');
  const before = await fill();
  await page.locator('[data-appearance-open="fill"]').click();
  const dialog = page.locator('#colour-picker');
  await expect(dialog).toBeVisible();
  // The colours this artwork uses come first: matching the skin or the line
  // colour used to mean copying a hex out of one field into another.
  await expect(dialog.locator(`[data-colour-swatch="${before}"]`)).toHaveCount(1);
  const skin = dialog.locator(`[data-colour-swatch="${FACE_PALETTE.skin}"]`);
  await expect(skin).toHaveCount(1, 'the face\'s own skin is a swatch');
  await skin.click();
  await expect.poll(fill).toBe(FACE_PALETTE.skin);
  await expect(dialog).toBeHidden();

  // And "None" is a first-class answer, not a checkbox somewhere else.
  await page.locator('[data-appearance-open="fill"]').click();
  await page.locator('#colour-picker [data-colour-none]').click();
  await expect.poll(fill).toBe('none');
});

test('@critical a part is added to a face somebody drew, fitted to it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBlankCanvas(page);
  await expect(page.locator('#canvas svg svg')).toHaveCount(1);

  // A head and two eyes, drawn rather than templated.
  const box = await page.locator('#canvas').boundingBox();
  const at = (fx, fy) => ({ x: Math.round(box.x + box.width * fx), y: Math.round(box.y + box.height * fy) });
  const drag = async (tool, from, to) => {
    await page.locator(`[data-design-tool="${tool}"]`).click();
    const a = at(...from), b = at(...to);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
  };
  await drag('ellipse', [0.30, 0.20], [0.70, 0.75]);
  await drag('ellipse', [0.40, 0.36], [0.47, 0.45]);
  await drag('ellipse', [0.53, 0.36], [0.60, 0.45]);
  await page.locator('[data-design-tool="select"]').click();

  // Assigned from the layer list, which is the checklist's own second way in.
  await goToMode(page, 'rig.assign');
  for (const [role, element] of [['head', 'ellipse-1'], ['leftEye', 'ellipse-2'], ['rightEye', 'ellipse-3']]) {
    const row = page.locator(`[data-face-role="${role}"]`);
    if ((await row.getAttribute('data-face-role-status')) === 'missing') {
      await row.locator('[data-face-role-assign]').click();
      await page.locator(`[data-face-role-manual="${role}"]`).selectOption(element);
      await expect(row).toHaveAttribute('data-face-role-status', 'assigned');
    }
  }

  // The preset artwork is the template's, and this face is not the template's.
  // It used to be refused outright ("compatible starter faces" only).
  // The parts that go on whole are on Assemble, one chip along from the
  // library (UIR-18, UX-60 PR 7).
  await openAddPartsStrip(page);
  const brows = page.locator('[data-add-feature="eyebrows"]');
  await expect(brows).toBeEnabled();
  await brows.click();
  await expect(brows).toHaveText('✓ Added');

  // Fitted to this face: above the eyes, inside the head.
  const rect = (id) => page.locator(`#canvas #${id}`).evaluate((node) => { const b = node.getBoundingClientRect(); return { x: b.x, y: b.y, right: b.x + b.width, bottom: b.y + b.height, width: b.width }; });
  const [brow, eye, head] = [await rect('browLeft'), await rect('ellipse-2'), await rect('ellipse-1')];
  expect(brow.bottom, 'the brow sits above the eye it belongs to').toBeLessThan(eye.bottom);
  expect(brow.x, 'and inside the head').toBeGreaterThan(head.x);
  expect(brow.right).toBeLessThan(head.right);
  // A brow drawn for the template's face is about a fifth of the head wide.
  expect(brow.width / head.width).toBeGreaterThan(0.1);
  expect(brow.width / head.width).toBeLessThan(0.45);
});

test('@critical the Node tool turns a drawn shape into a path instead of refusing it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBlankCanvas(page);
  const box = await page.locator('#canvas').boundingBox();
  const at = (fx, fy) => ({ x: Math.round(box.x + box.width * fx), y: Math.round(box.y + box.height * fy) });
  await page.locator('[data-design-tool="rect"]').click();
  const a = at(0.35, 0.35), b = at(0.65, 0.6);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.document().elements['rect-1']?.meta?.nodeType)).toBe('rect');

  // "That is not a path. Click a path to edit its nodes." was a dead end:
  // rounding a corner of a rectangle you just drew is what the tool is for,
  // and the way to it was a different menu.
  await page.locator('[data-design-tool="node"]').click();
  const middle = at(0.5, 0.47);
  await page.mouse.click(middle.x, middle.y);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.document().elements['rect-1']?.meta?.nodeType)).toBe('path');
  await expect.poll(() => page.locator('.rig-node-handle').count()).toBeGreaterThan(0);

  // Undoable: it is an edit to the artwork like any other.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.document().elements['rect-1']?.meta?.nodeType)).toBe('rect');
});

test('@critical a face somebody drew can be given the turn the template ships with', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBlankCanvas(page);
  const box = await page.locator('#canvas').boundingBox();
  const at = (fx, fy) => ({ x: Math.round(box.x + box.width * fx), y: Math.round(box.y + box.height * fy) });
  const drag = async (tool, from, to) => {
    await page.locator(`[data-design-tool="${tool}"]`).click();
    const a = at(...from), b = at(...to);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
  };
  await drag('ellipse', [0.30, 0.20], [0.70, 0.75]);
  await drag('rect', [0.45, 0.58], [0.55, 0.63]);
  await page.locator('[data-design-tool="select"]').click();
  await goToMode(page, 'rig.assign');
  for (const [role, element] of [['head', 'ellipse-1'], ['mouth', 'rect-1']]) {
    const row = page.locator(`[data-face-role="${role}"]`);
    await row.locator('[data-face-role-assign]').click();
    await page.locator(`[data-face-role-manual="${role}"]`).selectOption(element);
    await expect(row).toHaveAttribute('data-face-role-status', 'assigned');
  }

  // The template has headX and headY on before anyone presses Generate, so
  // nothing noticed that generating did not turn them on: on a drawn face it
  // wrote a full grid driven by parameters that did not exist.
  await openSetupSection(page, 'head-pose');
  await page.locator('#head-pose [data-head-action="generate"]').click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.__BOOP_E2E__.document().params))).toEqual(expect.arrayContaining(['headX', 'headY']));
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.document().keyforms.length)).toBeGreaterThan(0);

  // And it plays: the mouth is deeper than the outline, so it travels further.
  const centre = (id) => page.locator(`#canvas #${id}`).evaluate((node) => node.getBoundingClientRect().x);
  const [restHead, restMouth] = [await centre('ellipse-1'), await centre('rect-1')];
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('headX', 1));
  await expect.poll(() => centre('rect-1')).not.toBe(restMouth);
  const [turnedHead, turnedMouth] = [await centre('ellipse-1'), await centre('rect-1')];
  expect(turnedMouth - restMouth).toBeGreaterThan(turnedHead - restHead);
});

/**
 * Isolating a piece, and the scope not following the project out.
 *
 * The scope is the canvas's, not the document's, and a new project that
 * happens to have an element by the same name must not arrive already limited
 * to it -- the mascot would open with everything but one piece dimmed and
 * inert, for no reason an author could see.
 *
 * It was pressed through the Character Builder's *Edit Shape*, which is gone
 * (V5-07). Isolate is the gesture that scopes the canvas now, on any piece,
 * from the menu the author already has over it.
 */
test('@critical a new project does not inherit the edit scope of the last one', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.artwork');
  // Isolate is a `more` action, so it is in the menu over the piece rather than
  // on the bar beside it (ui/piece-actions.js).
  const mouth = await page.locator('#canvas svg svg #mouth').boundingBox();
  await page.mouse.click(mouth.x + mouth.width / 2, mouth.y + mouth.height / 2);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.session().selectedId)).toBe('mouth');
  await page.mouse.click(mouth.x + mouth.width / 2, mouth.y + mouth.height / 2, { button: 'right' });
  await page.locator('[data-canvas-menu-advanced] summary').click();
  await page.locator('[data-canvas-menu-action="isolate"]').click();
  await expect(page.locator('#canvas')).toHaveAttribute('data-edit-scope', 'mouth');
  await expect(page.locator('#canvas [data-editor-scope="out"]').first()).toBeAttached();

  // Another project with an element called "mouth" too: the template again.
  await page.getByLabel('More project actions').click();
  await page.getByRole('button', { name: 'New Project' }).click();
  await expect(page.locator('[data-home]')).toBeVisible();
  await page.locator('[data-home] [data-template-id="basic"]').click();
  await expect(page.locator('#app.has-project')).toHaveCount(1);
  await expect(page.locator('[data-home]')).toBeHidden();
  await expect(page.locator('#canvas svg svg #mouth')).toBeVisible();
  await expect(page.locator('#canvas')).not.toHaveAttribute('data-edit-scope', /.+/);
  await expect(page.locator('#canvas [data-editor-scope="out"]')).toHaveCount(0);
  await expect(page.locator('#artwork-scope')).toBeHidden();
});
