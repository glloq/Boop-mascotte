import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The structure of the mascot, across the workspaces that build it (VNX-07,
 * rehomed by UIR-01).
 *
 * Artwork and the rig are steps of one job: make the mascot. They had nothing
 * in common on screen — moving between them replaced the whole left column, so
 * the tree of what you are building disappeared exactly when you started
 * assigning parts of it.
 *
 * The structure is one column now, shared by Design and Rig and gone outside
 * them: the layer tree is not what an author is thinking about while shaping an
 * expression or wiring a reaction.
 */

const workspace = (page, id) => page.locator(`.stage-tab[data-stage="${id}"]`);

test('@critical the structure of the mascot stays put across every screen that builds it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  await expect(page.locator('.structure-tools')).toBeVisible();
  await expect(page.locator('#layers-panel')).toBeVisible();
  const pieces = await page.locator('#layers-panel [data-layer-id]').count();
  expect(pieces, 'the template drew nothing into the tree').toBeGreaterThan(0);

  // The screen changes; the thing being built does not.
  await goToMode(page, 'rig.assign');
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'rig');
  await expect(page.locator('.structure-tools'), 'the tree vanished on the way to the rig').toBeVisible();
  await expect(page.locator('#layers-panel [data-layer-id]')).toHaveCount(pieces);

  await goToMode(page, 'design.artwork');
  await expect(page.locator('.structure-tools')).toBeVisible();
});

test('the structure column belongs to Design and Rig and does not follow the author out of them', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  for (const id of ['animate', 'behavior']) {
    await workspace(page, id).click();
    await expect(page.locator('.structure-tools'), `the layer tree followed the author into ${id}`).toBeHidden();
  }
  await goToMode(page, 'design.artwork');
  await expect(page.locator('.structure-tools')).toBeVisible();
});
