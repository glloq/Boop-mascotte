import { test, expect } from '@playwright/test';
import { goToMode, openFreshEditor, startBasicFace } from './editor-helpers.js';

/**
 * The hand workshop (docs/HAND_STYLES.md, "A gesture is a file").
 *
 * The acceptance test for "adding a hand easily": a ninth gesture arrives as a
 * **file an author picks**, becomes a card here and in the Character Builder at
 * once, can be drawn on a hand, and is still there after a reload — with **no
 * code change anywhere**. Everything in this file is measured in the browser,
 * because the point of it is the path a person walks.
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

async function openWorkshop(page) {
  await goToMode(page, 'design.hands');
  await expect(page.locator('#app')).toHaveAttribute('data-workspace', 'hands');
  await expect(workshop(page)).toBeVisible();
}

test('@critical the hand workshop is a step of Create, and shows the set hands are drawn from', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);

  // A step of its own, beside the Character Builder: hands are designed away
  // from the face now.
  await expect(page.locator('.stage-steps [data-mode="design.hands"]')).toBeVisible();
  await openWorkshop(page);
  await expect(workshop(page)).toHaveAttribute('data-hand-set', 'defaultCartoon');
  await expect(workshop(page).locator('[data-hand-gesture]')).toHaveCount(SHIPPED);
  // Every card is the drawing itself, not a name standing in for one: the whole
  // point of a picker is to catch a drawing that is wrong.
  await expect(workshop(page).locator('[data-hand-gesture] .hand-thumb path').first()).toBeAttached();
  // The set's own gestures cannot be forgotten -- there is nothing to put back.
  await expect(workshop(page).locator('[data-hand-gesture-forget]')).toHaveCount(0);
  // The mascot's pair is reported, because a gesture added is one an author
  // will want to put on a hand.
  await expect(workshop(page).locator('[data-hand-workshop-pair]')).toContainText('2 hands');
  // Nothing here writes the document: a set is not a mascot.
  const revision = await page.evaluate(() => window.__BOOP_E2E__.documentRevisions().persistent);
  await openWorkshop(page);
  expect(await page.evaluate(() => window.__BOOP_E2E__.documentRevisions().persistent)).toBe(revision);
});

test('@critical a ninth gesture is a file: it becomes a card, goes on a hand, and survives a reload', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await openWorkshop(page);

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
