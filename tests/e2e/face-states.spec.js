import { test, expect } from '@playwright/test';
import { openFreshEditor, openSetupSection, startBasicFace } from './editor-helpers.js';

/**
 * The states an eye and a mouth can be in, in the browser
 * (docs/FACE_SVG_STATES.md, docs/VISEME_SYSTEM.md).
 *
 * The arithmetic is held to in `core/tests/face-states.test.js`; what needs a
 * browser is that the panel is on the screen it belongs to, that a chip poses
 * the mascot rather than authoring anything, and that *expression + viseme* is
 * a face an author can actually see.
 */

const effective = (page) => page.evaluate(() => window.__BOOP_E2E__.effectiveParams());
const revision = (page) => page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);

test('@critical a state poses one eye without touching the other, the gaze, or the project', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openSetupSection(page, 'face-states');
  const panel = page.locator('#face-states[data-face-states-ready="true"]');
  await expect(panel).toBeVisible();

  // Eight states and nine speech shapes, from one set of artwork.
  await expect(panel.locator('[data-face-eye-state]')).toHaveCount(8);
  await expect(panel.locator('[data-face-viseme]')).toHaveCount(9);
  await expect(panel.locator('[data-face-side]')).toHaveCount(2);
  await expect(page.locator('[data-setup-section="face-states"] [data-setup-summary]')).toContainText('speech');

  // A look first, so the state can be checked for keeping it.
  await page.evaluate(() => { window.__BOOP_E2E__.setLiveParam('lookX', -0.8); window.__BOOP_E2E__.setLiveParam('lookY', 0.3); });
  const before = await revision(page);

  await panel.locator('[data-face-eye-state="happyClosed"]').click();
  const posed = await effective(page);
  expect(posed.eyeOpenLeft, 'the left eye is shut, as its own offset').toBeCloseTo(-1);
  expect(posed.eyeCurveLeft, 'and arcing upwards').toBeCloseTo(1);
  expect(posed.eyeOpenRight, 'the right eye has not moved: this is what a wink is').toBe(0);
  expect(posed.lookX, 'and the gaze is untouched').toBeCloseTo(-0.8);
  expect(posed.lookY).toBeCloseTo(0.3);
  expect(await revision(page), 'a chip poses the mascot and authors nothing').toBe(before);

  // The other eye, from the same eight chips.
  await panel.locator('[data-face-side="right"]').click();
  await panel.locator('[data-face-eye-state="squint"]').click();
  const both = await effective(page);
  expect(both.eyeSquintRight).toBeCloseTo(0.85);
  expect(both.eyeSquintLeft, 'the two eyes disagree').toBe(0);
  expect(both.eyeCurveLeft, 'and the left one is still where the last state put it').toBeCloseTo(1);
});

test('@critical a face and a speech shape compose, and the correctives the pose asks for are lit', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openSetupSection(page, 'face-states');
  const panel = page.locator('#face-states[data-face-states-ready="true"]');

  await page.selectOption('#face-states [data-face-expression]', 'happy');
  await page.selectOption('#face-states [data-face-viseme-select]', 'AE');
  const speaking = await effective(page);
  expect(speaking.smile, 'happy keeps its smile through the sentence').toBeCloseTo(1);
  expect(speaking.mouthOpen, 'and the mouth says AE').toBeCloseTo(0.75);
  expect(speaking.mouthRound).toBeCloseTo(0.15);

  // Half way in, which is what a lipsync drives.
  await page.locator('#face-states [data-face-blend]').evaluate((node) => { node.value = '0.4'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  const halfway = await effective(page);
  expect(halfway.smile, 'the face does not fade with the speech').toBeCloseTo(1);
  expect(halfway.mouthOpen).toBeCloseTo(0.3);

  // Five corrective slots on the eye and nine on the mouth, each a sentence
  // about the controls; the ones this pose reaches are marked.
  const eyes = panel.locator('[data-disclosure="face-eye-correctives"]');
  await eyes.locator('> summary').click();
  await expect(eyes.locator('[data-face-corrective]')).toHaveCount(5);
  const mouth = panel.locator('[data-disclosure="face-mouth-correctives"]');
  await mouth.locator('> summary').click();
  await expect(mouth.locator('[data-face-corrective]')).toHaveCount(9);
  await expect(mouth.locator('[data-face-corrective="open"][data-face-lit="true"]')).toHaveCount(1);
  await expect(mouth.locator('[data-face-corrective="lock"]:not([data-face-lit="true"])')).toHaveCount(1);
  // And the panel says, in as many words, which of the two things it edits.
  await expect(mouth).toContainText('never the drawing itself');
  // Nothing has been captured, so every slot offers a shape rather than a weight.
  await expect(mouth.locator('[data-face-forget]')).toHaveCount(0);
  await expect(mouth.locator('[data-face-shape]').first()).toBeVisible();
});
