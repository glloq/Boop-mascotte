import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The Animate and Behaviors stages (VNX-08 and VNX-09, docs/VNEXT_ROADMAP.md).
 *
 * Expressions and motions were two rooms. They answer one question — what can
 * this mascot do? — and which of them an author is shaping right now is what
 * the step decides, not what they are allowed to see. So Animate shows both
 * catalogues at once.
 *
 * Automatic behaviours were filed under Animate because they are made of
 * motions. But an author does not reach for them while building a clip; they
 * reach for them when deciding *when* the mascot moves on its own, which is the
 * same question a reaction answers. They live in Behaviors now.
 */

const stage = (page, id) => page.locator(`.stage-tab[data-stage="${id}"]`);

test('@critical Animate shows both catalogues, in either of its steps', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  await stage(page, 'animate').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'expressions');
  await expect(page.locator('#expressions-panel')).toBeVisible();
  await expect(page.locator('#motion-panel'), 'the motions were hidden while shaping an expression').toBeVisible();

  await page.locator('[data-task="animate"]').click();
  await expect(page.locator('#motion-panel')).toBeVisible();
  await expect(page.locator('#expressions-panel'), 'the expressions were hidden while building a clip').toBeVisible();
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
