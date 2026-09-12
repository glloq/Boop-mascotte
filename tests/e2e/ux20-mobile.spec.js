import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, startBasicFace, startEmptyBasicFace } from './editor-helpers.js';

const effective = (page, name) => page.evaluate((n) => window.__BOOP_E2E__.effectiveParams()[n], name);
const layout = (page) => page.evaluate(() => window.__BOOP_E2E__.layout());

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`@critical phone ${viewport.width} px: preview, expressions, reactions, save and export work; precision tools are gated with a handoff`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openFreshEditor(page, { e2e: true });
    await startEmptyBasicFace(page);
    const app = page.locator('#app');
    await expect(app).toHaveAttribute('data-layout', 'mobile');
    expect((await layout(page)).layout).toBe('mobile');

    // Artwork: precision tools are gated, layers stay usable.
    await expect(page.locator('.design-toolbar')).toBeHidden();
    await page.locator('#drawer-toggle').click();
    await expect(page.locator('[data-mobile-gate="artwork"]')).toBeVisible();
    await expect(page.locator('[data-mobile-gate="artwork"]')).toContainText('tablet or desktop');
    await expect(page.locator('#layers-panel')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(app).not.toHaveClass(/drawer-open/);

    // Expressions: add a preset and apply it from Preview.
    await goToMode(page, 'animate.expressions');
    await page.locator('#drawer-toggle').click();
    await page.getByRole('button', { name: 'Add Happy preset' }).click();
    await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '1');
    await expect(app).toHaveAttribute('data-sheet', 'half');
    await expect(page.locator('#expression-inspector')).toHaveAttribute('data-expression-id', 'happy');
    await page.getByLabel('Test intensity', { exact: true }).fill('0.5');
    await expect.poll(() => effective(page, 'smile')).toBeCloseTo(.5);

    // Reactions: create and test.
    await goToMode(page, 'behavior.reactions');
    await page.locator('#drawer-toggle').click();
    await page.getByLabel('New reaction name').fill('Wave');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.locator('#reactions-panel')).toHaveAttribute('data-reactions-count', '1');
    await expect(app).toHaveAttribute('data-sheet', 'half');
    await page.locator('[data-reaction-test]').click();
    await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.activeReaction()?.id)).toBe('wave');

    // Animate: presets work, the Timeline is declared unavailable.
    await goToMode(page, 'animate.motions');
    await page.locator('#drawer-toggle').click();
    await expect(page.locator('[data-mobile-gate="timeline"]')).toBeVisible();
    await expect(page.locator('[data-mobile-gate="timeline"]')).toContainText('Not on phones');
    await expect(page.locator('.bottom')).toBeHidden();
    await page.getByRole('button', { name: 'Add Nod motion' }).click();
    await expect(page.locator('#motion-inspector')).toHaveAttribute('data-motion-kind', 'simple');
    await expect(page.locator('[data-motion-open-timeline]')).toBeDisabled();
    await page.locator('[data-motion-stop]').click();

    // Preview is full.
    await goToMode(page, 'preview');
    await expect(app).toHaveAttribute('data-sheet', 'half');
    await expect(page.locator('[data-preview-section="live"]')).toBeVisible();
    await expect(page.locator('[data-preview-expression="happy"]')).toBeVisible();
    await expect(page.locator('[data-preview-reaction="wave"]')).toBeVisible();

    // Save and Export never disappear; the capability sheet explains the rest.
    await expect(page.getByRole('button', { name: 'Save Project' })).toBeVisible();
    await page.locator('#export-top').click();
    await expect(page.locator('#export-panel')).toHaveAttribute('data-export-state', 'ready');
    await expect(page.locator('[data-download-artifact="rig.json"]')).toBeEnabled();
    await page.locator('[data-close-export]').click();
    await page.locator('#capability-toggle').click();
    const sheet = page.locator('#capability-panel');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-capability="timeline"]')).toHaveAttribute('data-capability-level', 'unavailable');
    await expect(sheet.locator('[data-capability="preview"]')).toHaveAttribute('data-capability-level', 'full');
    await page.locator('[data-close-capabilities]').click();
    await expect(sheet).toBeHidden();
  });
}

test('the desktop layout escape hatch restores the two-panel composition on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('#capability-toggle').click();
  await page.locator('[data-force-layout="desktop"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-layout', 'desktop');
  await expect(page.locator('#capability-panel')).toBeHidden();
  await expect(page.locator('#drawer-toggle')).toBeHidden();
  await expect(page.locator('[data-mobile-gate="artwork"]')).toBeHidden();
  // The choice is a UI preference (the test harness clears storage on every load; startup honoring is unit-tested).
  expect(await page.evaluate(() => localStorage.getItem('boop.layoutMode'))).toBe('desktop');
  await page.locator('#capability-toggle').click();
  await page.locator('[data-force-layout="auto"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-layout', 'mobile');
  expect(await page.evaluate(() => localStorage.getItem('boop.layoutMode'))).toBe('auto');
});

/**
 * UIR-15 — the capability sheet reads as the navigation reads.
 *
 * It was thirteen areas in the order they had been written, naming a screen
 * that no longer exists and silent about three that do. An author who cannot
 * find Hands on a phone needs to be told whether it is gated or whether they
 * are looking in the wrong place, and the sheet is where that is answered.
 */
test('@critical the capability sheet is grouped by workspace, and names every screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('#capability-toggle').click();
  const sheet = page.locator('#capability-panel');
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('[data-capability-group]')).toHaveText(['Design', 'Rig', 'Animate', 'Behavior', 'Everywhere']);

  // The four screens the refactor gave a door of their own are named here too.
  for (const [area, level] of [['hands', 'limited'], ['face-setup', 'limited'], ['head-pose', 'limited'], ['deform', 'unavailable']]) {
    await expect(sheet.locator(`[data-capability="${area}"]`), `${area} is described`).toHaveAttribute('data-capability-level', level);
  }
  // Each is under its own question, never in a flat list.
  const filed = await sheet.evaluate((root) => {
    const out = {}; let group = null;
    for (const node of root.querySelectorAll('[data-capability-group],[data-capability]')) {
      if (node.dataset.capabilityGroup) out[group = node.dataset.capabilityGroup] = [];
      else out[group].push(node.dataset.capability);
    }
    return out;
  });
  expect(filed.design).toEqual(['character', 'hands', 'artwork']);
  expect(filed.rig).toEqual(['face-setup', 'calibration', 'head-pose', 'deform']);
  expect(filed.global).toContain('preview');
  await page.locator('[data-close-capabilities]').click();

  // And a gate is on the screen it gates, rather than over the whole of Rig.
  await goToMode(page, 'rig.deform');
  await page.locator('#drawer-toggle').click();
  await expect(page.locator('[data-mobile-gate="deform"]')).toBeVisible();
  await expect(page.locator('[data-mobile-gate="deform"]')).toContainText('Not on phones');
  await goToMode(page, 'rig.assign');
  await expect(page.locator('[data-mobile-gate="deform"]'), 'Assign says nothing about Deform').toBeHidden();
  await expect(page.locator('[data-mobile-gate="face-setup"]')).toBeVisible();
});
