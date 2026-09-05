import { test, expect } from '@playwright/test';
import { openFreshEditor, startBasicFace, openSetupSection } from './editor-helpers.js';

/**
 * The rig's relationships panel (docs/FACE_CONTROL_RIG.md, §9 … §11).
 *
 * The solver could keep six relationships true and a pin could be given a
 * reach, and neither could be *authored*: nothing in the editor wrote a
 * constraint, and a pin had no field saying what moves it. A rig that runs and
 * cannot be built is the failure this suite exists to catch, so it drives the
 * panel the way an author does and reads the document back.
 */
const openHolding = async (page) => {
  await openSetupSection(page, 'holding');
  await expect(page.locator('[data-holding-panel]')).toBeVisible();
};
const rig = (page) => page.evaluate(() => window.__BOOP_E2E__.document());

test('a pin says what moves it, and says so when nothing does', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openHolding(page);

  // The template's own mouth corner: it rises with the corner's own movement,
  // and the panel shows the two directions separately because they follow
  // different movements.
  const corner = page.locator('[data-rig-pin-row="mouth-corner-left"]');
  await expect(corner).toHaveCount(1);
  await expect(corner.locator('[data-pin-motion-axis="y"][data-pin-motion-field="expression"]')).toHaveValue('smileLeft');
  await expect(corner.locator('[data-pin-motion-axis="x"][data-pin-motion-field="expression"]')).toHaveValue('mouthWidthLeft');

  // A reach is an ellipse, and both halves of it are editable. Writing one is
  // not allowed to flatten the other.
  const across = corner.locator('[data-pin-field="radiusX"]');
  const down = corner.locator('[data-pin-field="radiusY"]');
  const before = await down.inputValue();
  await across.fill('30');
  await across.dispatchEvent('change');
  await expect(page.locator('[data-rig-pin-row="mouth-corner-left"] [data-pin-field="radiusY"]')).toHaveValue(before);

  // And a movement the mascot has not got is said out loud rather than left to
  // be discovered on the canvas.
  const expression = page.locator('[data-rig-pin-row="mouth-corner-left"] [data-pin-motion-axis="y"][data-pin-motion-field="expression"]');
  await expression.fill('smle');
  await expression.dispatchEvent('change');
  await expect(page.locator('[data-rig-pin-row="mouth-corner-left"]')).toContainText('is not a movement this mascot has');
});

test('a relationship can be added, set, reordered and removed', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openHolding(page);
  await expect(page.locator('[data-holding-panel]')).toContainText('None yet');

  const form = page.locator('[data-constraint-form]');
  await form.locator('[data-constraint-target]').selectOption('nose');
  await form.locator('[data-constraint-type]').selectOption('parent');
  await form.locator('[data-constraint-source]').selectOption('head');
  await page.locator('[data-holding-action="add-constraint"]').click();

  const row = page.locator('[data-rig-constraint-row="nose-parent"]');
  await expect(row).toHaveCount(1);
  expect((await rig(page)).rigConstraints.map((item) => [item.target, item.type, item.source])).toEqual([['nose', 'parent', 'head']]);

  // A kind is set by its own fields: a `parent` copies place, turn or size; a
  // `limit` has bounds and no source at all.
  await expect(row.locator('[data-constraint-copy="rotate"]')).toHaveCount(1);
  await expect(row.locator('[data-constraint-field="limit"]')).toHaveCount(0);
  await row.locator('[data-constraint-field="type"]').selectOption('limit');
  await expect(page.locator('[data-rig-constraint-row="nose-parent"] [data-constraint-field="limit"]')).toHaveCount(8);
  await expect(page.locator('[data-rig-constraint-row="nose-parent"] [data-constraint-field="source"]')).toHaveCount(0);

  // Faded by a movement, which is what makes it something an animator keys.
  const weight = page.locator('[data-rig-constraint-row="nose-parent"] [data-constraint-field="weight"]');
  await weight.fill('nosePinned');
  await weight.dispatchEvent('change');
  expect((await rig(page)).params.nosePinned.default).toBe(1);

  // The order is the rule, so the list can be walked through.
  await page.locator('[data-constraint-form] [data-constraint-target]').selectOption('mouth');
  await page.locator('[data-constraint-form] [data-constraint-type]').selectOption('axis');
  await page.locator('[data-holding-action="add-constraint"]').click();
  expect((await rig(page)).rigConstraints.map((item) => item.id)).toEqual(['nose-parent', 'mouth-axis']);
  await page.locator('[data-holding-action="constraint-up"][data-holding-id="mouth-axis"]').click();
  expect((await rig(page)).rigConstraints.map((item) => item.id)).toEqual(['mouth-axis', 'nose-parent']);

  // One command, one undo step.
  await page.keyboard.press('Control+z');
  expect((await rig(page)).rigConstraints.map((item) => item.id)).toEqual(['nose-parent', 'mouth-axis']);

  await page.locator('[data-holding-action="remove-constraint"][data-holding-id="nose-parent"]').click();
  expect((await rig(page)).rigConstraints.map((item) => item.id)).toEqual(['mouth-axis']);
  await expect(page.locator('[data-setup-section="holding"] [data-setup-summary]')).toContainText('rule');
});

test('a named point is a starting place, and a mascot can name its own', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openHolding(page);

  // The suggestions come from the parts the project already has.
  await page.locator('[data-holding-action="add-point"][data-holding-id="face.cheek.left"]').click();
  const cheek = (await rig(page)).rigAttachments.find((item) => item.id === 'face.cheek.left');
  expect(cheek.target).toBeTruthy();

  // And a suggestion is a starting place, not a decision: a cheek is a fraction
  // of the way across a head, and the fraction right for one mascot is wrong
  // for the next.
  const across = page.locator('[data-point-field="x"][data-point-id="face.cheek.left"]');
  await across.fill(String(Math.round(cheek.point.x) + 7));
  await across.dispatchEvent('change');
  const moved = (await rig(page)).rigAttachments.find((item) => item.id === 'face.cheek.left');
  expect(moved.point.x).toBe(Math.round(cheek.point.x) + 7);
  expect(moved.point.y).toBe(cheek.point.y);

  // A mascot with a snout has places to be held that no list could have
  // guessed, so it names its own — at the middle of its artwork, to move from.
  await page.locator('[data-point-form] [data-point-name]').fill('snout.tip');
  await page.locator('[data-point-form] [data-point-target]').selectOption('nose');
  await page.locator('[data-holding-action="add-own-point"]').click();
  const snout = (await rig(page)).rigAttachments.find((item) => item.id === 'snout.tip');
  expect(snout.target).toBe('nose');
  expect(Number.isFinite(snout.point.x) && Number.isFinite(snout.point.y)).toBe(true);

  // Two points, so one can hold the other; the contact is created with it.
  await page.locator('[data-holding-form] [data-holding-hand]').selectOption('snout.tip');
  await page.locator('[data-holding-form] [data-holding-anchor]').selectOption('face.cheek.left');
  await page.locator('[data-holding-action="hold"]').click();
  const document = await rig(page);
  expect(document.rigHolds).toHaveLength(1);
  expect(document.params[document.rigHolds[0].weight].default).toBe(0);
});
