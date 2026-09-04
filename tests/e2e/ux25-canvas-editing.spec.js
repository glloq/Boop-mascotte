import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * Direct manipulation on the canvas (docs/VECTOR_EDITING.md).
 *
 * "Le déplacement, l'édition ne fonctionnent pas du tout": dragging wrote
 * `translate(NaN NaN)` into the artwork, the Node and Hand tools were buttons
 * that only turned Select off, and a stroked line had a selection box with no
 * height. These are those four things, in the browser.
 */
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const baseOf = (page, id) => page.evaluate((i) => window.__BOOP_E2E__.document().elements[i]?.baseTransform, id);
const attrOf = (page, id, name) => page.evaluate(([i, a]) => document.querySelector(`#canvas #${i}`)?.getAttribute(a), [id, name]);
const centreOf = (page, selector) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, selector);
const handleAt = (page, handle) => page.evaluate((h) => { const n = document.querySelector(`[data-gizmo-handle="${h}"]`); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, handle);
const view = (page) => page.evaluate(() => window.__BOOP_E2E__.panView(0, 0));

async function dragBy(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(120);
}

test('@critical dragging artwork moves it and writes numbers, never NaN', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const pupil = await centreOf(page, '#canvas #pupilLeft');
  await page.mouse.click(pupil.x, pupil.y);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.session().selectedId)).toBe('pupilLeft');

  await dragBy(page, pupil, 40, 20);
  const moved = await baseOf(page, 'pupilLeft');
  expect(moved.x).toBeGreaterThan(0);
  expect(moved.y).toBeGreaterThan(0);
  for (const [field, value] of Object.entries(moved)) expect(Number.isFinite(value), `${field} = ${value}`).toBe(true);
  expect(await attrOf(page, 'pupilLeft', 'transform')).not.toContain('NaN');
  const document_ = await documentOf(page);
  expect(document_.svgMarkup).not.toContain('NaN');

  // The artwork is still there, and the move is one undo step.
  expect(await page.evaluate(() => document.querySelectorAll('#canvas svg *').length)).toBeGreaterThan(5);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await baseOf(page, 'pupilLeft')).x).toBe(0);
});

test('@critical a stroked line can be selected, scaled and rotated around its middle', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  // The mouth of every template is a stroked curve: `getBBox` measures no
  // height for it, so its selection box used to collapse to a flat line with
  // every handle stacked on the next.
  const mouth = await centreOf(page, '#canvas #mouth');
  await page.mouse.click(mouth.x, mouth.y);
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.session().selectedId)).toBe('mouth');
  const outline = await page.evaluate(() => document.querySelector('[data-gizmo-part="outline"]')?.getAttribute('points'));
  const ys = outline.split(' ').map((pair) => Number(pair.split(',')[1]));
  expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0);

  const corner = await handleAt(page, 'se');
  await dragBy(page, corner, 40, 20);
  const scaled = await baseOf(page, 'mouth');
  expect(scaled.scaleX).toBeGreaterThan(1);
  expect(scaled.scaleY).toBeGreaterThan(1);

  // An unconfigured pivot means the middle of the selection, not the corner of
  // the artwork's coordinates.
  expect(scaled.pivotX).toBeCloseTo(120, 0);
  expect(scaled.pivotY).toBeCloseTo(163, 0);
  const rotate = await handleAt(page, 'rotate');
  await dragBy(page, rotate, 60, 40);
  expect(Math.abs((await baseOf(page, 'mouth')).rotation)).toBeGreaterThan(1);
});

test('@critical the Node tool reshapes a path, by pointer and by keyboard', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const mouth = await centreOf(page, '#canvas #mouth');
  await page.mouse.click(mouth.x, mouth.y);
  await page.locator('[data-design-tool="node"]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.nodeEdit()?.nodes)).toBe(3);
  await expect(page.locator('[data-path-node]')).toHaveCount(3);

  const before = await attrOf(page, 'mouth', 'd');
  const handle = page.locator('[data-path-node]').last();
  const box = await handle.boundingBox();
  await dragBy(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, 30, -30);
  const after = await attrOf(page, 'mouth', 'd');
  expect(after).not.toBe(before);
  expect(after).not.toContain('NaN');
  expect((await documentOf(page)).svgMarkup).toContain(after);

  // A node can be placed exactly, without a pointer.
  await page.locator('[data-path-node]').first().focus();
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => attrOf(page, 'mouth', 'd')).not.toBe(after);

  // And the tool is not a trap: Escape goes back to Select.
  await page.keyboard.press('Escape');
  await expect(page.locator('#app')).toHaveAttribute('data-canvas-tool', 'select');
  await expect(page.locator('[data-path-node]')).toHaveCount(0);
});

test('@critical the view can be panned, zoomed and fitted', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const canvas = page.locator('.canvas-toolbar');
  await canvas.getByRole('button', { name: 'Fit' }).click();
  const fitted = await view(page);
  // Fit centres the mascot; it used to only scale it, because the translation
  // was written with names this SVG.js version ignores.
  const face = await page.evaluate(() => { const r = document.querySelector('#canvas #faceRoot').getBoundingClientRect(); const c = document.querySelector('#canvas').getBoundingClientRect(); return { dx: Math.abs((r.x + r.width / 2) - (c.x + c.width / 2)), dy: Math.abs((r.y + r.height / 2) - (c.y + c.height / 2)) }; });
  expect(face.dx).toBeLessThan(12);
  expect(face.dy).toBeLessThan(12);

  await canvas.getByRole('button', { name: 'Zoom in' }).click();
  const zoomed = await view(page);
  expect(zoomed.scale).toBeGreaterThan(fitted.scale);

  await page.locator('[data-design-tool="hand"]').click();
  await dragBy(page, { x: 700, y: 400 }, 60, 50);
  const panned = await view(page);
  expect(Math.round(panned.x - zoomed.x)).toBe(60);
  expect(Math.round(panned.y - zoomed.y)).toBe(50);

  // Space-drag pans without leaving Select, which is where every other
  // interaction lives.
  await page.locator('[data-design-tool="select"]').click();
  await page.keyboard.down('Space');
  await dragBy(page, { x: 700, y: 400 }, -40, -30);
  await page.keyboard.up('Space');
  const spacePanned = await view(page);
  expect(Math.round(spacePanned.x - panned.x)).toBe(-40);
  expect((await documentOf(page)).svgMarkup).not.toContain('NaN');
});
