import { test, expect } from '@playwright/test';
import { goToWorkspace, openFreshEditor, openSetupSection, startBasicFace } from './editor-helpers.js';

/**
 * Hand mode (VNX-19, docs/HAND_RIGGING.md).
 *
 * ```text
 *      ┌───────────┐
 *      │   HAND    │
 *      └───────────┘
 *           ●
 *      ⌒⌒⌒⌒⌒⌒⌒⌒⌒⌒◆
 *           │
 *         anchor
 * ```
 *
 * A hand's anchor was two number fields and its reach two more. Both are
 * geometry — where the hand hangs from, and how far it may go — so both are
 * drawn on the canvas and dragged there. And both are *document* fields rather
 * than a pose, so one whole drag is one command and one undo.
 */
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const anchorOf = async (page) => (await documentOf(page)).hands.left.anchor;
const ellipseOf = (page) => page.evaluate(() => {
  const node = document.querySelector('#canvas [data-hand-rig-layer] ellipse');
  return node ? { cx: Number(node.getAttribute('cx')), cy: Number(node.getAttribute('cy')), rx: Number(node.getAttribute('rx')), ry: Number(node.getAttribute('ry')) } : null;
});

const anchorHandle = (page) => page.locator('#canvas [data-hand-rig="anchor"]');
const reachHandle = (page) => page.locator('#canvas [data-hand-rig="reach"]');

async function centreOf(locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('The hand mode handle has no box to grab.');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A pair of hands, rigged, with Hand Setup open on the left one. */
async function openHandMode(page) {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="face-setup"]').click();
  await openSetupSection(page, 'hands');
  await expect(page.locator('#hand-setup[data-hand-setup-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Draw a pair of hands' }).click();
  await expect(page.locator('#canvas #handLeft')).toBeVisible();
}

test('@critical the anchor and the reach are drawn for the hand being set up', async ({ page }) => {
  await openHandMode(page);
  // Hand mode opens for one hand: the side Hand Setup has open, or the hand
  // whose own artwork is selected — which is what "Show on canvas" does.
  await page.locator('[data-hand-card="left"]').getByRole('button', { name: 'Show on canvas' }).click();
  await expect(anchorHandle(page)).toBeVisible();
  await expect(reachHandle(page)).toBeVisible();

  // What is drawn is the model's own ellipse, around the anchor: the same
  // numbers Hand Setup shows in its Motion section.
  const hand = (await documentOf(page)).hands.left;
  const ellipse = await ellipseOf(page);
  expect(ellipse.rx).toBeCloseTo(hand.reach.x, 3);
  expect(ellipse.ry).toBeCloseTo(hand.reach.y, 3);
  expect(ellipse.cx).toBeCloseTo(hand.anchor.x + hand.restOffset.x, 3);
  expect(ellipse.cy).toBeCloseTo(hand.anchor.y + hand.restOffset.y, 3);

  // And it belongs to the task where a hand is set up and to no other: a reach
  // ellipse round every mascot in every task is clutter on every canvas an
  // author ever looks at.
  for (const workspace of ['create', 'animate', 'preview']) {
    await goToWorkspace(page, workspace);
    await expect(anchorHandle(page), `hand mode leaked into ${workspace}`).toBeHidden();
    await expect(page.locator('#canvas [data-hand-rig-layer]')).toHaveCSS('display', 'none');
  }
  await goToWorkspace(page, 'rig');
  await expect(anchorHandle(page)).toBeVisible();
});

test('@critical dragging the anchor moves where the hand hangs, in one undo step', async ({ page }) => {
  await openHandMode(page);
  await page.locator('[data-hand-card="left"]').getByRole('button', { name: 'Show on canvas' }).click();
  await expect(anchorHandle(page)).toBeVisible();

  const before = await anchorOf(page);
  const ellipseBefore = await ellipseOf(page);
  const grab = await centreOf(anchorHandle(page));

  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x + 40, grab.y - 25, { steps: 8 });
  // Mid-gesture the document is untouched: a write per frame would be a
  // hundred undo steps for one drag.
  expect(await anchorOf(page)).toEqual(before);
  // The picture follows the pointer all the same.
  expect((await ellipseOf(page)).cx).not.toBeCloseTo(ellipseBefore.cx, 3);
  await page.mouse.up();

  const after = await anchorOf(page);
  expect(after).not.toEqual(before);
  expect(after.x).toBeGreaterThan(before.x);
  expect(after.y).toBeLessThan(before.y);
  // The reach travels with the anchor it is measured from.
  const ellipseAfter = await ellipseOf(page);
  expect(ellipseAfter.cx).toBeCloseTo(after.x + (await documentOf(page)).hands.left.restOffset.x, 3);
  expect(ellipseAfter.rx).toBeCloseTo(ellipseBefore.rx, 3);

  // One drag, one undo.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(() => anchorOf(page)).toEqual(before);
  await expect.poll(async () => (await ellipseOf(page)).cx).toBeCloseTo(ellipseBefore.cx, 3);
});

test('dragging the ellipse changes how far the hand can go, and never to nothing', async ({ page }) => {
  await openHandMode(page);
  await page.locator('[data-hand-card="left"]').getByRole('button', { name: 'Show on canvas' }).click();
  await expect(reachHandle(page)).toBeVisible();

  const before = (await documentOf(page)).hands.left.reach;
  const grab = await centreOf(reachHandle(page));
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x + 40, grab.y + 30, { steps: 8 });
  await page.mouse.up();

  const after = (await documentOf(page)).hands.left.reach;
  expect(after.x).toBeGreaterThan(before.x);
  expect(after.y).toBeGreaterThan(before.y);
  // Only the ellipse: the turn range is a reach too, and not this handle's.
  expect(after.rotation).toBe(before.rotation);

  // Dragging the edge onto the centre would be a hand that cannot move at all.
  const anchor = await centreOf(anchorHandle(page));
  const edge = await centreOf(reachHandle(page));
  await page.mouse.move(edge.x, edge.y);
  await page.mouse.down();
  await page.mouse.move(anchor.x, anchor.y, { steps: 8 });
  await page.mouse.up();
  const floored = (await documentOf(page)).hands.left.reach;
  expect(floored.x).toBeGreaterThan(0);
  expect(floored.y).toBeGreaterThan(0);
});

test('the anchor answers to the keyboard as well as to the pointer', async ({ page }) => {
  await openHandMode(page);
  await page.locator('[data-hand-card="left"]').getByRole('button', { name: 'Show on canvas' }).click();
  await expect(anchorHandle(page)).toBeVisible();

  const before = await anchorOf(page);
  await anchorHandle(page).focus();
  await anchorHandle(page).press('ArrowRight');
  await expect.poll(async () => (await anchorOf(page)).x).toBeCloseTo(before.x + 1, 3);
  await anchorHandle(page).press('Shift+ArrowUp');
  await expect.poll(async () => (await anchorOf(page)).y).toBeCloseTo(before.y - 10, 3);
  // One press is one step back, exactly like one drag is.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect.poll(async () => (await anchorOf(page)).y).toBeCloseTo(before.y, 3);
});
