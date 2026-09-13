import { expect, test } from '@playwright/test';
import { goToMode, openFreshEditor } from './editor-helpers.js';

/** Design ▸ Face, with its part browser drawn. */
async function openCharacter(page) {
  await goToMode(page, 'design.face');
  await expect(page.locator('#part-browser[data-part-ready="true"]')).toBeVisible();
}

/**
 * UI-REDESIGN-04 — the library narrows to what an author is making, and opens
 * on request.
 *
 * The engine under this was already right (MASC-04). What is new is that the
 * row says how many drawings it holds, can be searched by the words a drawing
 * was tagged with, sorts itself by the character being made, and has a door
 * out of the kind of mascot that names what it would do before it is pressed.
 */

const cards = (page) => page.locator('[data-face-part]');
const openEars = async (page) => { await page.locator('[data-part-category="ears"]').click(); await expect(cards(page).first()).toBeVisible(); };

/**
 * A fox, through the wizard.
 *
 * The kind matters to every test here: the human library the template ships
 * carries no tags at all — its three ears are Round, Large and Small — so it is
 * the wrong face to prove a search over tags, an affinity between drawings, or
 * a door out of a kind. The Soft Cartoon packs are where the vocabulary lives.
 */
async function openFox(page) {
  await openFreshEditor(page, { e2e: true });
  await page.locator('[data-home-action="character"]').click();
  await page.locator('[data-wizard-type="muzzle"]').click();
  await page.locator('[data-wizard-character="fox"]').click();
  await page.locator('[data-wizard-create]').click();
  await expect(page.locator('#app.has-project')).toHaveCount(1);
  await openCharacter(page);
}

test('@critical a row says how many drawings it holds, and can be searched by tag', async ({ page }) => {
  await openFox(page);
  await openEars(page);

  const all = await cards(page).count();
  await expect(page.locator('.part-styles-count')).toHaveText(`${all} drawings`);

  // A tag is a word nobody put in a name: `pointed` is on the cat's, the fox's
  // and the wolf's ears, and searching finds them by it.
  await page.locator('[data-part-search]').fill('pointed');
  await expect.poll(async () => cards(page).count()).toBeLessThan(all);
  expect(await cards(page).count()).toBeGreaterThan(0);

  // Two words narrow further rather than wider.
  await page.locator('[data-part-search]').fill('cat pointed');
  await expect.poll(async () => cards(page).count()).toBe(1);

  // The field keeps the focus and the caret across the redraw each letter causes.
  await expect(page.locator('[data-part-search]')).toBeFocused();

  // A search that finds nothing keeps the field it was typed into: an empty
  // row that took the search box with it would strand whoever typed.
  await page.locator('[data-part-search]').fill('zzz');
  await expect(cards(page)).toHaveCount(0);
  await expect(page.locator('[data-part-styles="ears"]')).toContainText('Nothing matches');
  await expect(page.locator('[data-part-search]')).toBeVisible();
});

test('@critical the way past the kind of mascot names what it would do, and is never the default', async ({ page }) => {
  await openFox(page);
  await openEars(page);

  const compatible = await cards(page).count();
  const hatch = page.locator('[data-part-show-all]');
  await expect(hatch).toHaveText(/^\+\d+ more$/, { useInnerText: true });
  await expect(page.locator('.part-style-other')).toHaveCount(0);

  await hatch.click();
  await expect.poll(async () => cards(page).count()).toBeGreaterThan(compatible);
  // Every drawing the kind was holding back says so before it is pressed.
  expect(await page.locator('.part-style-other').count()).toBe(await cards(page).count() - compatible);
  await expect(page.locator('[data-part-show-all]')).toHaveText('Compatible only');

  // It never widens the row: ears are ears, however far past the kind one looks.
  const ids = await cards(page).evaluateAll((nodes) => nodes.map((node) => node.dataset.facePart));
  expect(ids.every((id) => id.startsWith('ears.'))).toBe(true);

  await page.locator('[data-part-show-all]').click();
  await expect.poll(async () => cards(page).count()).toBe(compatible);

  // And it is a door, not a mode: another row opens closed.
  await hatch.click();
  await expect.poll(async () => cards(page).count()).toBeGreaterThan(compatible);
  await page.locator('[data-part-category="hair"]').click();
  await page.locator('[data-part-category="ears"]').click();
  await expect.poll(async () => cards(page).count()).toBe(compatible);
});

test('@critical the character being made sorts its own rows', async ({ page }) => {
  await openFox(page);
  await openEars(page);

  // A fox is tagged `fox`, `vulpine`, `animal`, and the ears drawn for one
  // carry the same words — so they come first, without anything having been
  // written down about ears.
  const ids = await cards(page).evaluateAll((nodes) => nodes.map((node) => node.dataset.facePart));
  expect(ids[0]).toBe('ears.fox-large-pointed');
  // Sorting, not filtering: every ear this kind of mascot can wear is still here.
  expect(ids.length).toBeGreaterThan(4);
  expect(ids).toContain('ears.round');
});
