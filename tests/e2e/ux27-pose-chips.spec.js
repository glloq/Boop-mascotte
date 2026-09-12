import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, openSetupSection, startBasicFace, startBuiltFace } from './editor-helpers.js';

/**
 * Pose chips (docs/DIRECT_CONTROLS.md): one press per named place on a part's
 * movements — *angry* eyebrows, a *half* eye, a *waving* hand — between the
 * whole-face expression presets and the handles that reach everywhere.
 */
const params = (page) => page.evaluate(() => window.__BOOP_E2E__.effectiveParams());
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());

async function expressiveFace(page) {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
}

test('@critical one press poses a part, in Face Setup and in Preview', async ({ page }) => {
  await expressiveFace(page);
  await openSetupSection(page, 'movements');
  const chips = page.locator('#face-movements [data-pose-chip]');
  await expect(chips.first()).toBeVisible();
  // A row per group of movements, named after places worth having a name.
  await expect(page.locator('#face-movements [data-pose-chip^="eyebrows:"]')).toHaveCount(6);
  // Eleven for the mouth: the eight symmetric ones, plus the three a rig with
  // two corners of its own can reach — a smirk, a grimace and lips held tight
  // (docs/FACE_CONTROL_RIG.md, CR-29, CR-31).
  await expect(page.locator('#face-movements [data-pose-chip^="mouth:"]')).toHaveCount(11);

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
  await goToMode(page, 'preview');
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
  // The eyes, the gaze and the mouth gained the poses a rig with pupils that
  // size and corners that disagree can reach (docs/FACE_CONTROL_RIG.md).
  for (const [part, count] of [['head', 7], ['eyes', 6], ['gaze', 9], ['eyebrows', 6], ['nose', 3], ['mouth', 11], ['jaw', 3], ['tongue', 6], ['hair', 4], ['ears', 3]]) {
    await expect(page.locator(`#face-movements [data-pose-chip^="${part}:"]`)).toHaveCount(count);
  }

  // Turn a part's movements off and its chips go with them, rather than
  // offering a pose that would do nothing.
  await page.getByLabel('Enable Raise (Eyebrows)').uncheck();
  await page.getByLabel('Enable Tilt (Eyebrows)').uncheck();
  await expect(page.locator('#face-movements [data-pose-chip^="eyebrows:"]')).toHaveCount(0);
});

test('@critical a hand offers the drawings it has, and the ones it could have', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  // Basic Face ships a pair with the whole library on them, which is the row
  // this is about: a hand's shape *is* the drawing it shows
  // (docs/HAND_STYLES.md).
  await startBasicFace(page);
  await openSetupSection(page, 'hands');

  const chips = page.locator('#hand-setup [data-hand-style-chip]');
  await expect(chips).toHaveCount(8);
  await expect(page.locator('#hand-setup [data-hand-style-chip="left:relaxed"]')).toHaveClass(/chip-active/);
  await expect(page.locator('#hand-setup [data-hand-style-chip].chip-offer')).toHaveCount(0, 'this hand was drawn with all of them');

  // Pressing one shows that drawing, and brings the hand out to look at.
  await page.locator('#hand-setup [data-hand-style-chip="left:peace"]').click();
  await expect.poll(async () => (await params(page)).handLStyle).toBe(5);
  await expect.poll(async () => (await params(page)).handLShow).toBe(1);
  await expect(page.locator('#hand-setup [data-hand-style-chip="left:peace"]')).toHaveClass(/chip-active/);
  // The other hand is untouched: the two choose independently.
  await expect.poll(async () => (await params(page)).handRStyle).toBe(0);
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
  // nothing at all and nothing is painted. Its *box* is not quite zero, because
  // the neutral lip line curves now rather than being the dead horizontal bar
  // V1 drew, and the band traces that curve out and back along itself. So the
  // measure is against the height the same band has when it is showing, taken
  // once the mouth is open below.
  const shut = { teeth: (await box('teeth')).h, tongue: (await box('tongue')).h };

  // Open, and both come out -- inside the mouth, which is what drawing them
  // from its own curves buys.
  await set({ mouthOpen: 1, smile: 1 });
  const mouth = await box('mouth');
  await expect.poll(async () => (await box('teeth')).h).toBeGreaterThan(8);
  const teeth = await box('teeth'), tongue = await box('tongue');
  expect(shut.teeth).toBeLessThan(teeth.h * 0.2);
  expect(shut.tongue).toBeLessThan(tongue.h * 0.2);
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
  await goToMode(page, 'preview');
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
