import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor } from './editor-helpers.js';

/**
 * New mascot, in three screens (docs/AUDIT_UI_2026-09/04_RECOMMANDATIONS.md §5).
 *
 * The audit's case for an assistant is narrow and worth restating, because it
 * is what these assertions check: an assistant that **rebuilds** is the thing
 * `type-browser.js` refuses, so this one only ever runs from Home, before there
 * is any work to lose, and every screen asks something the editor can change
 * afterwards. What it buys is discoverability — twenty-two presets and five
 * kinds of face were things you found by scrolling a 300 px column, and they
 * are now the screen.
 *
 * So the three things proved here are: every screen can be left without
 * answering it, the answers actually reach the mascot, and *Skip* is the path
 * the card had before there was a wizard.
 */
const character = (page) => page.evaluate(() => window.__BOOP_E2E__.character());
const wizard = (page) => page.locator('#create-wizard');

const openWizard = async (page) => {
  await page.locator('[data-home] [data-home-action="character"]').click();
  await expect(wizard(page)).toBeVisible();
  await expect(wizard(page).locator('[data-wizard-step="kind"]')).toBeVisible();
};

test('@critical the three screens: a kind, a preset and a palette, all of it on the mascot and all of it still changeable', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await openWizard(page);

  // 1/3 — the kinds the library can actually draw, with the reason on the ones
  // it cannot. A kind nobody drew a horn for is offered *and* says so, rather
  // than being missing from a row of four.
  await expect(wizard(page).locator('.wizard-count')).toHaveText('1 / 3');
  await expect(wizard(page).locator('[data-wizard-kind]')).toHaveCount(5);
  await expect(wizard(page).locator('[data-wizard-kind="human"]')).toBeEnabled();
  const waiting = wizard(page).locator('[data-wizard-kind]:disabled').first();
  if (await waiting.count()) await expect(waiting).toContainText(/Nothing is drawn/);

  // Choosing is also moving on: this is the whole of what the assistant buys,
  // so the presets are two presses from Home rather than four.
  await wizard(page).locator('[data-wizard-kind="human"]').click();
  await expect(wizard(page).locator('.wizard-count')).toHaveText('2 / 3');

  // 2/3 — every preset the library can dress a human face with, each with the
  // picture the library draws for it.
  const presets = wizard(page).locator('[data-wizard-preset]');
  expect(await presets.count()).toBeGreaterThan(3);
  await expect(wizard(page).locator('[data-wizard-preset="robot"] .wizard-thumb svg')).toBeVisible();
  await wizard(page).locator('[data-wizard-preset="robot"]').click();

  // 3/3 — a palette as three swatches, and a line about what the mascot comes
  // with anyway. The audit drew a "add a pair of hands" checkbox here; the
  // template already ships a rigged pair and `drawHandPair` refuses on a
  // document that has hands, so the checkbox could only have done nothing.
  await expect(wizard(page).locator('.wizard-count')).toHaveText('3 / 3');
  await expect(wizard(page).locator('[data-wizard-palette]').first().locator('.wizard-swatches i')).toHaveCount(3);
  await expect(wizard(page).locator('input[type="checkbox"]')).toHaveCount(0);
  await expect(wizard(page).locator('[data-wizard-hands-note]')).toContainText('rigged pair of hands');
  await wizard(page).locator('[data-wizard-palette="cool"]').click();
  await expect(wizard(page).locator('[data-wizard-next]')).toHaveText('Make it');
  await wizard(page).locator('[data-wizard-next]').click();

  // The mascot the three answers describe, in Design ▸ Face with the presets open.
  await expect(wizard(page)).toBeHidden();
  await expect(page.locator('#app.has-project[data-workspace="character"]')).toHaveCount(1);
  await expect(page.locator('#part-browser[data-part-ready="true"][data-part-active="presets"]')).toBeVisible();
  const made = await character(page);
  expect(made.preset, 'the preset chosen on screen 2 is on the face').toBe('robot');
  // The whole palette, not one token: twelve retints in one transaction.
  expect(made.palette.skin.toLowerCase(), 'the palette chosen on screen 3 painted the face').toBe('#e9d6c4');
  expect(made.palette.pupil.toLowerCase(), 'and its eyes, in the same press').toBe('#243b53');
  expect(made.hands.map((hand) => hand.side).sort(), 'the pair the template ships, rigged').toEqual(['left', 'right']);

  // Nothing it did is a decision: a different preset is one press, in the panel
  // the wizard left open.
  await page.locator('[data-face-preset="classic"]').click();
  await expect.poll(async () => (await character(page)).preset).toBe('classic');
});

test('every screen can be left without answering it, and Back undoes the answer', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await openWizard(page);

  // Next without choosing: the template's own kind, and its presets.
  await wizard(page).locator('[data-wizard-next]').click();
  await expect(wizard(page).locator('.wizard-count')).toHaveText('2 / 3');
  await expect(wizard(page).locator('[data-wizard-preset]').first()).toBeVisible();

  // Back, then a kind: the shortcut is never a trap.
  await wizard(page).locator('[data-wizard-back]').click();
  await expect(wizard(page).locator('.wizard-count')).toHaveText('1 / 3');
  await wizard(page).locator('[data-wizard-kind="robot"]').click();
  await expect(wizard(page).locator('[data-wizard-preset]').first()).toBeVisible();

  // Next past the presets, then Make it with no palette: a mascot that answered
  // one question out of three is still a mascot.
  await wizard(page).locator('[data-wizard-next]').click();
  await wizard(page).locator('[data-wizard-next]').click();
  await expect(page.locator('#app.has-project[data-workspace="character"]')).toHaveCount(1);
  const made = await character(page);
  expect(made.preset, 'no preset was chosen, so none went on').toBe(null);
  expect(made.morphology, 'the kind chosen on screen 1 is what Design offers parts for').toBe('robot');
});

test('@critical Skip and just start is the path the card had before there was a wizard', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await openWizard(page);
  await wizard(page).locator('[data-wizard-skip]').click();

  await expect(wizard(page)).toBeHidden();
  await expect(page.locator('[data-home]')).toBeHidden();
  await expect(page.locator('#app.has-project[data-workspace="character"]')).toHaveCount(1);
  await expect(page.locator('#part-browser[data-part-ready="true"][data-part-active="presets"]')).toBeVisible();
  await expect(page.locator('#toast')).toContainText('Pick a preset');
  expect((await character(page)).preset, 'Skip chooses nothing: the template as it comes').toBe(null);
});

test('Escape closes the wizard, not what is behind it, and builds nothing', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await openWizard(page);
  // The editor's own Escape chain runs before a `<dialog>`'s cancel, so the
  // wizard has to be first in it: without that, Escape over the wizard closed
  // *Home* and left the wizard standing on a blank editor.
  await page.keyboard.press('Escape');
  await expect(wizard(page)).toBeHidden();
  await expect(page.locator('[data-home]'), 'Home is still where it left you').toBeVisible();
  await expect(page.locator('#app.has-project')).toHaveCount(0);

  // And it opens again from the first screen, remembering nothing.
  await openWizard(page);
  await expect(wizard(page).locator('.wizard-count')).toHaveText('1 / 3');
  await expect(wizard(page).locator('.wizard-card-on')).toHaveCount(0);
});

test('the keyboard walks it: the question is what focus lands on, and Tab from there is the first card', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await openWizard(page);
  await expect(wizard(page).locator('[data-wizard-title]')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(wizard(page).locator('[data-wizard-kind="human"]')).toBeFocused();
  await page.keyboard.press('Enter');
  // The next screen's question, not a button left over from the last one.
  await expect(wizard(page).locator('[data-wizard-title]')).toBeFocused();
  await expect(wizard(page).locator('[data-wizard-title]')).toHaveText('Pick one to start from');
});

test('nothing of the mascot is touched until Make it: the wizard runs from Home, before there is work to lose', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  // A mascot already open, and a change of its own.
  await page.locator('[data-home] [data-template-id="basic"]').click();
  await goToMode(page, 'design.face');
  await expect(page.locator('#part-browser[data-part-ready="true"]')).toBeVisible();
  await page.locator('[data-part-category="presets"]').click();
  await page.locator('[data-face-preset="robot"]').click();
  await expect.poll(async () => (await character(page)).preset).toBe('robot');

  // Home, then the wizard, then away from it: the face is as it was.
  await page.locator('#home-button').click();
  await page.locator('[data-home] [data-home-action="character"]').click();
  await wizard(page).locator('[data-wizard-kind="human"]').click();
  await wizard(page).locator('[data-wizard-preset]').first().click();
  await page.keyboard.press('Escape');
  await page.locator('[data-home-action="back"]').click();
  expect((await character(page)).preset, 'three screens of choosing wrote nothing').toBe('robot');
});
