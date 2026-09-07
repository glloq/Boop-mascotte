import { test, expect } from '@playwright/test';
import { hitTestablePoint, openFreshEditor, startBasicFace } from './editor-helpers.js';

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
  await page.locator('[data-task="artwork"]').click();
  await expect(page.locator('[data-artboard]')).toBeVisible();
}

test('@critical the working area is drawn, resizable, and says when it is cutting', async ({ page }) => {
  await openArtwork(page);
  // The edge is on the canvas, in the artwork's own units.
  await expect(page.locator('.canvas-artboard')).toHaveCount(1);
  expect(await viewBox(page)).toBe('0 0 240 240');
  await expect(page.locator('[data-artboard-field="height"]')).toHaveValue('240');
  await expect(page.locator('[data-artboard-overflow]')).toContainText('inside it');
  await expect(page.locator('[data-artboard-action="fit"]')).toBeDisabled();

  // Making it smaller cuts the drawing — and now the editor says so instead of
  // leaving an author to wonder where their hair went.
  await page.locator('[data-artboard-field="height"]').fill('150');
  await page.locator('[data-artboard-field="height"]').press('Enter');
  await expect.poll(() => viewBox(page)).toBe('0 0 240 150');
  await expect(page.locator('[data-artboard-overflow]')).toContainText('past the bottom');
  await expect(page.locator('[data-artboard-action="fit"]')).toBeEnabled();

  // And Fit puts the border back around everything.
  await page.locator('[data-artboard-action="fit"]').click();
  await expect(page.locator('[data-artboard-overflow]')).toContainText('inside it');
  const fitted = (await viewBox(page)).split(' ').map(Number);
  expect(fitted[3]).toBeGreaterThan(150);

  // One undo step each, and the working area is part of the artwork.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => viewBox(page)).toBe('0 0 240 150');
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
  await page.locator('[data-canvas-menu-action="release-clip"]').click();
  const clipOn = async (id) => new RegExp(`<g id="${id}"[^>]*clip-path=`).test((await documentOf(page)).svgMarkup);
  await expect.poll(() => clipOn('hairFront')).toBe(false, 'the fringe stops being cut');
  // And only the fringe's: the face shading is cut to the same `headShape`, and
  // the eyes to their own sockets.
  expect(await clipOn('faceShading')).toBe(true);
  expect(await clipOn('eyeLeft')).toBe(true);
  await expect(page.locator('.canvas-clip-outline')).toHaveCount(0);

  // Taking a clip off is one undo step, like every other edit to the artwork.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await documentOf(page)).svgMarkup.includes('clip-path="url(#headShape)"')).toBe(true);
});
