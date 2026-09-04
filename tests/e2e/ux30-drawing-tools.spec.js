import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The shape tools (docs/VECTOR_EDITING.md).
 *
 * "La gestion de la tool box semble buggée: ajouter un trait, un rectangle ou
 * autre ne fonctionne pas proprement, les éléments dessinés sont déplacés en
 * dehors de la plage de travail et ne sont pas déplaçables / sélectionnables +
 * simplement cliquer sur un outil ajoute un élément."
 *
 * Every assertion here is one of those, measured on screen.
 */
const elementCount = (page) => page.evaluate(() => Object.keys(window.__BOOP_E2E__.document().elements).length);
const selected = (page) => page.evaluate(() => window.__BOOP_E2E__.state().selectedId);
const tool = (page) => page.locator('#app').getAttribute('data-canvas-tool');
const screenBox = (page, id) => page.evaluate((elementId) => {
  const box = document.querySelector(`#canvas #${elementId}`)?.getBoundingClientRect();
  return box ? { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) } : null;
}, id);
const viewMatrix = (page) => page.evaluate(() => {
  const matrix = document.querySelector('#canvas svg svg').getScreenCTM();
  return { scale: Number(matrix.a.toFixed(3)), x: Math.round(matrix.e), y: Math.round(matrix.f) };
});

async function openArtwork(page) {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="artwork"]').click();
  await expect(page.locator('#canvas svg svg #head')).toBeVisible();
}

test('@critical a drawn shape lands exactly where it was drawn, and can be picked up at once', async ({ page }) => {
  await openArtwork(page);
  const before = await elementCount(page);
  const view = await viewMatrix(page);
  await page.locator('[data-design-tool="rect"]').click();

  const head = await page.locator('#canvas #head').boundingBox();
  const from = { x: head.x + head.width * .25, y: head.y + head.height * .25 };
  const to = { x: head.x + head.width * .75, y: head.y + head.height * .5 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 4 });
  // What is being drawn is visible while it is drawn, and it is chrome: it
  // lives outside the artwork until the gesture ends.
  await expect(page.locator('[data-draw-layer] rect')).toHaveCount(1);
  expect(await elementCount(page)).toBe(before);
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();

  await expect.poll(() => elementCount(page)).toBe(before + 1);
  const id = await selected(page);
  // The shape sits under the pointer that drew it. It used to be measured in
  // the outer group's coordinates and appended inside the artwork's own
  // viewBox, so it landed off the artboard and three times too big.
  const box = await screenBox(page, id);
  expect(Math.abs(box.x - from.x)).toBeLessThan(3);
  expect(Math.abs(box.y - from.y)).toBeLessThan(3);
  expect(Math.abs(box.w - (to.x - from.x))).toBeLessThan(3);
  expect(Math.abs(box.h - (to.y - from.y))).toBeLessThan(3);
  // Drawing does not re-frame the canvas.
  expect(await viewMatrix(page)).toEqual(view);
  // And the tool hands back to Select with the new shape selected, so the
  // obvious next move -- drag it -- moves it instead of drawing another one.
  await expect.poll(() => tool(page)).toBe('select');
  await page.mouse.move(box.x + box.w / 2, box.y + box.h / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.w / 2 + 40, box.y + box.h / 2 + 25, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await page.evaluate((elementId) => window.__BOOP_E2E__.document().elements[elementId].baseTransform.x, id))).toBeGreaterThan(5);
  expect(await selected(page)).toBe(id);
});

test('@critical pressing a tool or a zoom button never draws anything, and neither does a click', async ({ page }) => {
  await openArtwork(page);
  const before = await elementCount(page);
  // The toolbar is inside the canvas element, so every one of these presses
  // used to leave a 2 x 2 pixel shape behind.
  await page.locator('[data-design-tool="rect"]').click();
  await page.locator('[data-design-tool="ellipse"]').click();
  await page.locator('[data-zoom="in"]').click();
  await page.locator('[data-zoom="out"]').click();
  await page.locator('[data-puppet-toggle]').click();
  await page.locator('[data-puppet-toggle]').click();
  expect(await elementCount(page)).toBe(before);

  // A press that never moves is a press, not a drawing.
  await page.locator('[data-design-tool="rect"]').click();
  const head = await page.locator('#canvas #head').boundingBox();
  await page.mouse.click(head.x + head.width / 2, head.y + head.height / 2);
  await page.waitForTimeout(150);
  expect(await elementCount(page)).toBe(before);
  await expect.poll(() => tool(page)).toBe('rect', 'and the tool is still armed, ready for the real gesture');
});

test('the pen draws a run of points, and Escape throws it away', async ({ page }) => {
  await openArtwork(page);
  const before = await elementCount(page);
  const head = await page.locator('#canvas #head').boundingBox();
  const at = (x, y) => ({ x: head.x + head.width * x, y: head.y + head.height * y });

  await page.locator('[data-design-tool="pen"]').click();
  for (const point of [at(.2, .8), at(.5, .95), at(.8, .8)]) await page.mouse.click(point.x, point.y);
  await expect(page.locator('[data-draw-layer] path')).toHaveCount(1);
  expect(await elementCount(page)).toBe(before, 'nothing is authored until the run is closed');
  await page.keyboard.press('Enter');
  await expect.poll(() => elementCount(page)).toBe(before + 1);
  const id = await selected(page);
  expect(await page.evaluate((elementId) => document.querySelector(`#canvas #${elementId}`).getAttribute('d'), id)).toMatch(/^M .+ L .+ L /);

  // A second run, abandoned.
  await page.locator('[data-design-tool="pen"]').click();
  await page.mouse.click(at(.3, .6).x, at(.3, .6).y);
  await page.mouse.click(at(.6, .6).x, at(.6, .6).y);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-draw-layer] *')).toHaveCount(0);
  expect(await elementCount(page)).toBe(before + 1);
  await expect.poll(() => tool(page)).toBe('pen', 'Escape drops the run first, and only then the tool');
  await page.keyboard.press('Escape');
  await expect.poll(() => tool(page)).toBe('select');
});
