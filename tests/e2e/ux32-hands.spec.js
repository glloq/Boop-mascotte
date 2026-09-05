import { test, expect } from '@playwright/test';
import { openFreshEditor, openSetupSection, startBasicFace } from './editor-helpers.js';

/**
 * Hands without an import (docs/HAND_RIGGING.md).
 *
 * "Il va falloir donner une bonne base pour ajouter des mains (avec 4 doigts)
 * sans avoir besoin d'importer de svg." Hand Setup could rig a hand, but its
 * first step was "choose the artwork that draws this hand" — and there was no
 * way to make that artwork in the editor.
 */
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const pathOf = (page, id) => page.evaluate((elementId) => document.querySelector(`#canvas #${elementId}`)?.getAttribute('d'), id);
const boxOf = (page, id) => page.evaluate((elementId) => {
  const box = document.querySelector(`#canvas #${elementId}`)?.getBoundingClientRect();
  return box ? { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width) } : null;
}, id);

async function openHands(page) {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="face-setup"]').click();
  await openSetupSection(page, 'hands');
  await expect(page.locator('#hand-setup[data-hand-setup-ready="true"]')).toBeVisible();
}

test('@critical one press draws a pair of four-fingered hands and rigs them', async ({ page }) => {
  await openHands(page);
  await expect(page.locator('#hand-setup')).toHaveAttribute('data-hand-setup-count', '0');
  await page.getByRole('button', { name: 'Draw a pair of hands' }).click();

  await expect(page.locator('#hand-setup')).toHaveAttribute('data-hand-setup-count', '2');
  await expect(page.locator('#canvas #handLeft')).toBeVisible();
  await expect(page.locator('#canvas #handRight')).toBeVisible();
  // Four digits: four rounded tips, and the other hand is its mirror image.
  // (The serializer drops the space after a command letter, hence `A[\s\d]`.)
  const arcs = (d) => (d.match(/A[\s\d]/g) || []).length;
  const left = await pathOf(page, 'handLeft'), right = await pathOf(page, 'handRight');
  expect(arcs(left)).toBe(4);
  expect(arcs(right)).toBe(4);
  expect(right).not.toBe(left);

  const document_ = await documentOf(page);
  for (const side of ['left', 'right']) {
    const hand = document_.hands[side];
    expect(hand.parent).toBe('faceRoot');
    expect(hand.poses.map((pose) => pose.id)).toEqual(['fist', 'point', 'peace', 'thumbsUp', 'spread', 'relax']);
    // Every pose has its shape, so pressing one does something: a pose without
    // one is the state the panel used to leave an author in.
    for (const pose of hand.poses) expect(document_.shapeKeys.some((key) => key.id === pose.shapeKey)).toBe(true);
  }
  expect(document_.animationClips.some((clip) => clip.id === 'hand-wave')).toBe(true);

  // A pair of hands hangs *below* the mascot, so adding them adds the room:
  // a face drawn to fill its artboard left them on the cheeks with nowhere to
  // reach. They point down with their thumbs towards the middle -- the outline
  // is drawn fingers-up, which is the one orientation a hanging hand never has.
  // The artboard grows by exactly the room the pair needs, measured from the
  // body (VNX-20), instead of to a blind 4:3 that gave 324. An imported mascot
  // sitting high in a tall canvas no longer gets an empty band bolted under it.
  expect(document_.svgMarkup).toContain('viewBox="0 0 240 317"');
  expect(document_.elements.handLeft.baseTransform.rotation).toBe(200);
  expect(document_.elements.handRight.baseTransform.rotation).toBe(160);
  for (const side of ['left', 'right']) {
    const hand = document_.hands[side];
    expect(hand.anchor.y).toBeGreaterThan(240, 'below the head, not across it');
    // A full turn, and room worth dragging through.
    expect(hand.reach.rotation).toBe(180);
    expect(hand.reach.x).toBeGreaterThan(30);
  }
  // Closing every finger at once, and turning the hand over, are movements of
  // their own: the four digit curls are the individual control, these are the
  // group ones.
  for (const name of ['handLGrip', 'handLFlip', 'handRGrip', 'handRFlip']) expect(document_.params[name]).toBeTruthy();
  for (const id of ['handLeft-grip', 'handLeft-flip']) expect(document_.shapeKeys.some((key) => key.id === id)).toBe(true);
  // The panel has nothing left to ask for.
  await expect(page.locator('[data-hand-card="left"]')).toHaveAttribute('data-hand-status', 'ready');

  // It is one undo step, artwork included.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#canvas #handLeft')).toHaveCount(0);
  await expect.poll(async () => (await documentOf(page)).hands).toBe(null);
});

test('@critical a hand pose reshapes the hand, and the hand can be moved and waved', async ({ page }) => {
  await openHands(page);
  await page.getByRole('button', { name: 'Draw a pair of hands' }).click();
  await expect(page.locator('#canvas #handLeft')).toBeVisible();
  const rest = await pathOf(page, 'handLeft');

  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('handLFist', 1));
  await expect.poll(() => pathOf(page, 'handLeft')).not.toBe(rest);
  const fist = await boxOf(page, 'handLeft');
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('handLFist', 0));
  await expect.poll(() => pathOf(page, 'handLeft')).toBe(rest);
  const open = await boxOf(page, 'handLeft');
  expect(fist.w).toBeLessThan(open.w, 'a fist is a smaller hand than an open one');
  // Only the hand it belongs to.
  expect(await pathOf(page, 'handRight')).not.toBe(await pathOf(page, 'handLeft'));

  // And it travels: the reach is set up, so the hand moves from the first frame.
  await page.evaluate(() => { window.__BOOP_E2E__.setLiveParam('handLX', -1); window.__BOOP_E2E__.setLiveParam('handLY', -1); });
  await expect.poll(async () => (await boxOf(page, 'handLeft')).y).toBeLessThan(open.y);
});

test('the Artwork panel offers the same hands, once', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBasicFace(page);
  await page.locator('[data-task="artwork"]').click();
  await page.locator('.artwork-create > summary').click();
  const card = page.locator('[data-add-feature="hands"]');
  await expect(card).toBeEnabled();
  await card.click();
  await expect(page.locator('#canvas #handRight')).toBeVisible();
  await expect(card).toHaveText('✓ Added');
  await expect(card).toBeDisabled();
});
