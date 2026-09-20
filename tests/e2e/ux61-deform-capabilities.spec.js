import { test, expect } from '@playwright/test';
import { openFreshEditor, openHoldingTopic, openSetupSection, startBasicFace } from './editor-helpers.js';

/**
 * The two capabilities §12 names for Rig ▸ Deform that the editor never had
 * (UX-60 PR 8).
 *
 * Both were already in the runtime and in the document: a shape key is how a
 * head position, a face state and a *Change shape* movement all deform an
 * outline, and every element carries a `depth` the head pose nudges it by.
 * Neither had a surface, so a shape key with a driver that no longer exists
 * was a deformation nobody could find, and a depth was a number only the face
 * library could write.
 */
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());

async function openDeform(page, topic) {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openSetupSection(page, 'holding');
  await expect(page.locator('[data-holding-panel]')).toBeVisible();
  await openHoldingTopic(page, topic);
}

test('@critical every shape key is listed, re-drivable and forgettable', async ({ page }) => {
  await openDeform(page, 'shapes');
  const before = await documentOf(page);
  expect(before.shapeKeys.length, 'the template ships correctives').toBeGreaterThan(0);

  const rows = page.locator('[data-shape-key]');
  await expect(rows).toHaveCount(before.shapeKeys.length);
  const first = before.shapeKeys[0];
  const row = page.locator(`[data-shape-key="${first.id}"]`);
  await expect(row).toBeVisible();

  // What moves it is a movement of this mascot, chosen from the ones it has.
  await row.locator('[data-shape-key-driver]').selectOption('smile');
  await expect.poll(async () => (await documentOf(page)).shapeKeys.find((key) => key.id === first.id)?.driver?.parameter).toBe('smile');

  // And "nothing on its own" is a real answer: a head-pose cell drives its own.
  await row.locator('[data-shape-key-driver]').selectOption('');
  await expect.poll(async () => (await documentOf(page)).shapeKeys.find((key) => key.id === first.id)?.driver?.mode).toBe('none');

  // Forgetting one leaves the artwork exactly as it was.
  const artwork = (await documentOf(page)).svgMarkup;
  await row.locator('[data-holding-action="forget-shape"]').click();
  await expect.poll(async () => (await documentOf(page)).shapeKeys.some((key) => key.id === first.id)).toBe(false);
  expect((await documentOf(page)).svgMarkup, 'a shape key is a difference applied at draw time').toBe(artwork);

  // One undo step each, and the last one comes back whole.
  await page.locator('#undo').click();
  await expect.poll(async () => (await documentOf(page)).shapeKeys.some((key) => key.id === first.id)).toBe(true);
});

test('@critical a piece can be given a depth, and the nudge can be turned off', async ({ page }) => {
  await openDeform(page, 'depth');
  // Selecting a piece puts it in the list with a slider, whatever its depth is.
  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => { state.selectedId = 'head'; }));
  const row = page.locator('[data-depth-row="head"]');
  await expect(row).toBeVisible();
  await expect(row).toHaveAttribute('data-depth-selected', 'true');

  const slider = row.locator('[data-depth-field="head"]');
  await slider.fill('0.6');
  await slider.dispatchEvent('change');
  await expect.poll(async () => (await documentOf(page)).elements.head.depth).toBeCloseTo(0.6, 2);
  await expect(page.locator('[data-depth-row="head"] [data-depth-band]')).toContainText('front');

  // Flat is a press, and it is one undo step away from where it was.
  await page.locator('[data-depth-row="head"] [data-holding-action="flatten"]').click();
  await expect.poll(async () => (await documentOf(page)).elements.head.depth).toBe(0);
  await page.locator('#undo').click();
  await expect.poll(async () => (await documentOf(page)).elements.head.depth).toBeCloseTo(0.6, 2);

  // The settings the nudge is made of, which nothing could reach before.
  await page.locator('[data-depth-parallax="enabled"]').uncheck();
  await expect.poll(async () => (await documentOf(page)).parallax.enabled).toBe(false);
  await page.locator('[data-depth-parallax="drawOrder"]').uncheck();
  await expect.poll(async () => (await documentOf(page)).parallax.drawOrder).toBe(false);
  const amount = page.locator('[data-depth-parallax="amount"]');
  await amount.fill('14');
  await amount.dispatchEvent('change');
  await expect.poll(async () => (await documentOf(page)).parallax.amount).toBe(14);
});
