import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * Animate and Behavior (UIR-01, docs/UIR_REFACTOR_BASELINE.md).
 *
 * Expressions, Motions and the Timeline are the three screens of Animate.
 * Showing two catalogues at once stacked two starter kits and two cross-fade
 * settings in one three-screen column (system audit, 2026-09), so each screen
 * shows its own and the others are one click away in the workspace's row.
 *
 * Behavior is the same idea applied to the three things that answer "when does
 * it do it". Reactions and the automatic behaviours shared a column, one
 * scrolled past the other; the state machine was not even in this workspace —
 * it was an accordion inside *Motions*, the step above the one whose subject it
 * is. All three have a screen now.
 */

const workspace = (page, id) => page.locator(`.stage-tab[data-stage="${id}"]`);

test('@critical each screen of Animate shows its own catalogue, and they stay one click apart', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  await workspace(page, 'animate').click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'animate.expressions');
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'expressions');
  await expect(page.locator('#expressions-panel')).toBeVisible();
  await expect(page.locator('#motion-panel'), 'the motion catalogue was stacked under the expressions').toBeHidden();
  // Every screen of the workspace sits in its own row, so nothing is more than
  // one click away.
  for (const mode of ['animate.expressions', 'animate.motions', 'animate.timeline']) {
    await expect(page.locator(`[data-stage-group="animate"] [data-mode="${mode}"]`)).toBeVisible();
  }
  // One word per place: the workspace is Animate, the screen is Motions.
  await expect(page.locator('[data-mode="animate.motions"]')).toContainText('Motions');

  await goToMode(page, 'animate.motions');
  await expect(page.locator('#motion-panel')).toBeVisible();
  await expect(page.locator('#expressions-panel'), 'the expression catalogue was stacked over the motions').toBeHidden();

  // The Timeline is the detailed editor of a motion, so its screen keeps the
  // motion catalogue and opens the dock rather than replacing the column.
  await goToMode(page, 'animate.timeline');
  await expect(page.locator('#motion-panel')).toBeVisible();
  await expect(page.locator('#app')).not.toHaveClass(/timeline-collapsed/);
});

test('@critical Behavior holds the reactions, the automatic behaviours and the states, one screen each', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  await workspace(page, 'behavior').click();
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'reactions');
  await expect(page.locator('#reactions-panel')).toBeVisible();
  await expect(page.locator('#automatic-panel'), 'the automatic behaviours were stacked under the reactions').toBeHidden();

  await goToMode(page, 'behavior.automatic');
  await expect(page.locator('#automatic-panel[data-automatic-ready="true"]')).toBeVisible();
  await expect(page.locator('#reactions-panel')).toBeHidden();

  // The state machine's door was in the wrong building: an accordion under
  // Motions. It opens on arrival now, because a screen whose subject is folded
  // shut is a screen that answers nothing.
  await goToMode(page, 'behavior.stateMachine');
  await expect(page.locator('[data-author-editor]')).toBeVisible();
  await expect(page.locator('[data-author-editor]')).toHaveAttribute('open', '');
  await expect(page.locator('#state-editor')).toBeVisible();

  // And none of the three is in Animate any more: deciding when the mascot
  // moves on its own is a different job from building the movement.
  await workspace(page, 'animate').click();
  await expect(page.locator('#automatic-panel')).toBeHidden();
  await expect(page.locator('#state-editor')).toBeHidden();
});

test('the library belongs to Animate and does not follow the author out of it', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  for (const id of ['design', 'rig', 'behavior']) {
    await workspace(page, id).click();
    await expect(page.locator('#expressions-panel'), `the expression catalogue followed the author into ${id}`).toBeHidden();
    await expect(page.locator('#motion-panel'), `the motion catalogue followed the author into ${id}`).toBeHidden();
  }
});
