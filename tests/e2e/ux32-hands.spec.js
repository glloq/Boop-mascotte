import { test, expect } from '@playwright/test';
import { openFreshEditor, openSetupSection, startBasicFace } from './editor-helpers.js';

/**
 * Hands without an import (docs/HAND_RIGGING.md, docs/HAND_REPRESENTATIONS_STUDY.md).
 *
 * "Il va falloir donner une bonne base pour ajouter des mains (avec 4 doigts)
 * sans avoir besoin d'importer de svg." Hand Setup could rig a hand, but its
 * first step was "choose the artwork that draws this hand" — and there was no
 * way to make that artwork in the editor. The hand is a group of six parts —
 * a palm, four digits, a cuff — drawn as a cartoon glove, and a pose is a
 * parameter driving one key on every part it moves.
 */
const PARTS = ['Palm', 'Ring', 'Middle', 'Index', 'Thumb', 'Cuff'];
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

test('@critical one press draws a pair of four-fingered glove hands and rigs them', async ({ page }) => {
  await openHands(page);
  await expect(page.locator('#hand-setup')).toHaveAttribute('data-hand-setup-count', '0');
  await page.getByRole('button', { name: 'Draw a pair of hands' }).click();

  await expect(page.locator('#hand-setup')).toHaveAttribute('data-hand-setup-count', '2');
  await expect(page.locator('#canvas #handLeft')).toBeVisible();
  await expect(page.locator('#canvas #handRight')).toBeVisible();
  // A hand is a group of six parts, each a path of its own; the other hand is
  // its mirror image, part for part.
  for (const side of ['Left', 'Right']) {
    await expect(page.locator(`#canvas #hand${side} > path`)).toHaveCount(6);
    for (const part of PARTS) await expect(page.locator(`#canvas #hand${side}${part}`)).toHaveCount(1);
  }
  const left = await pathOf(page, 'handLeftIndex'), right = await pathOf(page, 'handRightIndex');
  expect(left).toMatch(/C/);
  expect(right).not.toBe(left);
  // Drawn as gloves: white, with one black line.
  await expect(page.locator('#canvas #handLeftPalm')).toHaveAttribute('fill', '#ffffff');

  const document_ = await documentOf(page);
  for (const side of ['left', 'right']) {
    const hand = document_.hands[side];
    expect(hand.parent).toBe('faceRoot');
    expect(hand.element).toBe(side === 'left' ? 'handLeft' : 'handRight');
    expect(hand.poses.map((pose) => pose.id)).toEqual(['fist', 'point', 'peace', 'thumbsUp', 'spread', 'relax', 'ok', 'pinch', 'stop']);
    // Every pose is ready: its parameter drives a key on the parts it moves,
    // so pressing one does something. A pose that moves nothing is the state
    // the panel used to leave an author in.
    for (const pose of hand.poses) {
      expect(pose.shapeKey).toBeNull();
      expect(document_.shapeKeys.some((key) => key.driver?.parameter === pose.parameter && key.target.startsWith(hand.element))).toBe(true);
    }
    for (const part of PARTS) expect(document_.elements[`${hand.element}${part}`].restPath).toBeTruthy();
  }
  expect(document_.animationClips.some((clip) => clip.id === 'hand-wave')).toBe(true);

  // A pair of hands hangs *below* the mascot, so adding them adds the room:
  // a face drawn to fill its artboard left them on the cheeks with nowhere to
  // reach. They point down with their thumbs towards the middle -- the parts
  // are drawn fingers-up, which is the one orientation a hanging hand never
  // has. The artboard grows by exactly the room the pair needs, measured from
  // the body (VNX-20), instead of to a blind 4:3 that gave 324.
  const height = Number(/viewBox="0 0 240 (\d+)"/.exec(document_.svgMarkup)?.[1]);
  expect(height).toBeGreaterThan(240);
  expect(height).not.toBe(324);
  expect(height).toBeLessThan(340);
  expect(document_.elements.handLeft.baseTransform.rotation).toBe(200);
  expect(document_.elements.handRight.baseTransform.rotation).toBe(160);
  for (const side of ['left', 'right']) {
    const hand = document_.hands[side];
    expect(hand.anchor.y).toBeGreaterThan(240, 'below the head, not across it');
    // A full turn, and room worth dragging through.
    expect(hand.reach.rotation).toBe(180);
    expect(hand.reach.x).toBeGreaterThan(30);
  }
  // Closing every finger at once is a movement of its own: the four digit
  // curls are the individual control, this is the group one. Turning the hand
  // over is no longer a mirror key: a hand made of parts turns through its
  // facing instead.
  for (const name of ['handLGrip', 'handRGrip', 'handLIndex', 'handRThumb']) expect(document_.params[name]).toBeTruthy();
  expect(document_.params.handLFlip).toBeUndefined();
  for (const id of ['handLeft-grip-index', 'handLeft-curl-index-index', 'handLeft-fist-thumb']) expect(document_.shapeKeys.some((key) => key.id === id)).toBe(true);
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
  const rest = await pathOf(page, 'handLeftIndex');
  const cuff = await pathOf(page, 'handLeftCuff');

  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('handLFist', 1));
  await expect.poll(() => pathOf(page, 'handLeftIndex')).not.toBe(rest);
  expect(await pathOf(page, 'handLeftCuff')).toBe(cuff, 'a fist bends the digits and leaves the cuff alone');
  const fist = await boxOf(page, 'handLeft');
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('handLFist', 0));
  await expect.poll(() => pathOf(page, 'handLeftIndex')).toBe(rest);
  const open = await boxOf(page, 'handLeft');
  expect(fist.w).toBeLessThan(open.w, 'a fist is a smaller hand than an open one');
  // Only the hand it belongs to.
  expect(await pathOf(page, 'handRightIndex')).not.toBe(await pathOf(page, 'handLeftIndex'));

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
