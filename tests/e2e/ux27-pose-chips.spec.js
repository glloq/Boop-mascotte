import { test, expect } from '@playwright/test';
import { openFreshEditor, openSetupSection, startBasicFace } from './editor-helpers.js';

/**
 * Pose chips (docs/DIRECT_CONTROLS.md): one press per named place on a part's
 * movements — *angry* eyebrows, a *half* eye, a *waving* hand — between the
 * whole-face expression presets and the handles that reach everywhere.
 */
const params = (page) => page.evaluate(() => window.__BOOP_E2E__.effectiveParams());
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());

async function expressiveFace(page) {
  await openFreshEditor(page, { e2e: true });
  await page.locator('[data-home] [data-template-id="expressive"]').click();
  await expect(page.locator('#canvas svg svg')).toBeVisible();
}

test('@critical one press poses a part, in Face Setup and in Preview', async ({ page }) => {
  await expressiveFace(page);
  await openSetupSection(page, 'movements');
  const chips = page.locator('#face-movements [data-pose-chip]');
  await expect(chips.first()).toBeVisible();
  // A row per group of movements, named after places worth having a name.
  await expect(page.locator('#face-movements [data-pose-chip^="eyebrows:"]')).toHaveCount(5);
  await expect(page.locator('#face-movements [data-pose-chip^="mouth:"]')).toHaveCount(5);

  await page.locator('#face-movements [data-pose-chip="eyebrows:angry"]').click();
  const angry = await params(page);
  expect(angry.browRaise).toBeLessThan(0);
  expect(angry.browTilt).toBeLessThan(0);
  await expect(page.locator('#face-movements [data-pose-chip="eyebrows:angry"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#face-movements [data-pose-chip="eyebrows:neutral"]')).toHaveAttribute('aria-pressed', 'false');

  await page.locator('#face-movements [data-pose-chip="mouth:frown"]').click();
  expect((await params(page)).smile).toBeLessThan(0);
  // Posing is a preview: nothing is authored by pressing a chip.
  expect(await page.evaluate(() => window.__BOOP_E2E__.dirty())).toBe(false);

  // The same chips reach the same movements from Preview.
  await page.locator('[data-task="preview"]').click();
  await page.locator('#preview-panel [data-pose-chip="mouth:grin"]').click();
  const grinning = await params(page);
  expect(grinning.smile).toBeGreaterThan(0);
  expect(grinning.mouthOpen).toBeGreaterThan(0);
  await expect(page.locator('#preview-panel [data-pose-chip="mouth:grin"]')).toHaveAttribute('aria-pressed', 'true');
});

test('a chip is only offered for movements the project has', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openSetupSection(page, 'movements');
  // Basic Face has no eyebrows, so it is offered no eyebrow poses — rather
  // than chips that would do nothing.
  await expect(page.locator('#face-movements [data-pose-chip^="eyebrows:"]')).toHaveCount(0);
  await expect(page.locator('#face-movements [data-pose-chip^="mouth:"]')).toHaveCount(5);
  await expect(page.locator('#face-movements [data-pose-chip^="gaze:"]')).toHaveCount(5);
});

test('@critical a hand offers the poses it has and the ones it could have', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openSetupSection(page, 'hands');
  // No hand artwork ships with the templates, so a part stands in for one.
  await page.selectOption('#hand-setup [data-hand-card="left"] select[data-hand-field="artwork"]', 'pupilRight');

  const chips = page.locator('#hand-setup [data-hand-pose-chip]');
  await expect(chips).toHaveCount(7);
  await expect(page.locator('#hand-setup [data-hand-pose-chip].pose-offer')).toHaveCount(7, 'all offers to begin with');

  // Pressing an offer adds that pose to the hand.
  await page.locator('#hand-setup [data-hand-pose-chip="left:wave"]').click();
  await expect.poll(async () => (await documentOf(page)).hands.left.poses.map((pose) => pose.id)).toEqual(['wave']);
  await expect(page.locator('#hand-setup [data-hand-pose-chip="left:wave"]')).not.toHaveClass(/pose-offer/);

  // Pressing it again strikes it, and says what it still needs to show.
  await page.locator('#hand-setup [data-hand-pose-chip="left:wave"]').click();
  await expect.poll(async () => (await params(page)).handLWave).toBe(1);
  await expect(page.locator('#hand-setup')).toContainText('no shape or artwork yet');
});
