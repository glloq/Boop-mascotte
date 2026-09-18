import { test, expect } from '@playwright/test';
import { openArtwork, openAssemble, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The one mouth, and the vowels it can say (docs/MOUTH_BUILD.md).
 *
 * ```text
 * « pour la bouche on doit utiliser un systeme similaire avec 1 preset complet
 *   qui gere tout les etat de la bouche ( voyelle, sourir, langue dents etc) »
 * ```
 *
 * The library held twenty mouths and **not one of them could speak**:
 * `mouthRound` is the control the visemes turn on, and none of the twenty
 * claimed it because none of them could — a shaped movement needs the asset to
 * ship the shape it deforms to, and the installer only knew how to build one for
 * a jaw. What needs a browser is that pressing the card really does put a mouth
 * on the face that says AE and OO differently.
 */
const state = (page) => page.evaluate(() => window.__BOOP_E2E__.state());
const partOfType = async (page, type) => Object.values((await state(page)).semanticParts).find((part) => part.type === type);

/** The aperture the canvas actually paints, in screen pixels. */
const painted = (page, id) => page.evaluate((elementId) => {
  const node = document.querySelector(`#canvas svg svg #${elementId}`);
  if (!node) return null;
  const r = node.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}, id);

test('@critical one mouth card, and it says AE and OO differently', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAssemble(page);
  const panel = page.locator('#face-library[data-face-library-ready="true"]');
  await panel.locator('[data-face-library-category="mouth"]').click();
  await expect(panel).toHaveAttribute('data-face-library-category', 'mouth');

  // One human mouth on the shelf, where there were five that differed by a
  // radius, a fill and whether the teeth were drawn.
  const ids = await panel.locator('[data-face-library-card]').evaluateAll(
    (cards) => cards.map((card) => card.dataset.faceLibraryCard).filter((id) => !/animal|robot|beak/.test(id)));
  expect(ids).toEqual(['mouth.full']);

  await panel.locator('[data-face-library-card="mouth.full"] [data-face-library-wear]').click();
  await expect(panel.locator('[data-face-library-card="mouth.full"]')).toHaveClass(/face-library-worn/);
  const mouth = await partOfType(page, 'mouth');
  expect(mouth.assetId).toBe('mouth.full');
  // All six movements, including the pucker no library mouth had ever carried.
  expect([...mouth.controls].sort()).toEqual(['mouthOpen', 'mouthRound', 'mouthWidth', 'smile', 'teeth', 'tongue']);
  expect(mouth.controlDrivers.mouthRound.method, 'the pucker is a shape, not a transform').toBe('shapeKey');

  await openArtwork(page);
  const rest = await painted(page, 'mouth');

  // AE: open and a little wide. OO: puckered. The check is not that OO is
  // *smaller* -- a `scaleX` would do that -- but that it is **taller for its
  // width**, which is the whole difference between the two vowels.
  await page.evaluate(() => { window.__BOOP_E2E__.setLiveParam('mouthOpen', 0.7); window.__BOOP_E2E__.setLiveParam('mouthRound', 0); });
  await page.waitForTimeout(220);
  const ae = await painted(page, 'mouth');
  await page.evaluate(() => { window.__BOOP_E2E__.setLiveParam('mouthOpen', 0.7); window.__BOOP_E2E__.setLiveParam('mouthRound', 1); });
  await page.waitForTimeout(220);
  const oo = await painted(page, 'mouth');

  expect(oo.width, 'OO is narrower than AE').toBeLessThan(ae.width * 0.8);
  expect(oo.height / oo.width, `OO is taller for its width: ${(oo.height / oo.width).toFixed(2)} against AE's ${(ae.height / ae.width).toFixed(2)}`)
    .toBeGreaterThan((ae.height / ae.width) * 1.5);
  // And both are open: the resting height is a closed lip line plus its own
  // 3.8-unit stroke, so the bar is well under a doubling.
  expect(ae.height, 'and both are open').toBeGreaterThan(rest.height * 1.5);
  expect(oo.height).toBeGreaterThan(rest.height * 1.5);

  await page.evaluate(() => { window.__BOOP_E2E__.clearLiveParam('mouthOpen'); window.__BOOP_E2E__.clearLiveParam('mouthRound'); });
  await page.waitForTimeout(220);
  const again = await painted(page, 'mouth');
  expect(Math.abs(again.height - rest.height), 'and the drawing rests as drawn').toBeLessThan(2);
});

test('@critical the teeth and the tongue show, and a closed mouth hides nothing', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openAssemble(page);
  const panel = page.locator('#face-library[data-face-library-ready="true"]');
  await panel.locator('[data-face-library-category="mouth"]').click();
  await panel.locator('[data-face-library-card="mouth.full"] [data-face-library-wear]').click();
  await expect(panel.locator('[data-face-library-card="mouth.full"]')).toHaveClass(/face-library-worn/);
  await openArtwork(page);

  // Empty at rest: two quadratics sharing their ends on the lip, so the shape
  // encloses nothing. A closed mouth has nothing behind it to hide, by
  // construction rather than by arithmetic. A degenerate shape still reports the
  // box its control points span, so what is measured is that it is a hairline
  // beside the mouth rather than that it is exactly nothing.
  const shutMouth = await painted(page, 'mouth');
  const shut = { teeth: await painted(page, 'teeth'), tongue: await painted(page, 'tongue') };
  expect(shut.teeth.height, 'the teeth enclose nothing with the mouth closed').toBeLessThan(shutMouth.height * 0.25);
  expect(shut.tongue.height, 'nor does the tongue').toBeLessThan(shutMouth.height * 0.25);

  await page.evaluate(() => {
    window.__BOOP_E2E__.setLiveParam('mouthOpen', 1);
    window.__BOOP_E2E__.setLiveParam('teeth', 1);
    window.__BOOP_E2E__.setLiveParam('tongue', 1);
  });
  await page.waitForTimeout(220);
  const open = { teeth: await painted(page, 'teeth'), tongue: await painted(page, 'tongue'), mouth: await painted(page, 'mouth') };
  expect(open.teeth.height, 'and they come out when the mouth opens').toBeGreaterThan(shut.teeth.height * 3);
  expect(open.tongue.height).toBeGreaterThan(shut.tongue.height * 3);
  // Inside by construction: both are drawn *from* the lips, so neither can leave
  // the aperture however far the controls go.
  for (const [name, band] of [['teeth', open.teeth], ['tongue', open.tongue]]) {
    expect(band.y, `${name} stays below the upper lip`).toBeGreaterThanOrEqual(open.mouth.y - 2);
    expect(band.y + band.height, `${name} stays above the lower lip`).toBeLessThanOrEqual(open.mouth.y + open.mouth.height + 2);
    expect(band.width, `${name} is narrower than the mouth`).toBeLessThanOrEqual(open.mouth.width + 2);
  }
});
