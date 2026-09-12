import { test, expect } from '@playwright/test';
import { goToPreview, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The readiness checklist, beside the thing it grades (VNX-10, rehomed by
 * UIR-01).
 *
 * Export and Problems are buttons in the app bar. They are always there, which
 * is exactly why they are never *about* anything: an author testing the mascot
 * has to leave what they are doing, hunt a toolbar, and only then find out that
 * something blocks the export.
 *
 * Deciding the mascot is finished happens where it is tested, so the readiness
 * of the whole project sits beside Preview. `Publish` is no longer a place of
 * its own; UIR-14 lifts the checklist into the app bar for good.
 */
const workspace = (page, id) => page.locator(`.stage-tab[data-stage="${id}"]`);

test('@critical Publish says what is done, what blocks, and ships it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToPreview(page);

  await expect(page.locator('[data-publish-panel]')).toBeVisible();
  // Every step of the journey is accounted for, with the same statuses the
  // stage badges and the Export panel read from one memoised model.
  const steps = page.locator('[data-publish-step]');
  await expect(steps).toHaveCount(7);
  for (const id of ['artwork', 'faceSetup', 'movements', 'expressions', 'animate', 'reactions', 'export']) {
    await expect(page.locator(`[data-publish-step="${id}"]`)).toHaveAttribute('data-publish-status', /ready|warning|error|todo|optional/);
  }

  // A finished template blocks nothing, and says so rather than staying silent.
  await expect(page.locator('#publish-panel')).toHaveAttribute('data-publish-blocking', '0');
  await expect(page.locator('[data-publish-verdict]')).toContainText('Ready');

  await page.locator('button[data-publish="export"]').click();
  await expect(page.locator('#export-panel, .export')).toBeVisible();
});

test('a step in the checklist takes the author to the step, and a blocker to its fix', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToPreview(page);

  await page.locator('[data-publish-step="artwork"] button').click();
  await expect(page.locator('#app'), 'the checklist did not route to Artwork').toHaveAttribute('data-mode', 'design.artwork');

  // An empty project blocks, and the blocker carries the way out of it.
  await openFreshEditor(page, { e2e: true });
  await goToPreview(page);
  await expect(page.locator('[data-publish-panel]'), 'a project with no artwork has nothing to publish yet').toHaveCount(0);
});

test('the readiness column belongs to Preview', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  for (const id of ['design', 'rig', 'animate', 'behavior']) {
    await workspace(page, id).click();
    await expect(page.locator('.publish-tools'), `the checklist followed the author into ${id}`).toBeHidden();
  }
  await goToPreview(page);
  await expect(page.locator('.publish-tools')).toBeVisible();
});

test('Publish weighs the export when asked, and forgets the answer when the project moves', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await goToPreview(page);

  // Nothing is measured until someone asks: serializing the whole project for
  // a number on every validation pass is a cost nobody agreed to.
  await expect(page.locator('[data-publish-weight]')).toHaveCount(0);
  await page.locator('button[data-publish="weigh"]').click();
  await expect(page.locator('[data-publish-weight]')).toContainText('mascot.svg');
  await expect(page.locator('[data-publish-weight]')).toContainText('runtime.js');
  await expect(page.locator('[data-publish-weight]')).toContainText('uncompressed');

  // Edit the project and the number goes, rather than quietly describing a
  // mascot that no longer exists.
  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => { state.expressions.push({ id: 'zz', name: 'Zz', controls: {} }); }));
  await expect(page.locator('[data-publish-weight]')).toHaveCount(0);
});
