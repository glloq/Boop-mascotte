import { test, expect } from '@playwright/test';
import { hitTestablePoint, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * Editing one piece of the mascot where it is drawn (docs/VECTOR_EDITING.md).
 *
 * "Il va falloir qu'on ajoute la possibilité d'éditer plus proprement chaque
 * sous-partie de la mascotte (clic droit → éditer ?)".
 */
const menu = (page) => page.locator('[data-canvas-menu]');
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const selected = (page) => page.evaluate(() => window.__BOOP_E2E__.state().selectedId);
const task = (page) => page.evaluate(() => window.__BOOP_E2E__.task());

/** The template's idle behaviors keep the head moving, and a thin stroke is a small target. */
const settle = (page) => page.evaluate(() => window.__BOOP_E2E__.mutate((state) => { for (const behavior of state.behaviors) behavior.enabled = false; }));

/** On the artwork itself: the middle of a stroked curve's box is the face behind it. */
async function rightClick(page, selector) {
  const point = await hitTestablePoint(page.locator(selector));
  await page.mouse.click(point.x, point.y, { button: 'right' });
  await expect(menu(page)).toBeVisible();
}

test('@critical right-clicking a piece of the mascot selects it and edits it in place', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="artwork"]').click();
  await settle(page);
  await rightClick(page, '#canvas #mouth');
  await expect(menu(page)).toHaveAttribute('data-canvas-menu-for', 'mouth');
  expect(await selected(page)).toBe('mouth');
  // It says what the piece is and which face part owns it.
  await expect(menu(page)).toContainText('Part of Mouth');

  // Rename: the name lands in the document and in the Layers tree.
  await page.locator('[data-canvas-menu-name]').fill('Lip line');
  await page.keyboard.press('Enter');
  await expect(menu(page)).toBeHidden();
  await expect.poll(async () => (await documentOf(page)).layerMetadata?.mouth?.name).toBe('Lip line');
  await expect(page.locator('#left')).toContainText('Lip line');

  // Duplicate: one new element, and it is the one now selected.
  const before = Object.keys((await documentOf(page)).elements).length;
  await rightClick(page, '#canvas #mouth');
  await page.locator('[data-canvas-menu-action="duplicate"]').click();
  await expect(menu(page)).toBeHidden();
  await expect.poll(async () => Object.keys((await documentOf(page)).elements).length).toBe(before + 1);
  const copy = await selected(page);
  expect(copy).not.toBe('mouth');

  // Delete: gone, and undo brings it back.
  await rightClick(page, `#canvas #${copy}`);
  await page.locator('[data-canvas-menu-action="delete"]').click();
  await expect.poll(async () => Object.keys((await documentOf(page)).elements).length).toBe(before);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => Object.keys((await documentOf(page)).elements).length).toBe(before + 1);
});

test('the menu routes to the tools that edit a piece properly', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="artwork"]').click();
  await settle(page);

  // A path offers its points; the Node tool opens on it.
  await rightClick(page, '#canvas #mouth');
  await page.locator('[data-canvas-menu-action="points"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-canvas-tool', 'node');
  await expect.poll(() => page.locator('.rig-node-handle').count()).toBeGreaterThan(0);
  await page.keyboard.press('Escape');

  // Artwork with a face part goes to that part; artwork without one goes to
  // the checklist that assigns it.
  await rightClick(page, '#canvas #mouth');
  await page.locator('[data-canvas-menu-action="part"]').click();
  await expect.poll(() => task(page)).toBe('face-setup');
  await page.locator('[data-task="artwork"]').click();
  await settle(page);
  await rightClick(page, '#canvas #blushLeft');
  await expect(menu(page)).toContainText('Not assigned to a face part');
  await page.locator('[data-canvas-menu-action="assign"]').click();
  await expect.poll(() => task(page)).toBe('face-setup');
});

test('hide, lock and Escape behave the way the Layers panel does', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="artwork"]').click();
  await settle(page);
  await rightClick(page, '#canvas #nose');
  await page.locator('[data-canvas-menu-action="visibility"]').click();
  await expect(page.locator('#canvas #nose')).toBeHidden();
  await rightClick(page, '#canvas #blushRight');
  await page.locator('[data-canvas-menu-action="lock"]').click();
  await expect.poll(async () => (await documentOf(page)).layerMetadata?.blushRight?.locked).toBe(true);

  // Escape closes it without doing anything.
  await rightClick(page, '#canvas #head');
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  // And the keyboard opens it for the selection, so it is not a mouse-only gesture.
  await page.keyboard.press('Shift+F10');
  await expect(menu(page)).toBeVisible();
  await expect(menu(page)).toHaveAttribute('data-canvas-menu-for', 'head');
});
