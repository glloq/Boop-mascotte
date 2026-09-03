import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

// Reviewed visual baselines (on demand: `npm run test:e2e:visual -- --update-snapshots`, then inspect the PNGs).
// Excluded from the CI gates so font rendering differences between machines never block a slice.
const SURFACES = [['home', null], ['artwork', 'artwork'], ['face-setup', 'face-setup'], ['expressions', 'expressions'], ['preview', 'preview']];

for (const [width, height] of [[1280, 720], [390, 844]]) {
  test(`@visual baselines at ${width}×${height}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width, height });
    await openFreshEditor(page, { e2e: true });
    for (const [name, task] of SURFACES) {
      if (task === 'artwork') await startBasicFace(page);
      if (task) await page.locator(`[data-task="${task}"]`).click();
      await page.waitForTimeout(150);
      // The status toast is timing-dependent (it auto-hides); mask it so baselines only capture the composition.
      await expect(page).toHaveScreenshot(`${name}-${width}.png`, { animations: 'disabled', maxDiffPixelRatio: .03, fullPage: false, mask: [page.locator('#toast')] });
    }
  });
}
