import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The tools an author reaches for while building a mascot (docs/UX44_TOOL_ACCESS.md).
 *
 * "il reste des outils non accessible pour la creation/modification … il faut
 * rechercher tout les outils qu'on a et verifier qu'ils sont tous accessible
 * facilement pour la construction d'une mascotte". Each test here is one tool
 * an author could see the *result* of but could not reach: the parts that can
 * be added whole, the clip that cuts a drawing, the colour of a piece.
 */
const openAddParts = async (page) => {
  await page.locator('[data-task="artwork"]').click();
  await page.locator('.artwork-create > summary').click();
  await expect(page.locator('[data-feature-card="eyelids"]')).toBeVisible();
};

test('@critical a part the mascot already has says so instead of failing on the press', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAddParts(page);

  // The template draws eyelids and brows of its own, under its own ids. The
  // card used to read "+ Add" for the lids and throw "Semantic part id
  // collision: eyelids already exists" on the press.
  for (const id of ['eyebrows', 'eyelids']) {
    const card = page.locator(`[data-feature-card="${id}"]`);
    await expect(card.locator('button')).toHaveText('✓ Added');
    await expect(card.locator('button')).toBeDisabled();
  }
  // And the one it does not have is the one that can be pressed.
  await expect(page.locator('[data-feature-card="hands"] button')).toBeEnabled();
});

test('@critical artwork with no head yet says what to do before a part can be added', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('[data-home] [data-template-id="blank"]').click();
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
  await page.locator('[data-home] [data-template-id="blank"]').click();
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
  await page.locator('[data-canvas-menu-action="release-clip"]').click();
  await expect.poll(() => page.evaluate(() => Object.keys(window.__BOOP_E2E__.document().elements))).toEqual(['rect-1', 'ellipse-1']);
  await expect(page.locator('#canvas #rect-1')).not.toHaveAttribute('clip-path', /url/);
});

test('@critical a colour is chosen from the mascot\'s own palette', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="artwork"]').click();
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
  const skin = dialog.locator('[data-colour-swatch="#f6d6ad"]');
  await expect(skin).toHaveCount(1, 'the face\'s own skin is a swatch');
  await skin.click();
  await expect.poll(fill).toBe('#f6d6ad');
  await expect(dialog).toBeHidden();

  // And "None" is a first-class answer, not a checkbox somewhere else.
  await page.locator('[data-appearance-open="fill"]').click();
  await page.locator('#colour-picker [data-colour-none]').click();
  await expect.poll(fill).toBe('none');
});

test('@critical a part is added to a face somebody drew, fitted to it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('[data-home] [data-template-id="blank"]').click();
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
  await page.locator('[data-task="face-setup"]').click();
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
  await page.locator('[data-task="artwork"]').click();
  await page.locator('.artwork-create > summary').click();
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
  await page.locator('[data-home] [data-template-id="blank"]').click();
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
  await page.locator('[data-home] [data-template-id="blank"]').click();
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
  await page.locator('[data-task="face-setup"]').click();
  for (const [role, element] of [['head', 'ellipse-1'], ['mouth', 'rect-1']]) {
    const row = page.locator(`[data-face-role="${role}"]`);
    await row.locator('[data-face-role-assign]').click();
    await page.locator(`[data-face-role-manual="${role}"]`).selectOption(element);
    await expect(row).toHaveAttribute('data-face-role-status', 'assigned');
  }

  // The template has headX and headY on before anyone presses Generate, so
  // nothing noticed that generating did not turn them on: on a drawn face it
  // wrote a full grid driven by parameters that did not exist.
  await page.locator('[data-setup-section="head-pose"] > summary').click();
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
