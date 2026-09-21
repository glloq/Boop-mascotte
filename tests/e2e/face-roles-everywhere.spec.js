import { test, expect } from '@playwright/test';
import { openArtwork, openAssemble, openFreshEditor, openSetupSection, selectLayerById, startBasicFace } from './editor-helpers.js';

/**
 * Saying what a drawing is, and choosing one from the library, in the browser
 * (docs/FACE_ROLE_ASSIGNMENT.md, docs/FACE_PART_LIBRARY.md).
 *
 * Two things an author could not do, and neither failure was visible to the
 * unit suite, because both were *missing surfaces* rather than wrong
 * arithmetic: the Inspector's role field sat inside a block that never
 * rendered for a path, and the hundred and fifty library drawings had no
 * caller at all. So what is asserted here is presence and effect — the control
 * is on the screen it belongs to, and pressing it changes the mascot.
 */

const state = (page) => page.evaluate(() => window.__BOOP_E2E__.state());
const revision = (page) => page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);
const partOfType = async (page, type) => Object.values((await state(page)).semanticParts).find((part) => part.type === type);
const markupHas = (page, id) => page.evaluate((needle) => window.__BOOP_E2E__.state().svgMarkup.includes(`id="${needle}"`), id);

/**
 * Design ▸ Assemble, which *is* the library.
 *
 * It was in Artwork, inside a collapsed disclosure called *Add / Create
 * artwork*, at the bottom of the column. Assemble is where a mascot comes from
 * and the library is the first thing on it (UIR-18, docs/DESIGN_SCREENS.md),
 * so there is no disclosure to open and nothing to scroll to.
 */
async function openFaceLibrary(page) {
  await openAssemble(page);
  return page.locator('#face-library[data-face-library-ready="true"]');
}

test('@critical the library shows its drawings, and one press puts a pair of eyes on the face', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  const panel = await openFaceLibrary(page);

  // A hundred and thirty-two drawings, in the categories that have one. It was a
  // hundred and fifty: seventeen of the twenty-one pairs of eyes were one
  // construction at different radii and five human mouths were one curve at
  // different radii, so three eye builds and one mouth replaced twenty-two cards
  // (docs/EYE_BUILDS.md, docs/MOUTH_BUILD.md).
  await expect(panel).toHaveAttribute('data-face-library-total', '132');
  await expect(panel).toHaveAttribute('data-face-library-category', 'eyes');
  expect(await panel.locator('[data-face-library-category]').count()).toBeGreaterThanOrEqual(9);
  const cards = panel.locator('[data-face-library-card]');
  expect(await cards.count()).toBeGreaterThanOrEqual(3);

  // The library *holds* a hundred and thirty-two and *offers* forty-two: the
  // animal, robot and bird packs are kept for the faces that wear them and no
  // longer put on the shelf (docs/FACE_PART_LIBRARY.md, "Active and legacy").
  // Four pairs of eyes are held back here, and the button that shows them says
  // so rather than the shelf silently being shorter.
  await expect(panel).toHaveAttribute('data-face-library-legacy', '4');
  const offered = await cards.evaluateAll((list) => list.map((card) => card.dataset.faceLibraryCard));
  expect(offered.every((id) => !id.includes('robot')), 'no pack drawing on the human shelf').toBe(true);
  await panel.locator('[data-face-library-show-legacy="on"]').click();
  await expect(panel).toHaveAttribute('data-face-library-legacy', '0');
  expect(await cards.count(), 'and there is a way to see them').toBe(offered.length + 4);
  await panel.locator('[data-face-library-show-legacy="off"]').click();
  await expect(panel).toHaveAttribute('data-face-library-legacy', '4');
  // The drawing itself, not its name: *Sleepy* and *Cartoon* were not words
  // anybody could choose eyes by. And each preview's ids are its own, so no card
  // on the shelf is clipped to another card's mask.
  const preview = cards.first().locator('svg.face-library-preview');
  await expect(preview).toBeVisible();
  expect(await preview.innerHTML()).not.toContain('url(#socketLeft)');
  // The template drew its own face, so it wears nothing *from the library* —
  // a different answer from wearing nothing at all.
  await expect(panel).toContainText('drawn or imported');

  const before = await revision(page);
  const oldPivot = (await state(page)).elements[(await partOfType(page, 'eyes')).roles.leftEye].baseTransform.pivotY;
  await panel.locator('[data-face-library-card="eyes.simple"] [data-face-library-wear]').click();
  expect(await revision(page), 'a press is a write').toBeGreaterThan(before);
  await expect(panel.locator('[data-face-library-card="eyes.simple"]')).toHaveClass(/face-library-worn/);
  await expect(panel).toContainText('Wearing');

  // The drawing arrives on the canvas, the roles are taken by its shapes, and
  // the movement the old eyes had is kept on a driver the new ones can carry.
  const eyes = await partOfType(page, 'eyes');
  expect(eyes.assetId, 'the part records the drawing it came from').toBe('eyes.simple');
  expect(await markupHas(page, eyes.assetRoot), 'and the drawing itself is in the artwork').toBe(true);
  const eye = (await state(page)).elements[eyes.roles.leftEye];
  // Fitted to this head, and the fit is now very nearly the identity: the three
  // builds are drawn at the template's own eye centres and their box is exactly
  // what they paint, where the old sets reported a box three times too tall
  // because their lids were parked outside a socket (docs/EYE_BUILDS.md). So
  // what is asked is that the eye lands on the template's own eye line rather
  // than that the fit moved it.
  expect(Math.abs(eye.baseTransform.pivotY - oldPivot), 'on the template\'s own eye line').toBeLessThan(2);
  expect(eyes.assetFit, 'and the fit was measured, not skipped').toBeTruthy();
  expect(eyes.controls, 'the movement it had is still the part’s').toContain('eyeOpen');
  expect(eye.bindings.scaleY.expression, 'and it reaches the new drawing, sides and all').toBe('eyeOpen + eyeOpenLeft');
  expect(eye.bindings.scaleY.generatedBy.control).toBe('eyeOpen');

  // One command, so one undo: the drawing leaves and the old eyes come back.
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await partOfType(page, 'eyes')).assetId).toBeFalsy();
  expect(await markupHas(page, 'eyes-simple'), 'the whole drawing, in one step').toBe(false);
  expect((await state(page)).elements[(await partOfType(page, 'eyes')).roles.leftEye].baseTransform.pivotY).toBe(oldPivot);

  // Another category is another press, not another screen.
  await panel.locator('[data-face-library-category="hair"]').click();
  await expect(panel).toHaveAttribute('data-face-library-category', 'hair');
  expect(await panel.locator('[data-face-library-card]').count()).toBeGreaterThanOrEqual(5);
});

test('@critical the Inspector says what a piece is, for a path as well as a picture', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  // The nose is a path, which is the case that used to render nothing: the
  // role and *How it moves* both sat behind `geometryFields('path')`, which is
  // empty, so neither question was ever asked of a drawing.
  await selectLayerById(page, 'nose');
  const inspector = page.locator('#context-inspector');
  await expect(inspector).toContainText('This piece');
  const role = inspector.locator('[data-piece-role]');
  await expect(role).toBeVisible();
  await expect(inspector.locator('[data-rigging-type]'), 'and the question that was there is still there').toBeVisible();

  // It opens on what the piece already is, and offers every role the registry
  // knows, grouped by the part that owns it.
  await expect(role).toHaveValue('nose.nose');
  expect(await role.locator('optgroup').count()).toBeGreaterThanOrEqual(9);
  // Thirty-four: the thirty-three roles the registry knows, and the one that
  // means none of them. Six of the thirty-three are V6's -- a lower row of
  // teeth, the tongue's tip and groove (each of which is a role of the mouth
  // *and* of the tongue part), and the uvula (docs/MOUTH_BUILD.md).
  expect(await role.locator('option').count(), 'the vocabulary, and the one that means none of it').toBe(34);
  // A role another drawing holds says so, so nobody takes one by surprise.
  await expect(role.locator('option[value="mouth.mouth"]')).toContainText('now');

  // And choosing changes the mascot: the nose becomes the left ear, in one step.
  const before = await revision(page);
  await role.selectOption('ears.leftEar');
  expect(await revision(page)).toBe(before + 1);
  expect((await partOfType(page, 'ears')).roles.leftEar).toBe('nose');
  expect((await partOfType(page, 'nose')).roles.nose, 'and it is no longer the nose').toBeUndefined();
  await expect(inspector.locator('[data-piece-role]')).toHaveValue('ears.leftEar');

  // Off the face entirely is an answer too.
  await inspector.locator('[data-piece-role]').selectOption('');
  await expect.poll(async () => (await partOfType(page, 'ears')).roles.leftEar).toBeUndefined();
});

test('@critical the checklist is eight, and the other twenty-five are one disclosure away', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openSetupSection(page, 'face-parts');
  const panel = page.locator('#face-setup-checklist');

  // The eight stay the eight: a face with no ears and no jaw is finished, and
  // a count of 8 / 25 would call every mascot in the world unfinished.
  await expect(panel.locator('.face-checklist > [data-face-role]:not([data-face-role-optional])')).toHaveCount(8);
  const progress = panel.locator('[data-face-progress]');
  await expect(progress).toContainText('8 / 8');
  await expect(progress).toHaveAttribute('data-face-progress-complete', 'true');

  // And the rest are reachable here, where an author is already naming parts,
  // rather than only from Rig ▸ Deform ▸ All parts.
  const extras = panel.locator('details.face-role-extras');
  await extras.locator('> summary').click();
  // Twenty-five, grouped into ten: nineteen since the gaze grew an iris per
  // side -- it has extras of its own now, where both its roles used to be in
  // the eight -- and six more since the mouth grew a lower row of teeth, the
  // tongue a tip and a groove (both of which the tongue part plays as well) and
  // the mouth a uvula (docs/MOUTH_BUILD.md). All optional, as every extra is:
  // a mouth that draws none behaves as it did.
  await expect(extras.locator('[data-face-role-optional="true"]')).toHaveCount(25);
  await expect(extras.locator('[data-face-role-group]')).toHaveCount(10);
  for (const id of ['eyelids.leftUpper', 'nose.nose', 'ears.leftEar', 'hair.hairBack', 'mouth.teeth', 'mouth.teethLower', 'mouth.tongueTip', 'mouth.tongueGroove', 'mouth.uvula', 'jaw.jaw']) {
    await expect(extras.locator(`[data-face-role="${id}"]`)).toBeVisible();
  }

  // Clearing an optional role works from its own row, and does not touch the
  // eight or what "complete" means.
  const before = await revision(page);
  await extras.locator('[data-face-role="nose.nose"] [data-face-role-clear]').click();
  expect(await revision(page)).toBe(before + 1);
  await expect(progress).toContainText('8 / 8');
  await expect(progress).toHaveAttribute('data-face-progress-complete', 'true');
  await expect(extras.locator('[data-face-role="nose.nose"]')).toHaveAttribute('data-face-role-status', 'missing');
  // The disclosure stays open across the re-render, which is what
  // `rememberOpen` is for: a row that closed its own section on every press
  // would be unusable.
  await expect(extras).toHaveAttribute('open', '');
});
