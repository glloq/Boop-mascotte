import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The Create workspace (VNX-07, docs/VNEXT_ROADMAP.md).
 *
 * Artwork and Face Setup are two steps of one job: make the mascot. They had
 * nothing in common on screen — moving between them replaced the whole left
 * column, so the tree of what you are building disappeared exactly when you
 * started assigning parts of it.
 *
 * The structure is one column now, shared by every step of Create, and gone
 * outside it: the layer tree is not what an author is thinking about while
 * shaping an expression or wiring a reaction.
 */

const stage = (page, id) => page.locator(`.stage-tab[data-stage="${id}"]`);

test('@critical the structure of the mascot stays put across every step of Create', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  await expect(page.locator('.structure-tools')).toBeVisible();
  await expect(page.locator('#layers-panel')).toBeVisible();
  const pieces = await page.locator('#layers-panel [data-layer-id]').count();
  expect(pieces, 'the template drew nothing into the tree').toBeGreaterThan(0);

  // The step changes; the thing being built does not.
  await page.locator('[data-task="face-setup"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'rig');
  await expect(page.locator('.structure-tools'), 'the tree vanished on the way to Face Setup').toBeVisible();
  await expect(page.locator('#layers-panel [data-layer-id]')).toHaveCount(pieces);

  await page.locator('[data-task="artwork"]').click();
  await expect(page.locator('.structure-tools')).toBeVisible();
});

test('the structure column belongs to Create and does not follow the author out of it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  for (const id of ['animate', 'behaviors', 'publish']) {
    await stage(page, id).click();
    await expect(page.locator('.structure-tools'), `the layer tree followed the author into ${id}`).toBeHidden();
  }
  await stage(page, 'create').click();
  await expect(page.locator('.structure-tools')).toBeVisible();
});
