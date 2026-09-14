import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The two columns, at the width the author wants them
 * (docs/AUDIT_UI_2026-09/02_PROBLEMES.md §10.1).
 *
 * `300px` of tools and `310px` of inspector, both fixed, left 670 px of a
 * 1280 px screen for the mascot — 52 %. The only control was collapsing a
 * column whole. These are the Timeline's separator turned on its side, and
 * what they are measured on here is the thing that matters: how much of the
 * screen the canvas ends up with.
 */
const widthOf = (page, selector) => page.locator(selector).evaluate((node) => Math.round(node.getBoundingClientRect().width));

async function openDesktop(page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToMode(page, 'design.face');
  await expect(page.locator('#app[data-layout="desktop"]')).toHaveCount(1);
}

test('@critical a drag gives the canvas the room, and the width survives a reload', async ({ page }) => {
  await openDesktop(page);
  const before = await widthOf(page, '#canvas');
  expect(await widthOf(page, '#left')).toBe(300);

  // Drag the left boundary in by 80 px: the tools give it up and the canvas takes it.
  const handle = page.locator('#left-resize');
  await expect(handle).toBeVisible();
  const box = await handle.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + 300, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => widthOf(page, '#left')).toBe(220);
  expect(await widthOf(page, '#canvas'), 'the canvas gained exactly what the column lost').toBe(before + 80);
  // The handle rides the boundary it is the handle for.
  const moved = await handle.boundingBox();
  expect(Math.round(moved.x + moved.width / 2)).toBe(220);

  // And the inspector's boundary, the other way.
  const right = page.locator('#right-resize');
  const rightBox = await right.boundingBox();
  await page.mouse.move(rightBox.x + rightBox.width / 2, rightBox.y + 300);
  await page.mouse.down();
  await page.mouse.move(rightBox.x + rightBox.width / 2 - 90, rightBox.y + 300, { steps: 10 });
  await page.mouse.up();
  await expect.poll(() => widthOf(page, '.panel-right')).toBe(400);

  // Kept: a column dragged once stays dragged, on the next visit.
  await page.reload();
  await expect(page.locator('[data-editor-ready="true"]')).toHaveCount(1);
  expect(await widthOf(page, '#left')).toBe(220);
  expect(await widthOf(page, '.panel-right')).toBe(400);
});

test('neither column can eat the canvas, and neither can shrink below its own contents', async ({ page }) => {
  await openDesktop(page);
  // Asked for far more than there is room for: the canvas keeps its 360 px.
  await page.evaluate(() => { window.__BOOP_E2E__.setColumnWidth('left', 5000); window.__BOOP_E2E__.setColumnWidth('right', 5000); });
  expect(await widthOf(page, '#canvas')).toBeGreaterThanOrEqual(360);
  const total = (await widthOf(page, '#left')) + (await widthOf(page, '#canvas')) + (await widthOf(page, '.panel-right'));
  expect(total).toBeLessThanOrEqual(1280);

  // And asked for nothing: the library's grid still fits three cards.
  await page.evaluate(() => window.__BOOP_E2E__.setColumnWidth('left', 0));
  expect(await widthOf(page, '#left')).toBe(220);
  await expect(page.locator('#part-browser')).toBeVisible();
});

test('the separator is a focus stop that does something: arrows, and a double-click back to the default', async ({ page }) => {
  await openDesktop(page);
  const handle = page.locator('#left-resize');
  await handle.focus();
  await expect(handle).toBeFocused();
  await expect(handle).toHaveAttribute('role', 'separator');
  await expect(handle).toHaveAttribute('aria-valuenow', '300');

  await page.keyboard.press('ArrowRight');
  await expect.poll(() => widthOf(page, '#left')).toBe(320);
  await page.keyboard.press('Shift+ArrowRight');
  await expect.poll(() => widthOf(page, '#left')).toBe(380);
  await page.keyboard.press('ArrowLeft');
  await expect.poll(() => widthOf(page, '#left')).toBe(360);
  await expect(handle).toHaveAttribute('aria-valuenow', '360');

  // Home, and a double-click, are both the way back.
  await page.keyboard.press('Home');
  await expect.poll(() => widthOf(page, '#left')).toBe(300);
  await page.keyboard.press('ArrowRight');
  await handle.dblclick();
  await expect.poll(() => widthOf(page, '#left')).toBe(300);
});

test('a boundary that is not there is not offered: collapsed, in Preview, and on a phone', async ({ page }) => {
  await openDesktop(page);
  await expect(page.locator('#left-resize')).toBeVisible();
  await expect(page.locator('#right-resize')).toBeVisible();

  await page.locator('#collapse-left').click();
  await expect(page.locator('#left-resize')).toBeHidden();
  await expect(page.locator('#right-resize'), 'the other column still has a boundary').toBeVisible();
  await page.locator('#collapse-left').click();
  await expect(page.locator('#left-resize')).toBeVisible();

  // Preview hides the tools column altogether.
  await goToMode(page, 'preview');
  await expect(page.locator('#left-resize')).toBeHidden();
  await expect(page.locator('#right-resize')).toBeVisible();
  await goToMode(page, 'design.face');

  // On a phone the columns are a drawer and a sheet: overlays, with no
  // boundary to drag.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#app[data-layout="phone"]')).toHaveCount(1);
  await expect(page.locator('#left-resize')).toBeHidden();
  await expect(page.locator('#right-resize')).toBeHidden();
});
