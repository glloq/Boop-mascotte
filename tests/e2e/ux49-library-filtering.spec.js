import { expect, test } from '@playwright/test';
import { goToMode, openFreshEditor } from './editor-helpers.js';

/** Design ▸ Face, with its part browser drawn. */
async function openCharacter(page) {
  await goToMode(page, 'design.face');
  await expect(page.locator('#part-browser[data-part-ready="true"]')).toBeVisible();
}

/**
 * UI-REDESIGN-04 — the library sorts itself by the character being made.
 *
 * The engine under the narrowing was already right (MASC-04), the search field
 * and the way past the kind of face are held by `ux45-character-builder.spec.js`,
 * and the rows a library cannot fill are held in `character-builder.test.js`.
 * What is left here is the one thing only a real browser can show: the order
 * the cards come out in, on a mascot the wizard actually made.
 */

const cards = (page) => page.locator('[data-face-part]');
const openEars = async (page) => { await page.locator('[data-part-category="ears"]').click(); await expect(cards(page).first()).toBeVisible(); };

/**
 * A fox, through the wizard.
 *
 * The kind matters to every test here: the human library the template ships
 * carries no tags at all — its three ears are Round, Large and Small — so it is
 * the wrong face to prove an affinity between drawings. The Soft Cartoon packs
 * are where the vocabulary lives.
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
