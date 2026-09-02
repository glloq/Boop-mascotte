import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

const task = (page) => page.evaluate(() => window.__BOOP_E2E__.task());
const artifactNames = (page) => page.evaluate(() => window.__BOOP_E2E__.exportArtifacts().map((item) => item.name));

test('@critical Export explains what blocks it, deep-links to the fix and comes back ready', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  // A transition to a state that does not exist is a blocking rig error with a coarse deep link (Animate → States).
  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => { state.transitions.idle = [...(state.transitions.idle || []), 'nope']; }));
  await expect(page.locator('#export-top')).toHaveText('Export blocked · 1');
  await page.locator('#export-top').click();
  const panel = page.locator('#export-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-export-state', 'blocked');
  await expect(panel.locator('[data-export-headline]')).toContainText('Transition target "nope" does not exist');
  await expect(panel.locator('[data-export-count="errors"]')).toHaveText('1');
  await expect(panel.locator('[data-readiness-section="export"]')).toHaveAttribute('data-readiness-status', 'error');
  const blocker = panel.locator('[data-export-blocker]');
  await expect(blocker).toHaveCount(1);
  await expect(blocker).toContainText('Opens Animate → States');
  await expect(panel.locator('[data-download-artifact="rig.json"]')).toBeDisabled();
  await blocker.getByRole('button', { name: 'Fix', exact: true }).click();
  await expect(panel).toBeHidden();
  await expect.poll(() => task(page)).toBe('animate');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.session().authorMode)).toBe('states');
  const returnChip = page.locator('#return-export');
  await expect(returnChip).toBeVisible();

  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => { state.transitions.idle = state.transitions.idle.filter((name) => name !== 'nope'); }));
  await expect(page.locator('#export-top')).toHaveText('Export');
  await returnChip.click();
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-export-state', 'ready');
  await expect(returnChip).toBeHidden();
  await expect(panel.locator('[data-export-headline]')).toContainText('Ready to export');
  await expect(panel.locator('[data-export-count="errors"]')).toHaveText('0');
  await expect(panel.locator('[data-readiness-section]')).toHaveCount(7);
  await expect(panel.locator('[data-readiness-section="export"]')).toHaveAttribute('data-readiness-status', 'ready');
  for (const name of ['mascot.svg', 'rig.json', 'runtime.js']) await expect(panel.locator(`[data-download-artifact="${name}"]`)).toBeEnabled();
  expect(await artifactNames(page)).toEqual(['mascot.svg', 'rig.json', 'runtime.js']);
  await panel.locator('[data-readiness-go="expressions"]').click();
  await expect(panel).toBeHidden();
  await expect.poll(() => task(page)).toBe('expressions');
  await expect(returnChip).toBeVisible();
  await returnChip.click();
  await expect(panel).toHaveAttribute('data-export-state', 'ready');
});

test('warnings never block the export but each one deep-links to its item', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="reactions"]').click();
  await page.getByLabel('New reaction name').fill('Surprise');
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(page.locator('#reactions-panel')).toHaveAttribute('data-reactions-count', '1');
  await expect(page.locator('#export-top')).toContainText('1 warning');
  await page.locator('#export-top').click();
  const panel = page.locator('#export-panel');
  await expect(panel).toHaveAttribute('data-export-state', 'ready');
  await expect(panel).toHaveAttribute('data-export-warnings', '1');
  await expect(panel.locator('[data-export-headline]')).toContainText('1 warning');
  await expect(panel.locator('[data-download-artifact="rig.json"]')).toBeEnabled();
  const warning = panel.locator('[data-export-warning="reaction.surprise.empty"]');
  await expect(warning).toContainText('does nothing yet');
  await expect(warning).toContainText('Opens Reactions on the item to fix');
  await page.locator('[data-task="artwork"]').click();
  await page.locator('#export-top').click();
  await warning.getByRole('button', { name: 'Fix', exact: true }).click();
  await expect.poll(() => task(page)).toBe('reactions');
  await expect(page.locator('#reaction-inspector')).toHaveAttribute('data-reaction-id', 'surprise');
  await page.locator('[data-reaction-motion]').selectOption('look-around');
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.taskReadiness().reactions.status)).toBe('ready');
  await page.locator('#return-export').click();
  await expect(panel).toHaveAttribute('data-export-warnings', '0');
  await expect(panel.locator('[data-export-headline]')).toContainText('Ready to export');
  await expect(panel.locator('[data-export-headline]')).not.toContainText('warning');
});
