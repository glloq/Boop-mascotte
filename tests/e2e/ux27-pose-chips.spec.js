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
  await page.locator('[data-home] [data-template-id="basic"]').click();
  await expect(page.locator('#canvas svg svg')).toBeVisible();
}

test('@critical one press poses a part, in Face Setup and in Preview', async ({ page }) => {
  await expressiveFace(page);
  await openSetupSection(page, 'movements');
  const chips = page.locator('#face-movements [data-pose-chip]');
  await expect(chips.first()).toBeVisible();
  // A row per group of movements, named after places worth having a name.
  await expect(page.locator('#face-movements [data-pose-chip^="eyebrows:"]')).toHaveCount(6);
  await expect(page.locator('#face-movements [data-pose-chip^="mouth:"]')).toHaveCount(8);

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
  // The template draws every part, so every group is offered its poses --
  // every part of the face, not only the ones a beginner starts with.
  for (const [part, count] of [['head', 7], ['eyes', 4], ['gaze', 6], ['eyebrows', 6], ['nose', 3], ['mouth', 8], ['jaw', 3], ['hair', 4], ['ears', 3]]) {
    await expect(page.locator(`#face-movements [data-pose-chip^="${part}:"]`)).toHaveCount(count);
  }

  // Turn a part's movements off and its chips go with them, rather than
  // offering a pose that would do nothing.
  await page.getByLabel('Enable Raise (Eyebrows)').uncheck();
  await page.getByLabel('Enable Tilt (Eyebrows)').uncheck();
  await expect(page.locator('#face-movements [data-pose-chip^="eyebrows:"]')).toHaveCount(0);
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

test('@critical an open mouth has teeth and a tongue, and a closed one has neither', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.evaluate(() => window.__BOOP_E2E__.mutate((state) => { for (const behavior of state.behaviors) behavior.enabled = false; }));
  const box = (id) => page.evaluate((elementId) => {
    const rect = document.querySelector(`#canvas #${elementId}`)?.getBoundingClientRect();
    return rect ? { x: rect.x, y: rect.y, w: Math.round(rect.width), h: Math.round(rect.height) } : null;
  }, id);
  const set = (values) => page.evaluate((entries) => { for (const [name, value] of Object.entries(entries)) window.__BOOP_E2E__.setLiveParam(name, value); }, values);

  // Turned all the way up with the lips closed: nothing shows. It is a product
  // of the two, not a sum, so a closed mouth has nothing behind it.
  await set({ teeth: 1, tongue: 1 });
  // Flat: the two edges of the band lie on top of each other, so it encloses
  // nothing at all. Both bands bow a pixel or two along the lip they are drawn
  // from, so the *box* around them is not quite zero; the enclosed area is, and
  // `templates.test.js` asserts that exactly, by shoelace.
  await expect.poll(async () => (await box('teeth')).h).toBeLessThan(4);
  expect((await box('tongue')).h).toBeLessThan(4);

  // Open, and both come out -- inside the mouth, which is what drawing them
  // from its own curves buys.
  await set({ mouthOpen: 1, smile: 1 });
  const mouth = await box('mouth');
  await expect.poll(async () => (await box('teeth')).h).toBeGreaterThan(8);
  const teeth = await box('teeth'), tongue = await box('tongue');
  expect(teeth.y).toBeGreaterThanOrEqual(mouth.y - 1);
  expect(teeth.y + teeth.h).toBeLessThanOrEqual(mouth.y + mouth.h);
  expect(tongue.y + tongue.h).toBeLessThanOrEqual(mouth.y + mouth.h + 1);
  expect(teeth.w).toBeLessThan(mouth.w);

  // And they travel with the mouth when the head turns, rather than staying
  // where the mouth used to be: the whole assembly narrows about one centre.
  await set({ headX: 1 });
  await page.waitForTimeout(120);
  const turnedMouth = await box('mouth'), turnedTeeth = await box('teeth');
  expect(turnedMouth.x).not.toBe(mouth.x);
  expect(turnedTeeth.x).toBeGreaterThan(turnedMouth.x);
  expect(turnedTeeth.x + turnedTeeth.w).toBeLessThan(turnedMouth.x + turnedMouth.w);
  expect(turnedTeeth.y).toBeGreaterThan(turnedMouth.y);
});

test('every part of the face can be posed from one row of chips', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="preview"]').click();
  const live = page.locator('[data-preview-section="live"]');
  // Nose, jaw, hair and ears used to have no controls at all, so no chips.
  for (const part of ['head', 'eyes', 'gaze', 'eyebrows', 'nose', 'mouth', 'jaw', 'hair', 'ears']) {
    await expect(live.locator(`[data-pose-chip^="${part}:"]`).first()).toBeVisible();
  }
  const value = (name) => page.evaluate((parameter) => window.__BOOP_E2E__.effectiveParams()[parameter], name);
  await live.locator('[data-pose-chip="nose:scrunched"]').click();
  await expect.poll(() => value('noseScrunch')).toBe(1);
  await live.locator('[data-pose-chip="jaw:dropped"]').click();
  await expect.poll(() => value('jawOpen')).toBe(1);
  await live.locator('[data-pose-chip="hair:up"]').click();
  await expect.poll(() => value('hairLift')).toBe(1);
  await live.locator('[data-pose-chip="ears:perked"]').click();
  await expect.poll(() => value('earWiggle')).toBe(1);
  await live.locator('[data-pose-chip="mouth:laugh"]').click();
  await expect.poll(() => value('teeth')).toBe(1);
  await expect(live.locator('[data-pose-chip="mouth:laugh"]')).toHaveAttribute('aria-pressed', 'true');
  // Nothing of this is authored: it is the preview, as every chip row is.
  expect((await page.evaluate(() => window.__BOOP_E2E__.document())).params.teeth.value).toBe(0);
});
