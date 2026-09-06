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

test('@critical artwork that is not a starter face says why a part cannot be added', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('[data-home] [data-template-id="blank"]').click();
  await openAddParts(page);

  const reason = page.locator('[data-feature-reason="eyelids"]');
  await expect(reason).toBeVisible();
  await expect(reason).toContainText('not a starter face');
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
