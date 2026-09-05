import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The shape tools, complete (docs/VECTOR_EDITING.md, "The tools, complete").
 *
 * "L'outil trait affiche un tracé en dehors de la fenêtre et pas aligné avec
 * ce qui est dessiné une fois fini": the preview is measured against the same
 * artwork matrix as the shape it becomes, on every gesture and every view
 * change, and it is clipped to the working area. The rest is what a complete
 * tool set does: curves from the pen, constrained lines, squares and circles,
 * stars, text, an options bar, a grid that snaps, and a blank canvas to start
 * from.
 */
const session = (page) => page.evaluate(() => { const s = window.__BOOP_E2E__.session(); return { id: s.selectedId, ids: s.selectedIds }; });
const attrsOf = (page, id) => page.evaluate((i) => { const n = document.querySelector(`#canvas svg svg #${i}`); if (!n) return null; const out = { tag: n.tagName, text: n.textContent }; for (const a of n.attributes) out[a.name] = a.value; return out; }, id);
const boxOf = (page, selector) => page.evaluate((s) => { const r = document.querySelector(s)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; }, selector);
const previewBox = (page) => boxOf(page, '#canvas [data-draw-layer] .draw-preview');
const near = (a, b, tolerance = 2) => Math.abs(a - b) <= tolerance;

async function openBlankCanvas(page) {
  await openFreshEditor(page, { e2e: true });
  await page.locator('[data-home] [data-template-id="blank"]').click();
  await expect(page.locator('#app.has-project')).toHaveCount(1);
  // The guide bar arrives a beat later and shifts the canvas: measure it settled.
  let box = await page.locator('#canvas').boundingBox();
  await expect.poll(async () => { const next = await page.locator('#canvas').boundingBox(); const same = next.y === box.y && next.height === box.height; box = next; return same; }).toBe(true);
  return box;
}

async function drag(page, from, to, { modifiers = [] } = {}) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (const key of modifiers) await page.keyboard.down(key);
  await page.mouse.move(to.x, to.y, { steps: 5 });
  await page.mouse.up();
  for (const key of modifiers) await page.keyboard.up(key);
  await expect.poll(() => page.locator('#app').getAttribute('data-canvas-tool')).toBe('select');
  return (await session(page)).id;
}

test('@critical the pen and line previews sit where the shape lands, through a pan and a zoom', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="artwork"]').click();
  const canvas = await page.locator('#canvas').boundingBox();
  const at = (x, y) => ({ x: canvas.x + canvas.width * x, y: canvas.y + canvas.height * y });

  // A line: the preview is measured where the shape then lands.
  await page.locator('[data-design-tool="line"]').click();
  const a = at(.3, .35), b = at(.55, .5);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 4 });
  const preview = await previewBox(page);
  expect(near(preview.x, a.x) && near(preview.y, a.y) && near(preview.w, b.x - a.x) && near(preview.h, b.y - a.y)).toBe(true);
  await page.mouse.up();
  await expect.poll(() => page.locator('#app').getAttribute('data-canvas-tool')).toBe('select');
  const lineId = (await session(page)).id;
  const line = await boxOf(page, `#canvas svg svg #${lineId}`);
  expect(near(line.x, preview.x) && near(line.y, preview.y) && near(line.w, preview.w) && near(line.h, preview.h)).toBe(true);
  expect((await attrsOf(page, lineId)).d).toMatch(/^M [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+$/);

  // A pen run that is panned in the middle: the preview follows the artwork,
  // and the shape lands under the preview. It used to keep the transform
  // measured at the first press.
  await page.locator('[data-design-tool="pen"]').click();
  const p1 = at(.35, .6);
  await page.mouse.click(p1.x, p1.y);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(100);
  const p2 = at(.5, .7);
  await page.mouse.move(p2.x, p2.y);
  await page.waitForTimeout(60);
  const penPreview = await previewBox(page);
  const first = await page.evaluate(() => { const r = document.querySelector('#canvas .draw-guide-close, #canvas [data-draw-layer] .draw-preview').getBoundingClientRect(); return { x: r.x, y: r.y }; });
  expect(near(penPreview.x, first.x, 3)).toBe(true);
  await page.mouse.click(p2.x, p2.y);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.locator('#app').getAttribute('data-canvas-tool')).toBe('select');
  const penId = (await session(page)).id;
  const pen = await boxOf(page, `#canvas svg svg #${penId}`);
  expect(near(pen.x, penPreview.x, 3) && near(pen.y, penPreview.y, 3) && near(pen.w, penPreview.w, 3) && near(pen.h, penPreview.h, 3)).toBe(true);
  // The preview layer is clipped to the working area, and empty once done.
  await expect(page.locator('#canvas [data-draw-layer]')).toHaveAttribute('clip-path', /boop-draw-clip/);
  await expect(page.locator('#canvas [data-draw-layer] .draw-preview')).toHaveCount(0);

  // Zoomed in with the wheel, a rectangle still lands where it is drawn.
  await page.mouse.move(at(.5, .5).x, at(.5, .5).y);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, -300); await page.keyboard.up('Control');
  await page.waitForTimeout(100);
  await page.locator('[data-design-tool="rect"]').click();
  const r1 = at(.25, .25), r2 = at(.4, .4);
  const rectId = await drag(page, r1, r2);
  const rect = await boxOf(page, `#canvas svg svg #${rectId}`);
  expect(near(rect.x, r1.x) && near(rect.y, r1.y) && near(rect.w, r2.x - r1.x) && near(rect.h, r2.y - r1.y)).toBe(true);
});

test('the pen pulls curves, closes on its first point, and the Node tool edits the handles', async ({ page }) => {
  const canvas = await openBlankCanvas(page);
  const at = (x, y) => ({ x: canvas.x + canvas.width * x, y: canvas.y + canvas.height * y });
  await page.locator('[data-design-tool="pen"]').click();
  const start = at(.3, .3);
  await page.mouse.click(start.x, start.y);
  // Press and drag: the second point gets a pair of handles.
  const second = at(.55, .3);
  await page.mouse.move(second.x, second.y); await page.mouse.down(); await page.mouse.move(second.x + 60, second.y - 40, { steps: 5 });
  await expect(page.locator('#canvas [data-draw-layer] .draw-guide')).toHaveCount(2);
  await page.mouse.up();
  await page.mouse.click(at(.55, .55).x, at(.55, .55).y);
  await page.mouse.click(at(.3, .55).x, at(.3, .55).y);
  await page.mouse.click(at(.2, .45).x, at(.2, .45).y);
  await page.keyboard.press('Backspace');
  // Back on the first point: the outline offers to close, and a click closes it.
  await page.mouse.move(start.x + 1, start.y + 1);
  await expect(page.locator('#canvas [data-draw-layer] .draw-guide-close-ready')).toHaveCount(1);
  await page.mouse.click(start.x + 1, start.y + 1);
  await expect.poll(() => page.locator('#app').getAttribute('data-canvas-tool')).toBe('select');
  const id = (await session(page)).id;
  const drawn = await attrsOf(page, id);
  expect(drawn.d).toMatch(/^M .* C .* Z$/);
  expect(drawn.d.split(' C ').length).toBe(3, 'curves either side of the dragged point, lines elsewhere');
  expect(drawn.d.split(' L ').length).toBe(2);
  expect(drawn.fill).not.toBe('none');

  // The Node tool: the point in hand shows its two handles; Straight and
  // Curve rewrite the segments around it, Delete removes it.
  await page.keyboard.press('n');
  await expect(page.locator('#canvas [data-path-node]')).toHaveCount(4);
  await page.locator('#canvas [data-path-node]').nth(1).click();
  await expect(page.locator('#canvas [data-path-control]')).toHaveCount(2);
  await expect(page.locator('#tool-options [data-node-action="smooth"]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#tool-options [data-node-action="straight"]').click();
  await expect.poll(async () => (await attrsOf(page, id)).d).toMatch(/^M[^C]*Z$/);
  await page.locator('#canvas [data-path-node]').nth(1).click();
  await page.locator('#tool-options [data-node-action="curve"]').click();
  await expect.poll(async () => (await attrsOf(page, id)).d).toMatch(/C/);
  await page.locator('#canvas [data-path-node]').nth(1).click();
  await page.keyboard.press('Delete');
  await expect(page.locator('#canvas [data-path-node]')).toHaveCount(3);
  expect((await session(page)).id).toBe(id);
});

test('Shift and Alt shape what is drawn, and a polygon can be a star', async ({ page }) => {
  const canvas = await openBlankCanvas(page);
  const at = (x, y) => ({ x: canvas.x + canvas.width * x, y: canvas.y + canvas.height * y });

  await page.locator('[data-design-tool="rect"]').click();
  const square = await attrsOf(page, await drag(page, at(.2, .25), at(.35, .32), { modifiers: ['Shift'] }));
  expect(Number(square.width)).toBeCloseTo(Number(square.height), 5);
  expect(square.rx).toBeUndefined();

  await page.locator('[data-design-tool="ellipse"]').click();
  const centre = at(.6, .3);
  const circle = await attrsOf(page, await drag(page, centre, at(.65, .38), { modifiers: ['Alt'] }));
  const bbox = await boxOf(page, `#canvas svg svg #${(await session(page)).id}`);
  expect(near(bbox.x + bbox.w / 2, centre.x, 3) && near(bbox.y + bbox.h / 2, centre.y, 3)).toBe(true);
  expect(circle.tagName || circle.tag).toBe('ellipse');

  await page.locator('[data-design-tool="line"]').click();
  const line = await attrsOf(page, await drag(page, at(.2, .55), at(.45, .58), { modifiers: ['Shift'] }));
  const [, y1, y2] = line.d.match(/^M [-\d.]+ ([-\d.]+) L [-\d.]+ ([-\d.]+)$/);
  expect(Number(y1)).toBeCloseTo(Number(y2), 5);

  await page.locator('[data-design-tool="polygon"]').click();
  await page.locator('#tool-options [data-draw-option="sides"]').fill('6');
  await page.locator('#tool-options [data-draw-option="sides"]').dispatchEvent('change');
  await page.locator('#tool-options [data-draw-option="star"]').check();
  await expect(page.locator('#tool-options [data-draw-option="inner"]')).toHaveCount(1);
  const star = await attrsOf(page, await drag(page, at(.7, .6), at(.78, .6)));
  expect(star['data-name']).toBe('Star');
  expect(star.d.split(' L ').length).toBe(12);
  // The options are remembered for next time.
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem('boop.drawOptions.v1')))).toMatchObject({ sides: 6, star: true });
});

test('text is placed with a click and typed in the Inspector, and the grid snaps new shapes', async ({ page }) => {
  const canvas = await openBlankCanvas(page);
  const at = (x, y) => ({ x: canvas.x + canvas.width * x, y: canvas.y + canvas.height * y });
  await page.keyboard.press('t');
  await expect(page.locator('#tool-options')).toHaveAttribute('data-tool', 'text');
  await page.locator('#tool-options [data-draw-option="text"]').fill('Hello');
  await page.locator('#tool-options [data-draw-option="text"]').dispatchEvent('change');
  await page.mouse.click(at(.3, .5).x, at(.3, .5).y);
  await expect.poll(() => page.locator('#app').getAttribute('data-canvas-tool')).toBe('select');
  const id = (await session(page)).id;
  expect((await attrsOf(page, id)).text).toBe('Hello');
  // The cursor lands in the Inspector's text field, ready to type.
  await expect(page.locator('#inspector [data-text-content]')).toBeFocused();
  await page.keyboard.type('Hi there');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await attrsOf(page, id)).text).toBe('Hi there');

  await page.keyboard.press('Escape');
  await page.locator('[data-design-tool="rect"]').click();
  await page.locator('#tool-options [data-draw-option="grid"]').check();
  await page.locator('#tool-options [data-draw-option="snap"]').check();
  await expect(page.locator('#canvas .canvas-grid')).toHaveCount(1);
  const snapped = await attrsOf(page, await drag(page, at(.52, .62), at(.7, .8)));
  for (const key of ['x', 'y', 'width', 'height']) expect(Number(snapped[key]) % 10).toBe(0);
});

test('a blank canvas is a project: it saves, exports and takes a drawing', async ({ page }) => {
  await openBlankCanvas(page);
  await expect(page.locator('#canvas svg svg')).toHaveAttribute('viewBox', '0 0 240 240');
  expect(await page.evaluate(() => Object.keys(window.__BOOP_E2E__.document().elements).length)).toBe(0);
  expect(await page.evaluate(() => window.__BOOP_E2E__.state().activeState)).toBe('idle');
  await expect(page.locator('#save-project-top')).toBeEnabled();
  await expect(page.locator('#export-top')).toBeEnabled();
  // Saving a blank canvas writes a project file.
  const download = page.waitForEvent('download');
  await page.keyboard.press('Control+s');
  expect((await download).suggestedFilename()).toBe('mascot-project.json');
  // And the export is not blocked by the empty artwork.
  await page.locator('#export-top').click();
  await expect(page.locator('[data-export-headline]')).toHaveAttribute('data-export-status', /ready|warnings/);
  await expect(page.locator('[data-download-artifact="mascot.svg"]')).toBeEnabled();
  await expect(page.locator('[data-download-artifact="rig.json"]')).toBeEnabled();
});
