import { expect, test } from '@playwright/test';
import { openFreshEditor } from './editor-helpers.js';

/**
 * UI-REDESIGN-02 / 03 — the first minute, in the browser.
 *
 * The study that led here measured the old one at three blockers and five
 * frictions, and the first blocker was that nothing ever asked what the author
 * wanted to make: the kind was a collapsed accordion row in second position of
 * a list of sixteen, named `Type`, offering `Muzzle`, `Beak` and `Monster`, and
 * when nobody pressed it the editor answered `human` in silence — so 48 of 150
 * drawings and 6 of 22 characters.
 *
 * This spec walks the path a person actually takes, and asserts the two things
 * that make it work: the question comes first, and the answer reaches the
 * editor.
 */

const home = (page) => page.locator('[data-home]');
const wizard = (page) => page.locator('[data-wizard]');

test('@critical Home says what the editor is for and offers one way in', async ({ page }) => {
  await openFreshEditor(page);
  await expect(home(page)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create and animate your mascot' })).toBeVisible();
  // A mascot editor whose first page shows a mascot.
  await expect(page.locator('.home-hero svg')).toBeVisible();
  // Exactly one primary action, and the second way in is a button rather than
  // a sentence explaining where a button is.
  await expect(page.locator('[data-home] .primary')).toHaveCount(1);
  await expect(page.locator('[data-home-action="open"]')).toBeVisible();
  // With nothing to continue, the section is absent rather than saying "no".
  await expect(page.locator('.home-recovery')).toBeHidden();
  // And the project bar is the brand and the menu: Export and Project check in
  // front of somebody with no project can only disappoint.
  for (const id of ['#export-top', '#validate', '#save-project-top', '#undo']) {
    await expect(page.locator(id), `${id} is not offered before there is a project`).toBeHidden();
  }
  await expect(page.locator('#home-button')).toBeVisible();
});

test('@critical the first question is the kind of mascot, before any library', async ({ page }) => {
  await openFreshEditor(page);
  await page.locator('[data-home-action="character"]').click();
  await expect(wizard(page)).toBeVisible();

  const kinds = page.locator('[data-wizard-type]');
  await expect(kinds).toHaveCount(4);
  expect(await kinds.evaluateAll((nodes) => nodes.map((node) => node.dataset.wizardType)))
    .toEqual(['human', 'muzzle', 'beak', 'robot']);
  // Named for what is being made, never for the anatomy that makes it.
  await expect(page.locator('.wizard-types')).toContainText('Animal');
  await expect(page.locator('.wizard-types')).toContainText('Bird');
  await expect(page.locator('.wizard-types')).not.toContainText('Muzzle');
  await expect(page.locator('.wizard-types')).not.toContainText('Beak');
  // Pictures, not a dropdown: each card carries the kind's real drawing.
  await expect(page.locator('[data-wizard-type="beak"] svg')).toBeVisible();
  await expect(wizard(page).locator('select')).toHaveCount(0);
});

test('@critical a bird is chosen from six birds, and the editor opens offering birds', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('[data-home-action="character"]').click();
  await page.locator('[data-wizard-type="beak"]').click();

  // Only this kind's characters, and all six of them.
  const characters = page.locator('[data-wizard-character]');
  await expect(characters).toHaveCount(6);
  expect(await characters.evaluateAll((nodes) => nodes.map((node) => node.dataset.wizardCharacter)))
    .toEqual(['owl', 'duck', 'parrot', 'crow', 'cute-bird', 'slim-bird']);
  await expect(page.locator('.wizard-choices')).toContainText('Bird');

  // The result is the larger half of the screen, and follows the choice.
  await page.locator('[data-wizard-character="duck"]').click();
  await expect(page.locator('[data-wizard-character="duck"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-wizard-preview-name]')).toHaveText('Duck');

  // The action names the character, so it can never point at whichever card
  // the pointer happens to be over.
  await expect(page.locator('[data-wizard-create]')).toHaveText('Create Duck →');
  await page.locator('[data-wizard-create]').click();
  await expect(wizard(page)).toBeHidden();
  await expect(page.locator('#app.has-project')).toHaveCount(1);
  await expect(page.locator('#app[data-mode="design.face"]')).toHaveCount(1);

  // The answer reached the editor: the kind is set, the character is worn, and
  // Design is offering that kind rather than the human default.
  const character = await page.evaluate(() => window.__BOOP_E2E__.character());
  expect(character).toMatchObject({ morphology: 'beak', preset: 'duck' });
});

test('@critical the kind can be changed, and Cancel leaves everything alone', async ({ page }) => {
  await openFreshEditor(page);
  await page.locator('[data-home-action="character"]').click();
  await page.locator('[data-wizard-type="robot"]').click();
  await expect(page.locator('[data-wizard-character]')).toHaveCount(4);

  // Back names the step it returns to, not "Previous".
  await expect(page.locator('[data-wizard-back]')).toContainText('Robot');
  await page.locator('[data-wizard-back]').click();
  await expect(page.locator('[data-wizard-type]')).toHaveCount(4);
  await expect(page.locator('[data-wizard-back]')).toContainText('Cancel');

  // Escape is the same door.
  await page.locator('[data-wizard-type="muzzle"]').click();
  await expect(page.locator('[data-wizard-character]')).toHaveCount(6);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-wizard-type]')).toHaveCount(4);

  // And cancelling from the first step opens nothing.
  await page.locator('[data-wizard-back]').click();
  await expect(wizard(page)).toBeHidden();
  await expect(home(page)).toBeVisible();
  await expect(page.locator('#app.has-project')).toHaveCount(0);
});

test('@critical an example on Home is one press to a finished mascot', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await page.locator('[data-home-example="fox"]').click();
  await expect(page.locator('#app.has-project')).toHaveCount(1);
  const character = await page.evaluate(() => window.__BOOP_E2E__.character());
  // An example knows its own kind: a fox is an Animal, never the human default.
  expect(character).toMatchObject({ morphology: 'muzzle', preset: 'fox' });
});
