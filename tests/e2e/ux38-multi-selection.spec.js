import { test, expect } from '@playwright/test';
import { openFreshEditor } from './editor-helpers.js';

/**
 * Several pieces at once (docs/SELECTION_GIZMO.md, "Several pieces").
 *
 * Shift+click adds a piece to the selection, a drag on empty canvas selects
 * what it surrounds, a drag on any selected piece moves them all as one undo
 * step, and the bar above the canvas lines them up, spreads them out and
 * groups them. Everything here is measured on screen, on a blank canvas.
 */
const session = (page) => page.evaluate(() => { const s = window.__BOOP_E2E__.session(); return { id: s.selectedId, ids: s.selectedIds }; });
const baseOf = (page, id) => page.evaluate((i) => { const t = window.__BOOP_E2E__.document().elements[i]?.baseTransform; return t ? { x: t.x, y: t.y } : null; }, id);
const boxOf = (page, id) => page.evaluate((i) => { const r = document.querySelector(`#canvas svg svg #${i}`)?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; }, id);
const layerIds = (page) => page.evaluate(() => window.__BOOP_E2E__.document().layers.map((item) => `${item.id}(${(item.children || []).map((child) => child.id).join(',')})`));

/** The canvas box once the shell has settled (the guide bar arrives a beat later and shifts it). */
async function settledCanvas(page) {
  let box = await page.locator('#canvas').boundingBox();
  await expect.poll(async () => { const next = await page.locator('#canvas').boundingBox(); const same = next.y === box.y && next.height === box.height; box = next; return same; }).toBe(true);
  return box;
}

async function openBlankCanvas(page) {
  await openFreshEditor(page, { e2e: true });
  await page.locator('[data-home] [data-template-id="blank"]').click();
  await expect(page.locator('#app.has-project')).toHaveCount(1);
  await expect(page.locator('#canvas svg svg')).toHaveAttribute('viewBox', '0 0 240 240');
  return settledCanvas(page);
}

/** Draw a rectangle from one canvas fraction to another; returns its id. */
async function drawRect(page, canvas, from, to) {
  await page.locator('[data-design-tool="rect"]').click();
  const a = { x: canvas.x + canvas.width * from[0], y: canvas.y + canvas.height * from[1] };
  const b = { x: canvas.x + canvas.width * to[0], y: canvas.y + canvas.height * to[1] };
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
  await expect.poll(() => page.locator('#app').getAttribute('data-canvas-tool')).toBe('select');
  const id = (await session(page)).id;
  expect(id).toBeTruthy();
  return id;
}

async function dragBy(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
  await page.mouse.up();
}

test('@critical Shift+click selects several pieces, and dragging any of them moves them all in one undo step', async ({ page }) => {
  const canvas = await openBlankCanvas(page);
  const first = await drawRect(page, canvas, [.2, .5], [.35, .62]);
  const second = await drawRect(page, canvas, [.6, .5], [.8, .58]);
  expect(await session(page)).toEqual({ id: second, ids: [second] });

  const box = await boxOf(page, first);
  await page.keyboard.down('Shift');
  await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2);
  await page.keyboard.up('Shift');
  await expect.poll(() => session(page)).toEqual({ id: first, ids: [second, first] });
  // Both are marked, both are framed, and the Inspector counts them.
  await expect(page.locator('#canvas [data-editor-selected]')).toHaveCount(2);
  await expect(page.locator('[data-multi-select] .multi-select-piece')).toHaveCount(2);
  await expect(page.locator('[data-multi-select] .multi-select-box')).toHaveCount(1);
  await expect(page.locator('[data-layer-id][aria-selected="true"]')).toHaveCount(2);
  await expect(page.locator('#inspector [data-multi-selection="2"]')).toBeVisible();
  await expect(page.locator('#tool-options .tool-arrange')).toContainText('2 selected');

  // A drag on one of them moves both, by the same amount.
  await dragBy(page, { x: box.x + box.w / 2, y: box.y + box.h / 2 }, 40, 30);
  await expect.poll(async () => (await baseOf(page, first)).x).toBeGreaterThan(5);
  const [a, b] = [await baseOf(page, first), await baseOf(page, second)];
  expect(Math.abs(a.x - b.x)).toBeLessThan(0.01);
  expect(Math.abs(a.y - b.y)).toBeLessThan(0.01);
  expect(a.y).toBeGreaterThan(5);
  expect(await session(page)).toEqual({ id: first, ids: [second, first] });

  // One undo step for the whole drag.
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await baseOf(page, first)).x).toBe(0);
  expect(await baseOf(page, second)).toEqual({ x: 0, y: 0 });

  // A click on one piece selects that piece alone; a click on empty canvas, nothing.
  await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2);
  await expect.poll(() => session(page)).toEqual({ id: first, ids: [first] });
  await page.mouse.click(canvas.x + canvas.width * .5, canvas.y + canvas.height * .92);
  await expect.poll(() => session(page)).toEqual({ id: null, ids: [] });
});

test('a marquee selects what it surrounds, not what it merely touches', async ({ page }) => {
  const canvas = await openBlankCanvas(page);
  const left = await drawRect(page, canvas, [.15, .5], [.3, .58]);
  const middle = await drawRect(page, canvas, [.45, .55], [.55, .68]);
  const right = await drawRect(page, canvas, [.7, .5], [.85, .56]);
  await page.mouse.click(canvas.x + canvas.width * .5, canvas.y + canvas.height * .92);
  await expect.poll(() => session(page)).toEqual({ id: null, ids: [] });

  const m = await boxOf(page, middle), r = await boxOf(page, right);
  // Around the middle and the right one; the left one is only touched by the drag's path, not surrounded.
  await dragBy(page, { x: m.x - 12, y: Math.min(m.y, r.y) - 12 }, (r.x + r.w + 12) - (m.x - 12), (Math.max(m.y + m.h, r.y + r.h) + 12) - (Math.min(m.y, r.y) - 12));
  await expect.poll(() => session(page)).toEqual({ id: right, ids: [middle, right] });
  await expect(page.locator('.canvas-marquee')).toHaveCount(0);

  // Shift-drag adds to what is selected.
  const l = await boxOf(page, left);
  await page.keyboard.down('Shift');
  await dragBy(page, { x: l.x - 12, y: l.y - 12 }, l.w + 24, l.h + 24);
  await page.keyboard.up('Shift');
  await expect.poll(async () => (await session(page)).ids.sort()).toEqual([left, middle, right].sort());
});

test('Align, Spread, Group and Delete act on the whole selection, and Ctrl+A takes every piece', async ({ page }) => {
  const canvas = await openBlankCanvas(page);
  const a = await drawRect(page, canvas, [.15, .5], [.3, .6]);
  const b = await drawRect(page, canvas, [.4, .55], [.5, .72]);
  const c = await drawRect(page, canvas, [.7, .48], [.85, .55]);
  await page.keyboard.press('Control+a');
  await expect.poll(async () => (await session(page)).ids.length).toBe(3);

  await page.locator('#tool-options [data-arrange="align:top"]').click();
  await expect.poll(async () => Math.abs((await boxOf(page, a)).y - (await boxOf(page, c)).y)).toBeLessThan(1);
  expect(Math.abs((await boxOf(page, b)).y - (await boxOf(page, c)).y)).toBeLessThan(1);

  await page.locator('#tool-options [data-arrange="distribute:horizontal"]').click();
  await expect.poll(async () => {
    const [ba, bb, bc] = [await boxOf(page, a), await boxOf(page, b), await boxOf(page, c)];
    return Math.abs((bb.x - (ba.x + ba.w)) - (bc.x - (bb.x + bb.w)));
  }).toBeLessThan(1);

  await page.locator('#tool-options [data-arrange="align:middle"]').click();
  await expect.poll(async () => {
    const [ba, bb] = [await boxOf(page, a), await boxOf(page, b)];
    return Math.abs((ba.y + ba.h / 2) - (bb.y + bb.h / 2));
  }).toBeLessThan(1);

  // One group holds the three, in their paint order, and is the selection.
  await page.keyboard.press('Control+g');
  await expect.poll(() => layerIds(page)).toEqual([`g-1(${a},${b},${c})`]);
  expect((await session(page)).ids).toHaveLength(1);
  await page.keyboard.press('Control+Shift+g');
  await expect.poll(() => layerIds(page)).toEqual([`${a}()`, `${b}()`, `${c}()`]);

  await page.keyboard.press('Control+a');
  await expect.poll(async () => (await session(page)).ids.length).toBe(3);
  await page.keyboard.press('Delete');
  await expect.poll(() => layerIds(page)).toEqual([]);
  expect(await session(page)).toEqual({ id: null, ids: [] });
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await layerIds(page)).length).toBe(3);

  // One piece lines up on the working area instead.
  const box = await boxOf(page, a);
  await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2);
  await expect.poll(() => session(page)).toEqual({ id: a, ids: [a] });
  await page.locator('#tool-options [data-arrange="align:center"]').click();
  await expect.poll(async () => {
    const piece = await boxOf(page, a);
    const artboard = await page.evaluate(() => { const r = document.querySelector('#canvas .canvas-artboard').getBoundingClientRect(); return { x: r.x, w: r.width }; });
    return Math.abs((piece.x + piece.w / 2) - (artboard.x + artboard.w / 2));
  }).toBeLessThan(1);
});
