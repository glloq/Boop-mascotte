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
  // All seven movements, including the pucker no library mouth had ever carried
  // and the lean V6 added (docs/MOUTH_BUILD.md).
  expect([...mouth.controls].sort()).toEqual(['mouthOpen', 'mouthRound', 'mouthSkew', 'mouthWidth', 'smile', 'teeth', 'tongue']);
  expect(mouth.controlDrivers.mouthRound.method, 'the pucker is a shape, not a transform').toBe('shapeKey');
  expect(mouth.controlDrivers.mouthSkew.method, 'and so is the lean').toBe('shapeKey');
  // And the card draws the tongue's tip as well, which the tongue part moves.
  const tonguePart = await partOfType(page, 'tongue');
  expect(Object.keys(tonguePart.roles).sort()).toEqual(['tongue', 'tongueTip']);
  expect(tonguePart.controlDrivers.tongueOut.method, 'coming out is a shape now, not a scale').toBe('shapeKey');

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

  // Empty at rest: each inside is a closed path whose second half retraces its
  // first, so the shape encloses nothing. A closed mouth has nothing behind it
  // to hide, by construction rather than by arithmetic. A degenerate shape still
  // reports the box its control points span, so what is measured is that it is a
  // hairline beside the mouth rather than that it is exactly nothing.
  const shutMouth = await painted(page, 'mouth');
  const shut = { teeth: await painted(page, 'teeth'), tongue: await painted(page, 'tongue'), teethLower: await painted(page, 'teethLower'), tongueTip: await painted(page, 'tongueTip') };
  expect(shut.teeth.height, 'the teeth enclose nothing with the mouth closed').toBeLessThan(shutMouth.height * 0.25);
  expect(shut.tongue.height, 'nor does the tongue').toBeLessThan(shutMouth.height * 0.25);
  expect(shut.teethLower.height, 'nor the lower row').toBeLessThan(shutMouth.height * 0.25);
  expect(shut.tongueTip.height, 'nor the tongue\u2019s tip').toBeLessThan(shutMouth.height * 0.25);

  await page.evaluate(() => {
    window.__BOOP_E2E__.setLiveParam('mouthOpen', 1);
    window.__BOOP_E2E__.setLiveParam('teeth', 1);
    window.__BOOP_E2E__.setLiveParam('tongue', 1);
  });
  await page.waitForTimeout(220);
  const open = { teeth: await painted(page, 'teeth'), tongue: await painted(page, 'tongue'), mouth: await painted(page, 'mouth'), teethLower: await painted(page, 'teethLower') };
  expect(open.teeth.height, 'and they come out when the mouth opens').toBeGreaterThan(shut.teeth.height * 3);
  expect(open.tongue.height).toBeGreaterThan(shut.tongue.height * 3);
  expect(open.teethLower.height, 'the lower row too, a little later').toBeGreaterThan(shut.teethLower.height * 2);
  // Every one is drawn *from* the lips, so none can wander off sideways however
  // far the controls go — and each is narrower than the mouth it hangs in.
  for (const [name, band] of [['teeth', open.teeth], ['tongue', open.tongue], ['teethLower', open.teethLower]]) {
    expect(band.y, `${name} stays below the upper lip`).toBeGreaterThanOrEqual(open.mouth.y - 2);
    expect(band.width, `${name} is narrower than the mouth`).toBeLessThanOrEqual(open.mouth.width + 2);
  }
  // Everything inside stays inside, which is what the clip says out loud: the
  // body of the tongue is in the mouth, and only the **tip** comes out of it
  // (docs/MOUTH_BUILD.md). V5 had one tongue and it was always in front of the
  // lips, which is why it had to be kept narrow enough never to reach a corner.
  for (const [name, band] of [['teeth', open.teeth], ['tongue', open.tongue], ['teethLower', open.teethLower]]) {
    expect(band.y + band.height, `${name} is inside the mouth`).toBeLessThanOrEqual(open.mouth.y + open.mouth.height + 2);
  }
  // And the tip comes out when it is asked to, over the lower lip.
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('tongueOut', 1));
  await page.waitForTimeout(220);
  const tip = await painted(page, 'tongueTip');
  expect(tip.y + tip.height, 'the tongue laps over the lower lip').toBeGreaterThan(open.mouth.y + open.mouth.height);
  await page.evaluate(() => window.__BOOP_E2E__.clearLiveParam('tongueOut'));
});

/**
 * The upper lip is drawn where the teeth are, and the tongue comes out.
 *
 * ```text
 * « les dents sont au dessus de la lèvre supérieure, la langue ne sort pas du
 *   tout (il faut un design plus cartoon pour la langue) »
 * ```
 *
 * Two faults in one construction. The teeth hung from the upper lip with their
 * ends *on* it, so a row of teeth painted over the inner half of the 3.8-unit
 * stroke that draws it and the lip went missing where they were. And the tongue
 * was a band like them — a small hump on the floor of the mouth that never left
 * it, which is not what anybody means by a tongue.
 */
test('@critical the teeth hang under the upper lip, and the tongue laps over the lower one', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openArtwork(page);
  await page.evaluate(() => {
    window.__BOOP_E2E__.setLiveParam('mouthOpen', 1);
    window.__BOOP_E2E__.setLiveParam('teeth', 1);
    window.__BOOP_E2E__.setLiveParam('tongue', 1);
  });
  await page.waitForTimeout(240);
  const mouth = await painted(page, 'mouth'), teeth = await painted(page, 'teeth');

  // The lip is still drawn where the teeth are: walk across the top of the
  // aperture and the mouth's own stroke is what is painted there, not enamel.
  const alongTheLip = await page.evaluate(() => {
    const box = document.querySelector('#canvas #mouth').getBoundingClientRect();
    return [0.35, 0.45, 0.55, 0.65].map((f) => {
      const x = box.x + box.width * f, y = box.y + 2;
      return document.elementsFromPoint(x, y).map((n) => n.id).filter(Boolean)[0] || '';
    });
  });
  for (const hit of alongTheLip) expect(hit, 'the teeth are painted over the upper lip').toBe('mouth');
  expect(teeth.y, 'and they hang clear of the stroke that draws it').toBeGreaterThan(mouth.y + 3);

  // The body fills a good part of the aperture, which is what makes it read as
  // a tongue rather than as a pink line at the bottom of a hole.
  const body = await painted(page, 'tongue');
  expect(body.height, 'the tongue barely shows').toBeGreaterThan(mouth.height * 0.25);
  expect(body.x, 'and it sits in the middle, not over the corners').toBeGreaterThan(mouth.x + mouth.width * 0.15);
  expect(body.x + body.width).toBeLessThan(mouth.x + mouth.width * 0.85);

  // The tongue comes out: past the lower lip, from the middle of the mouth, so
  // the lip is still drawn on both sides of it. It is the **tip** that does it
  // since V6 -- one element cannot be both in front of the lower lip and behind
  // it, and V5's one tongue was in front of it always (docs/MOUTH_BUILD.md).
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('tongueOut', 1));
  await page.waitForTimeout(240);
  const tip = await painted(page, 'tongueTip');
  expect(tip.y + tip.height, 'the tongue does not come out at all').toBeGreaterThan(mouth.y + mouth.height);
  expect(tip.x, 'and it comes out of the middle, not over the corners').toBeGreaterThan(mouth.x + mouth.width * 0.15);
  expect(tip.x + tip.width).toBeLessThan(mouth.x + mouth.width * 0.85);

  // Curling turns its end up rather than pulling it back in: a tongue curled
  // all the way is still a tongue lapping over a lip.
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('tongueCurl', 1));
  await page.waitForTimeout(240);
  const curled = await painted(page, 'tongueTip');
  expect(curled.y + curled.height, 'a curled tongue is still out').toBeGreaterThan(mouth.y + mouth.height - 2);
  expect(curled.height, 'and its end has come up').toBeLessThan(tip.height);
  await page.evaluate(() => window.__BOOP_E2E__.clearLiveParam('tongueCurl'));

  // And a shut mouth still keeps its body in, which is what the product is for:
  // the tip is the one thing that can come out of closed lips, and that is a
  // blep rather than an accident.
  await page.evaluate(() => { window.__BOOP_E2E__.setLiveParam('mouthOpen', 0); window.__BOOP_E2E__.setLiveParam('tongueOut', 0); });
  await page.waitForTimeout(220);
  const shut = { mouth: await painted(page, 'mouth'), tongue: await painted(page, 'tongue'), tip: await painted(page, 'tongueTip') };
  expect(shut.tongue.height, 'a shut mouth keeps its tongue in').toBeLessThan(shut.mouth.height * 0.4);
  expect(shut.tip.height, 'and its tip with it').toBeLessThan(shut.mouth.height * 0.4);
  for (const key of ['mouthOpen', 'teeth', 'tongue', 'tongueOut']) await page.evaluate((k) => window.__BOOP_E2E__.clearLiveParam(k), key);
});
