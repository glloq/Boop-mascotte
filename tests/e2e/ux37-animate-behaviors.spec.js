import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The Animate and Behaviors stages (VNX-08 and VNX-09, docs/VNEXT_ROADMAP.md).
 *
 * Expressions and Motions are the two steps of Animate. Showing both
 * catalogues at once stacked two starter kits and two cross-fade settings in
 * one three-screen column (system audit, 2026-09), so each step shows its own
 * catalogue and the other is one click away in the stage's step row.
 *
 * Automatic behaviours were filed under Animate because they are made of
 * motions. But an author does not reach for them while building a clip; they
 * reach for them when deciding *when* the mascot moves on its own, which is the
 * same question a reaction answers. They live in Behaviors now.
 */

const stage = (page, id) => page.locator(`.stage-tab[data-stage="${id}"]`);

test('@critical each step of Animate shows its own catalogue, and both steps stay one click apart', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  await stage(page, 'animate').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'expressions');
  await expect(page.locator('#expressions-panel')).toBeVisible();
  await expect(page.locator('#motion-panel'), 'the motion catalogue was stacked under the expressions').toBeHidden();
  // Both steps sit in the stage's own row, so nothing is more than one click away.
  await expect(page.locator('[data-stage-group="animate"] [data-task="expressions"]')).toBeVisible();
  await expect(page.locator('[data-stage-group="animate"] [data-task="animate"]')).toBeVisible();
  // One word per place: the stage is Animate, the step is Motions.
  await expect(page.locator('[data-task="animate"]')).toContainText('Motions');

  await page.locator('[data-task="animate"]').click();
  await expect(page.locator('#motion-panel')).toBeVisible();
  await expect(page.locator('#expressions-panel'), 'the expression catalogue was stacked over the motions').toBeHidden();
  // The advanced States & behaviors editor is folded inside Motions, not spread under it.
  await expect(page.locator('[data-author-editor]')).toBeVisible();
  await expect(page.locator('[data-author-editor]')).not.toHaveAttribute('open', '');
});

test('@critical the automatic behaviours sit with the reactions, not with the clips', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  await stage(page, 'behaviors').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'reactions');
  await expect(page.locator('#reactions-panel')).toBeVisible();
  await expect(page.locator('#automatic-panel[data-automatic-ready="true"]')).toBeVisible();

  // And they are not in Animate any more: deciding when the mascot moves on its
  // own is a different job from building the movement.
  await stage(page, 'animate').click();
  await expect(page.locator('#automatic-panel')).toBeHidden();
});

test('the library belongs to Animate and does not follow the author out of it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  for (const id of ['create', 'behaviors', 'publish']) {
    await stage(page, id).click();
    await expect(page.locator('#expressions-panel'), `the expression catalogue followed the author into ${id}`).toBeHidden();
    await expect(page.locator('#motion-panel'), `the motion catalogue followed the author into ${id}`).toBeHidden();
  }
});
