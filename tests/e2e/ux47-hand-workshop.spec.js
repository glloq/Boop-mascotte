import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * Design ▸ Hands (UIR-05, docs/HAND_STYLES.md).
 *
 * Two hands, two libraries, and the six things an author does to a state. The
 * acceptance test for "adding a hand easily" is still here and still the point:
 * a ninth drawing arrives as a **file an author picks**, joins the set, can be
 * added to a hand, and is still there after a reload — with **no code change
 * anywhere**. Everything in this file is measured in the browser, because the
 * point of it is the path a person walks.
 */
const workshop = (page) => page.locator('#hand-workshop');
const SHIPPED = 8;

/** A drawing somebody could have made in any editor, in the set's own frame. */
const gestureFile = (id, name) => ({
  name: `${id}.svg`,
  mimeType: 'image/svg+xml',
  buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200"`
    + ` data-hand-pivot="100 100" data-hand-scale="2"><g id="hand-${id}" data-name="${name}">`
    + `<path id="palm" data-name="Palm" d="M 70 90 L 130 90 L 130 150 L 70 150 Z" fill="#ffffff" stroke="#1b1b1b" stroke-width="3.8" />`
    + `<path id="thumb" data-name="Thumb" d="M 55 120 L 70 105 L 70 135 Z" fill="#ffffff" stroke="#1b1b1b" stroke-width="3.8" />`
    + `</g></svg>`)
});

/** The set is under Advanced: importing one is a real thing to do and a rare one. */
async function openSet(page) {
  const details = workshop(page).locator('.hand-set-advanced');
  if (!(await details.evaluate((element) => element.hasAttribute('open')))) await details.locator(':scope > summary').click();
  await expect(details).toHaveAttribute('open', '');
}

async function openWorkshop(page) {
  await goToMode(page, 'design.hands');
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'hands');
  await expect(workshop(page)).toBeVisible();
}

test('@critical Hands is the screen for both hands, each with its own states', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  // A screen of its own, beside Face: hands are designed away from the face.
  await expect(page.locator('.stage-steps [data-mode="design.hands"]')).toBeVisible();
  await openWorkshop(page);

  // Two hands, two libraries (§16). Each shows its own states, and one of them
  // is the one that hand rests on.
  for (const side of ['left', 'right']) {
    const hand = workshop(page).locator(`[data-hand-states="${side}"]`);
    await expect(hand).toBeVisible();
    await expect(hand.locator('[data-hand-state]')).toHaveCount(SHIPPED);
    await expect(hand.locator('[data-hand-state] .part-style-badge', { hasText: 'Resting' })).toHaveCount(1);
    // Every card is the drawing itself, not a name standing in for one: the
    // whole point of a picker is to catch a drawing that is wrong.
    await expect(hand.locator('[data-hand-state] .hand-thumb path').first()).toBeAttached();
  }

  // The set they were drawn from is here too, under Advanced: importing one is
  // a real thing to do and a rare one.
  await openSet(page);
  await expect(workshop(page).locator('[data-hand-gesture]')).toHaveCount(SHIPPED);
  await expect(workshop(page).locator('[data-hand-gesture-forget]')).toHaveCount(0, 'the set\'s own drawings cannot be forgotten — there is nothing to put back');

  // Nothing here writes the document until a verb is pressed: looking is free.
  const revision = await page.evaluate(() => window.__BOOP_E2E__.documentRevisions().persistent);
  await workshop(page).locator('[data-hand-state="left:point"]').click();
  await expect(workshop(page).locator('[data-hand-state-actions="left:point"]')).toBeVisible();
  expect(await page.evaluate(() => window.__BOOP_E2E__.documentRevisions().persistent)).toBe(revision);
});

test('@critical a state is used, duplicated, renamed, mirrored and deleted, and the other hand never moves', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openWorkshop(page);
  const left = () => workshop(page).locator('[data-hand-states="left"]');
  const right = () => workshop(page).locator('[data-hand-states="right"]');
  const states = (side) => page.evaluate((which) => window.__BOOP_E2E__.document().hands[which].styles.library.map((entry) => entry.id), side);
  const rightBefore = await states('right');

  // Use: the hand rests on it, and nothing else changes.
  await left().locator('[data-hand-state="left:point"]').click();
  await left().locator('[data-hand-state-use]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.document().hands.left.styles.showing)).toBe('point');
  expect(await states('right')).toEqual(rightBefore);

  // Duplicate: a drawing of its own, on this hand only.
  await left().locator('[data-hand-state="left:point"]').click();
  await left().locator('[data-hand-state-duplicate]').click();
  await expect.poll(() => states('left')).toContain('point-copy');
  expect(await states('right')).toEqual(rightBefore, 'the other hand did not gain it');
  await expect(page.locator('#canvas #handLeftStyle-point-copy')).toHaveCount(1, 'and it is drawn');

  // Rename: this hand's name for it, and the set keeps its own.
  await left().locator('[data-hand-state="left:point-copy"]').click();
  page.once('dialog', (dialog) => dialog.accept('Jab'));
  await left().locator('[data-hand-state-rename]').click();
  await expect(left().locator('[data-hand-state="left:point-copy"]')).toContainText('Jab');
  await expect(workshop(page).locator('[data-hand-gesture="point"]')).toContainText('Point');

  // Mirror copy: the other hand gains it, and nothing links them afterwards.
  await left().locator('[data-hand-state="left:point-copy"]').click();
  await left().locator('[data-hand-state-mirror]').click();
  await expect.poll(() => states('right')).toContain('point-copy');
  await expect(right().locator('[data-hand-state="right:point-copy"]')).toBeVisible();

  // Delete: the state and its drawing go, on that hand alone.
  await right().locator('[data-hand-state="right:point-copy"]').click();
  await right().locator('[data-hand-state-delete]').click();
  await expect.poll(() => states('right')).toEqual(rightBefore);
  await expect.poll(() => states('left')).toContain('point-copy');
  await expect(page.locator('#canvas #handRightStyle-point-copy')).toHaveCount(0);

  // And the project still validates: a state is a drawing and an entry, and
  // half-writing one is how a hand ends up pointing at artwork that is not there.
  const blocking = await page.evaluate(() => window.__BOOP_E2E__.readiness().issues.filter((issue) => issue.severity === 'error'));
  expect(blocking).toEqual([]);
});

test('@critical a ninth gesture is a file: it becomes a card, goes on a hand, and survives a reload', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openWorkshop(page);
  await openSet(page);

  await page.locator('#hand-gesture-file').setInputFiles(gestureFile('salute', 'Salute'));
  await expect(workshop(page).locator('[data-hand-gesture]')).toHaveCount(SHIPPED + 1);
  await expect(workshop(page).locator('[data-hand-gesture="salute"]')).toContainText('Salute');
  await expect(workshop(page).locator('[data-hand-gesture="salute"]')).toContainText('Mine');
  await expect(workshop(page).locator('[data-hand-set-notice]')).toContainText('Salute is in the set now');

  // It is a card in the Character Builder at once -- one library, read by both.
  await goToMode(page, 'design.face');
  await page.locator('[data-part-category="hands"]').click();
  await expect(page.locator('#part-browser [data-hand-style="left:salute"]')).toHaveCount(1);

  // And it can be drawn on a hand, which is the whole promise.
  await page.locator('#part-browser [data-hand-style="left:salute"]').click();
  await expect.poll(() => page.evaluate(() => window.__BOOP_E2E__.document().hands.left.styles.showing)).toBe('salute');
  await expect(page.locator('#canvas g#handLeftStyle-salute')).toHaveCount(1);
  await expect(page.locator('#canvas #handLeftStyle-salute > path')).toHaveCount(2, 'the layers the file drew');
  await expect(page.locator('#canvas #handLeftStyle-salute-palm')).toHaveCount(1);

  // Kept in this browser, under its own key beside the face parts.
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('boop.handSets') || '[]'));
  expect(stored.map((gesture) => gesture.id)).toEqual(['salute']);
  expect(stored[0].label).toBe('Salute');

  // A second session reads it back: a new page in the same browser, which
  // carries the storage but not this page's "start clean" script.
  const next = await page.context().newPage();
  await next.goto('./?e2e=1');
  await expect(next.locator('[data-editor-ready="true"]')).toHaveCount(1);
  await expect.poll(() => next.evaluate(() => Boolean(window.__BOOP_E2E__))).toBe(true);
  await startBasicFace(next);
  await next.locator('[data-mode="design.hands"]').click();
  await openSet(next);
  await expect(workshop(next).locator('[data-hand-gesture="salute"]')).toHaveCount(1, 'a ninth gesture survives the session that added it');

  // And an author's own gesture can be forgotten again.
  await workshop(next).locator('[data-hand-gesture-forget="salute"]').click();
  await expect(workshop(next).locator('[data-hand-gesture]')).toHaveCount(SHIPPED);
  await expect(workshop(next).locator('[data-hand-set-notice]')).toContainText('forgotten');
  expect(await next.evaluate(() => JSON.parse(localStorage.getItem('boop.handSets') || '[]'))).toEqual([]);
  await next.close();
});

test('@critical a drawing that does not fit the set is refused, and says which rule it broke', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openWorkshop(page);
  await openSet(page);

  // A layer with no id is a layer nothing can name, so nothing can edit it.
  const nameless = gestureFile('broken', 'Broken');
  nameless.buffer = Buffer.from(nameless.buffer.toString().replace(' id="thumb" data-name="Thumb"', ''));
  await page.locator('#hand-gesture-file').setInputFiles(nameless);
  await expect(workshop(page).locator('[data-hand-set-notice]')).toContainText('no id');
  await expect(workshop(page).locator('[data-hand-gesture]')).toHaveCount(SHIPPED, 'and nothing of it stays');

  // A drawing at another size would be a hand that changes size when it
  // changes gesture, which is the one thing a set exists to prevent.
  const huge = gestureFile('huge', 'Huge');
  huge.buffer = Buffer.from(huge.buffer.toString().replace('M 70 90 L 130 90 L 130 150 L 70 150 Z', 'M -400 -400 L 600 -400 L 600 600 L -400 600 Z'));
  await page.locator('#hand-gesture-file').setInputFiles(huge);
  await expect(workshop(page).locator('[data-hand-set-notice]')).toContainText('change size when it changed gesture');
  await expect(workshop(page).locator('[data-hand-gesture]')).toHaveCount(SHIPPED);
});

test('@critical Edit SVG opens one state of one hand, says which, and comes back', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openWorkshop(page);

  await workshop(page).locator('[data-hand-state="left:point"]').click();
  await workshop(page).locator('[data-hand-states="left"] [data-hand-state-edit]').click();

  // The vector tools, on that drawing, and the canvas says which of the two
  // hands' sixteen states it is (UIR-06).
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'design.artwork');
  const scope = page.locator('#artwork-scope');
  await expect(scope).toBeVisible();
  await expect(scope).toContainText('Design');
  await expect(scope).toContainText('Hands');
  await expect(scope).toContainText('Left hand');
  await expect(scope.locator('[data-artwork-crumb-last]')).toHaveText('Point');

  // Isolation: the edit is limited to that drawing, so everything else on the
  // mascot is out of the way rather than one careless drag from being moved.
  await expect(page.locator('#canvas[data-edit-scope="handLeftStyle-point"]')).toHaveCount(1);

  // And the way out is the way in reversed: back to Hands, scope lifted.
  await scope.locator('[data-artwork-scope-back="design.hands"]').click();
  await expect(page.locator('#app')).toHaveAttribute('data-mode', 'design.hands');
  await expect(page.locator('#artwork-scope')).toBeHidden();
});
