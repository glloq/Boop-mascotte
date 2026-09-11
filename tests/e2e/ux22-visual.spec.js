import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace } from './editor-helpers.js';

// Reviewed visual baselines (on demand: `npm run test:e2e:visual -- --update-snapshots`, then inspect the PNGs).
// Excluded from the CI gates so font rendering differences between machines never block a slice.
const SURFACES = [['home', null], ['artwork', 'artwork'], ['character', 'character'], ['face-setup', 'face-setup'], ['expressions', 'expressions'], ['preview', 'preview']];

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
      // `threshold` is the per-pixel colour tolerance, and its default (0.2) is
      // far too loose for this palette: a card's fill (#111d32) and the page's
      // own gradient are both dark navy and read as the same pixel, so an
      // entire Home redesign once matched a stale baseline -- only the thin
      // text and borders counted as different, and they fit inside the 3 %.
      // 0.08 still absorbs the font antialiasing this suite exists to tolerate,
      // and no longer absorbs a panel appearing or leaving.
      await expect(page).toHaveScreenshot(`${name}-${width}.png`, { animations: 'disabled', threshold: .08, maxDiffPixelRatio: .015, fullPage: false, mask: [page.locator('#toast')] });
    }
  });
}
