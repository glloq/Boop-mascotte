import { test, expect } from '@playwright/test';
import { openFreshEditor, openTask, startEmptyBasicFace } from './editor-helpers.js';

const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const mutations = (page) => page.evaluate(() => window.__BOOP_E2E__.diagnostics().store.documentMutations);

// The kit is for a mascot that has nothing yet -- an imported drawing, a face
// somebody built -- so these start from the template with its own catalogues
// cleared. On the template as it ships there is nothing left for the kit to
// add, and it correctly offers nothing.
test('@critical one press fills an empty mascot with faces, motions, reactions and life', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startEmptyBasicFace(page);
  await openTask(page, 'expressions');

  // The offer is the same in all three studios, so it is met wherever an
  // author lands first.
  const card = page.locator('#expressions-panel [data-starter-kit]');
  await expect(card).toContainText('One press');
  await expect(page.locator('#motion-panel [data-starter-kit]')).toHaveCount(1);
  await expect(page.locator('#reactions-panel [data-starter-kit]')).toHaveCount(1);

  const before = await mutations(page);
  await card.getByRole('button', { name: 'Add the starter kit' }).click();

  // One command: one document mutation, one undo step, four domains.
  expect(await mutations(page)).toBe(before + 1);
  const built = await documentOf(page);
  // The eight faces, then the eight speech shapes: a viseme is an expression
  // record like any other, which is what lets the mascot speak *while* being
  // happy (docs/VISEME_SYSTEM.md).
  expect(built.expressions.map((item) => item.id)).toEqual(['happy', 'sad', 'surprised', 'angry', 'curious', 'excited', 'sleepy', 'confused',
    'viseme-rest', 'viseme-mbp', 'viseme-fv', 'viseme-ae', 'viseme-ee', 'viseme-oh', 'viseme-oo', 'viseme-l']);
  expect(built.animationClips.map((item) => item.motion.preset)).toEqual(['nod', 'shake', 'bounce', 'tilt', 'blink', 'look-around']);
  expect(built.reactions.map((item) => item.id)).toEqual(['surprise', 'greet', 'notice', 'glance']);
  expect(built.behaviors.some((item) => item.type === 'blink' && item.enabled)).toBe(true);
  // Every reaction points at something this same press created.
  for (const reaction of built.reactions) expect(built.expressions.some((item) => item.id === reaction.expression?.id) || built.animationClips.some((item) => item.id === reaction.motion?.clipId)).toBe(true);

  // Sixteen: the eight faces and the eight speech shapes, which are expression
  // records too (docs/VISEME_SYSTEM.md). The panel lists them under two
  // headings and the count says how many the project holds, all told.
  await expect(page.locator('#expressions-panel')).toHaveAttribute('data-expressions-count', '16');
  await expect(page.locator('#expressions-panel .expression-list[aria-label="Speech shapes"] li')).toHaveCount(8);
  await expect(page.locator('#expressions-panel .expression-list[aria-label="Expressions"] li')).toHaveCount(8);
  // The template already runs its automatic life, so the kit only adds the rest.
  await expect(page.locator('#expressions-panel [role="status"]')).toContainText('8 faces, 8 speech shapes, 6 motions and 4 reactions');
  // Nothing left to add: the offer takes itself off the panels.
  await expect(page.locator('[data-starter-kit]')).toHaveCount(0);

  await page.keyboard.press('Control+z');
  const undone = await documentOf(page);
  expect([undone.expressions.length, undone.animationClips.length, undone.reactions.length]).toEqual([0, 0, 0]);
  await expect(page.locator('#expressions-panel [data-starter-kit]')).toHaveCount(1);
});

test('the catalogues are grouped, and a group opens to reveal the rest', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startEmptyBasicFace(page);
  await openTask(page, 'expressions');

  const groups = page.locator('[data-preset-catalogue="expressions"] .preset-group');
  await expect(groups).toHaveCount(5);
  // The groups are a strip and one group's cards show (UX-60 PR 5): the first
  // is the one showing, and every group is named on the strip whether or not
  // its cards are.
  await expect(groups.first()).toBeVisible();
  await expect(page.locator('[data-preset-catalogue="expressions"] [data-preset-group-pick]')).toHaveCount(5);
  // A card in a group that is not showing is present but out of the way.
  const laughing = page.locator('[data-expression-preset-card="laughing"]');
  await expect(laughing).toHaveCount(1);
  await expect(laughing).not.toBeVisible();
  await page.locator('[data-preset-group-pick="Playful"]').click();
  await expect(laughing).toBeVisible();
  const add = laughing.getByRole('button', { name: 'Add Laughing preset' });
  await add.scrollIntoViewIfNeeded();
  // Scrolled deliberately rather than by reaching for the card: the catalogue
  // is a grid of a single group now (UX-60 PR 5) and fits without scrolling,
  // which is the point -- but a column that *is* scrolled still has to stay
  // where it was, and that is what this pins.
  await page.locator('#left').evaluate((node) => { node.scrollTop = Math.max(0, node.scrollHeight - node.clientHeight); });
  const scrolled = await page.locator('#left').evaluate((node) => node.scrollTop);
  expect(scrolled, 'the column has somewhere to be scrolled to').toBeGreaterThan(0);
  await add.click();
  expect((await documentOf(page)).expressions.map((item) => item.id)).toEqual(['laughing']);
  // The panel rebuilds itself on every edit, and used to take the open group
  // and the scroll position with it: one press sent you back to the top of a
  // list with the first group open, hunting for where you were.
  await expect(page.locator('[data-preset-group="Playful"]'), 'the group the author picked survives the rebuild').toBeVisible();
  await expect(laughing).toBeVisible();
  expect(await page.locator('#left').evaluate((node) => node.scrollTop)).toBe(scrolled);

  await openTask(page, 'reactions');
  // Five whens since V3-09: following the pointer joined the four.
  const triggers = page.locator('[data-preset-catalogue="reactions"] .preset-group');
  await expect(triggers).toHaveCount(5);
  // Reactions has no strip of its own: the one above both halves is the
  // screen's single axis (UX-60 PR 7).
  await expect(page.locator('[data-preset-catalogue="reactions"] [data-preset-group-pick]')).toHaveCount(0);
  await expect(page.locator('[data-runs-when-pick]').first()).toContainText('When clicked');
});
