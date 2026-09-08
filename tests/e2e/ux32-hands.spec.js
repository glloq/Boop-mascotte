import { test, expect } from '@playwright/test';
import { openFreshEditor, openSetupSection, startBuiltFace } from './editor-helpers.js';

/**
 * Hands without an import (docs/HANDS_2D.md, docs/HAND_RIGGING.md).
 *
 * "Il va falloir donner une bonne base pour ajouter des mains (avec 4 doigts)
 * sans avoir besoin d'importer de svg." Hand Setup could rig a hand, but its
 * first step was "choose the artwork that draws this hand" — and there was no
 * way to make that artwork in the editor.
 *
 * A pair drawn now is **drawings**: five views of a relaxed hand a side, one of
 * them showing, chosen by pose and view rather than blended between. Nothing
 * deforms, so nothing wobbles on the way from one to the next.
 */
const PARTS = ['Palm', 'Ring', 'Middle', 'Index', 'Thumb', 'Cuff'];
const VIEWS = ['sideLeft', 'threeQuarterLeft', 'front', 'threeQuarterRight', 'sideRight'];
const drawingId = (side, view, pose = 'relaxed') => `hand${side}Draw-${pose}-${view}`;
/** Which drawing of a hand is on screen, and at what opacity. */
const lit = (page, side) => page.evaluate((hand) => [...document.querySelectorAll(`#canvas #hand${hand} > g`)]
  .filter((group) => Number(group.getAttribute('opacity') ?? 1) > 0.001)
  .map((group) => group.id), side);
const documentOf = (page) => page.evaluate(() => window.__BOOP_E2E__.document());
const pathOf = (page, id) => page.evaluate((elementId) => document.querySelector(`#canvas #${elementId}`)?.getAttribute('d'), id);
const boxOf = (page, id) => page.evaluate((elementId) => {
  const box = document.querySelector(`#canvas #${elementId}`)?.getBoundingClientRect();
  return box ? { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width) } : null;
}, id);

async function openHands(page) {
  await openFreshEditor(page, { e2e: true });
  // A built face rather than Basic Face: the template ships a pair of its own
  // now, and this is the journey of drawing one where there is none.
  await startBuiltFace(page);
  await page.locator('[data-task="face-setup"]').click();
  await openSetupSection(page, 'hands');
  await expect(page.locator('#hand-setup[data-hand-setup-ready="true"]')).toBeVisible();
}

test('@critical one press draws a pair of hands as five drawings each, and rigs them', async ({ page }) => {
  await openHands(page);
  await expect(page.locator('#hand-setup')).toHaveAttribute('data-hand-setup-count', '0');
  await page.getByRole('button', { name: 'Draw a pair of hands' }).click();

  await expect(page.locator('#hand-setup')).toHaveAttribute('data-hand-setup-count', '2');
  await expect(page.locator('#canvas #handLeft')).toBeVisible();
  await expect(page.locator('#canvas #handRight')).toBeVisible();
  // A hand is five drawings, each a glove of six paths; one of them is showing
  // and the other four are transparent.
  for (const side of ['Left', 'Right']) {
    await expect(page.locator(`#canvas #hand${side} > g`)).toHaveCount(5);
    for (const view of VIEWS) {
      await expect(page.locator(`#canvas #${drawingId(side, view)}`)).toHaveCount(1);
      await expect(page.locator(`#canvas #${drawingId(side, view)} > path`)).toHaveCount(6);
    }
    expect(await lit(page, side)).toEqual([drawingId(side, 'front')]);
    // ...and the five are five drawings, not one drawn five times.
    const paths = await page.evaluate((hand) => VIEWS.map((view) => document.querySelector(`#canvas #hand${hand}Draw-relaxed-${view}Palm`)?.getAttribute('d')), side)
      .catch(() => null);
    void paths;
  }
  const palms = await page.evaluate((views) => views.map((view) => document.querySelector(`#canvas #handLeftDraw-relaxed-${view}Palm`)?.getAttribute('d')), VIEWS);
  expect(new Set(palms).size).toBe(VIEWS.length);
  expect(palms.every((d) => /C/.test(d))).toBe(true);
  // The two hands are not the same drawing.
  expect(await pathOf(page, 'handRightDraw-relaxed-frontPalm')).not.toBe(palms[2]);
  // Drawn as gloves: white, with one black line.
  await expect(page.locator('#canvas #handLeftDraw-relaxed-frontPalm')).toHaveAttribute('fill', '#ffffff');

  const document_ = await documentOf(page);
  for (const side of ['left', 'right']) {
    const hand = document_.hands[side];
    expect(hand.parent).toBe('head');
    expect(hand.element).toBe(side === 'left' ? 'handLeft' : 'handRight');
    // A pose is a drawing, so the hand carries drawings and no pose parameters.
    expect(hand.poses).toEqual([]);
    expect(hand.sprites.drawings.map((drawing) => drawing.view)).toEqual(VIEWS);
    expect(hand.sprites.drawings.every((drawing) => drawing.pose === 'relaxed')).toBe(true);
    expect(hand.sprites.viewMode).toBe('manual');
    // Every drawing turns around the same point, so a swap cannot move the hand.
    expect(new Set(hand.sprites.drawings.map((drawing) => drawing.pivot.join(','))).size).toBe(1);
    const capital = side === 'left' ? 'L' : 'R';
    expect(document_.params[`hand${capital}Pose`]).toBeTruthy();
    expect([document_.params[`hand${capital}View`].min, document_.params[`hand${capital}View`].max, document_.params[`hand${capital}View`].default]).toEqual([0, 4, 2]);
    expect([document_.params[`hand${capital}Facing`].min, document_.params[`hand${capital}Facing`].max]).toEqual([-1, 1]);
    // ...and nothing of the turn that used to deform six parts.
    for (const part of PARTS) expect(document_.elements[`${hand.element}${part}`]).toBeUndefined();
    expect(document_.shapeKeys.some((key) => key.target?.startsWith(hand.element))).toBe(false);
    expect(document_.keyforms.some((keyform) => /-facing-/.test(keyform.id))).toBe(false);
  }
  expect(document_.animationClips.some((clip) => clip.id === 'hand-wave')).toBe(true);

  // A pair of hands hangs *below* the mascot, so adding them adds the room:
  // a face drawn to fill its artboard left them on the cheeks with nowhere to
  // reach. They point down with their thumbs towards the middle -- the drawings
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
  // The panel has nothing left to ask for.
  await expect(page.locator('[data-hand-card="left"]')).toHaveAttribute('data-hand-status', 'ready');

  // It is one undo step, artwork included.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#canvas #handLeft')).toHaveCount(0);
  await expect.poll(async () => (await documentOf(page)).hands).toBe(null);
});

test('@critical a view swaps the drawing without deforming it, and the hand still travels', async ({ page }) => {
  await openHands(page);
  await page.getByRole('button', { name: 'Draw a pair of hands' }).click();
  await expect(page.locator('#canvas #handLeft')).toBeVisible();
  // Out from behind the head for the whole test: this one is about drawings and reach.
  // A hand asked out travels there, so wait until it has arrived -- the paint
  // order flips as it clears the head -- before measuring anything.
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('handLShow', 1));
  await expect.poll(async () => (await page.evaluate(() => window.__BOOP_E2E__.effectiveParams())).handLShow).toBe(1);
  await expect.poll(() => page.evaluate(() => [...document.querySelector('#canvas svg svg').children].map((child) => child.id).filter((id) => ['head', 'handLeft'].includes(id)))).toEqual(['head', 'handLeft']);
  await page.waitForTimeout(400);
  const front = await pathOf(page, 'handLeftDraw-relaxed-frontPalm');
  const open = await boxOf(page, 'handLeft');

  // The view row turns the hand: another drawing comes up, and the one that
  // was showing goes down. Neither of them changes shape.
  await page.locator('#hand-setup [data-hand-drawing-view="left:sideRight"]').click();
  await expect.poll(() => lit(page, 'Left')).toEqual([drawingId('Left', 'sideRight')]);
  await expect.poll(async () => (await page.evaluate(() => window.__BOOP_E2E__.effectiveParams())).handLView).toBe(4);
  await expect(page.locator('#hand-setup [data-hand-drawing-view="left:sideRight"]')).toHaveClass(/chip-active/);
  expect(await pathOf(page, 'handLeftDraw-relaxed-frontPalm')).toBe(front, 'a drawing is never deformed');
  // A swap does not move the hand: the group is where it was, to the pixel,
  // because every drawing in a set shares one box and one pivot
  // (docs/HANDS_2D.md). One pixel of slack for the rounding, and no more --
  // the old turn moved a hand by tens of them.
  const held = await boxOf(page, 'handLeft');
  expect(Math.abs(held.x - open.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(held.y - open.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(held.w - open.w)).toBeLessThanOrEqual(1);
  // ...and what came up is a narrower hand than what went down, because it is
  // a drawing of one, not the same drawing squeezed.
  const edge = await boxOf(page, drawingId('Left', 'sideRight'));
  expect(edge.w).toBeLessThan((await boxOf(page, drawingId('Left', 'front'))).w, 'a hand seen edge-on is narrower than one seen front-on');

  await page.locator('#hand-setup [data-hand-drawing-view="left:front"]').click();
  await expect.poll(() => lit(page, 'Left')).toEqual([drawingId('Left', 'front')]);
  // Only the hand it belongs to: the other is still on its own drawing.
  expect(await lit(page, 'Right')).toEqual([drawingId('Right', 'front')]);

  // Turning the hand is not changing its drawing: a rotation of 15 degrees is
  // still the front view (docs/HANDS_2D.md, "Rotation is not view").
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('handLRotation', 0.1));
  await page.waitForTimeout(200);
  expect(await lit(page, 'Left')).toEqual([drawingId('Left', 'front')]);
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('handLRotation', 0));

  // Automatic: the view follows the orientation the pseudo-3D turn used to.
  await page.locator('#hand-setup [data-hand-field="autoView"][data-hand-side="left"]').check();
  await expect.poll(async () => (await documentOf(page)).hands.left.sprites.viewMode).toBe('auto');
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('handLFacing', -1));
  await expect.poll(() => lit(page, 'Left')).toEqual([drawingId('Left', 'sideLeft')]);
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('handLFacing', 0));
  await expect.poll(() => lit(page, 'Left')).toEqual([drawingId('Left', 'front')]);

  // And it travels: the reach is set up, so the hand moves from the first frame.
  await page.evaluate(() => { window.__BOOP_E2E__.setLiveParam('handLX', -1); window.__BOOP_E2E__.setLiveParam('handLY', -1); });
  await expect.poll(async () => (await boxOf(page, 'handLeft')).y).toBeLessThan(open.y);
});

test('@critical a drawn pair rests behind the head and comes out for a pose, the Wave or a page\'s call', async ({ page }) => {
  await openHands(page);
  await page.getByRole('button', { name: 'Draw a pair of hands' }).click();
  await expect(page.locator('#hand-setup')).toHaveAttribute('data-hand-setup-count', '2');
  // Painted behind the face: first among the artboard's own pieces, and out of sight behind the head.
  const painted = () => page.evaluate(() => [...document.querySelector('#canvas svg svg').children].map((child) => child.id).filter((id) => ['head', 'handLeft', 'handRight'].includes(id)));
  await expect.poll(painted).toEqual(['handLeft', 'handRight', 'head']);
  const document_ = await documentOf(page);
  expect(document_.params.handLShow.default).toBe(0);
  expect(document_.expressions.find((item) => item.id === 'hands-out').controls).toEqual({ handLShow: 1, handRShow: 1 });
  expect(document_.animationClips.find((clip) => clip.id === 'hand-wave').tracks.handLShow.some((key) => key.value === 1)).toBe(true);
  await expect(page.locator('#hand-setup [data-hand-field="hidden"][data-hand-side="left"]')).toBeChecked();
  // Choosing a drawing in the panel brings that hand out to look at; the other stays put.
  // It comes out by travelling: right after the click the hand is still on its
  // way -- behind the head, in the band behind -- and only then in front of it.
  const before = await boxOf(page, 'handLeft');
  // Recorded frame by frame rather than read once after the click: the travel
  // is under half a second, and a single round trip that happens to land after
  // it is a test that measures Playwright's latency instead of the mascot's.
  await page.evaluate(() => {
    window.__handTravel = [];
    const tick = () => {
      window.__handTravel.push({
        order: [...document.querySelector('#canvas svg svg').children].map((child) => child.id).filter((id) => ['head', 'handLeft', 'handRight'].includes(id)).join('|'),
        y: Math.round(document.querySelector('#canvas #handLeft').getBoundingClientRect().y)
      });
      window.__handTravelStop = requestAnimationFrame(tick);
    };
    tick();
  });
  await page.locator('#hand-setup [data-hand-drawing-pose="left:relaxed"]').click();
  await expect.poll(painted).toEqual(['handRight', 'head', 'handLeft']);
  await page.waitForTimeout(400);
  const travel = await page.evaluate(() => { cancelAnimationFrame(window.__handTravelStop); return window.__handTravel; });
  const out = await boxOf(page, 'handLeft');
  expect(await page.evaluate(() => window.__BOOP_E2E__.effectiveParams().handLShow)).toBe(1);
  // Asked out, but not out yet: the hand is painted behind the head for a while
  // after the ask, and travels between where it was and where it lands.
  const behind = travel.filter((frame) => frame.order === 'handLeft|handRight|head');
  expect(behind.length).toBeGreaterThan(1, 'asked out, but not out yet: it moves there');
  expect(travel.at(-1).order).toBe('handRight|head|handLeft');
  for (const frame of travel) {
    expect(frame.y).toBeGreaterThanOrEqual(before.y - 1);
    expect(frame.y).toBeLessThanOrEqual(out.y + 1);
  }
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('handLShow', 0));
  await expect.poll(painted).toEqual(['handLeft', 'handRight', 'head']);
  const tucked = await boxOf(page, 'handLeft');
  expect(tucked.y).toBeLessThan(out.y, 'hidden higher up, behind the head');
  // The export carries the same: a page calls mascot.showHands(), a reaction picks "Hands out".
  const rig = JSON.parse(await page.evaluate(() => window.__BOOP_E2E__.exportArtifacts().find((item) => item.name === 'rig.json').content));
  expect(rig.expressions.some((item) => item.id === 'hands-out')).toBe(true);
  expect(rig.keyforms.some((item) => item.id === 'handLeft-show-depth')).toBe(true);
  // Untick: the hand rests in the open, as before the hiding existed.
  await page.locator('#hand-setup [data-hand-field="hidden"][data-hand-side="left"]').uncheck();
  await expect.poll(async () => (await documentOf(page)).params.handLShow).toBeUndefined();
  await expect.poll(painted).toEqual(['handRight', 'head', 'handLeft']);
});

test('the Artwork panel offers the same hands, once', async ({ page }) => {
  await openFreshEditor(page, { e2e: true });
  await startBuiltFace(page);
  await page.locator('[data-task="artwork"]').click();
  await page.locator('.artwork-create > summary').click();
  const card = page.locator('[data-add-feature="hands"]');
  await expect(card).toBeEnabled();
  await card.click();
  await expect(page.locator('#canvas #handRight')).toBeVisible();
  await expect(card).toHaveText('✓ Added');
  await expect(card).toBeDisabled();
});

test('artwork of your own gets a set of drawings, each a pose the hand swaps to', async ({ page }) => {
  await openHands(page);
  // The template ships no hand artwork, so a part stands in for one.
  await page.selectOption('#hand-setup [data-hand-card="left"] select[data-hand-field="artwork"]', 'pupilRight');
  const advanced = page.locator('#hand-setup [data-keep-open="hand:left:advanced"]');
  await advanced.locator('summary').click();
  await page.locator('#hand-setup [data-hand-action="set"]').click();
  // Every gesture of the built-in set is a drawing, hidden until its pose rises.
  await expect(page.locator('#canvas #handLeftSetFist')).toHaveCount(1);
  await expect(page.locator('#canvas #handLeftSetThumbsUpSide')).toHaveCount(1);
  const document_ = await documentOf(page);
  expect(document_.hands.left.poses.find((pose) => pose.id === 'fist').variant).toBe('handLeftSetFist');
  await expect.poll(() => page.locator('#canvas #handLeftSetFist').getAttribute('opacity')).toBe('0');
  // Striking the pose swaps the drawing in and the artwork out.
  await page.locator('#hand-setup [data-hand-pose-chip="left:fist"]').click();
  await expect.poll(() => page.locator('#canvas #handLeftSetFist').getAttribute('opacity')).toBe('1');
  await expect.poll(() => page.locator('#canvas #pupilRight').getAttribute('opacity')).toBe('0');
  // One undo takes the whole set back.
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.locator('#canvas #handLeftSetFist')).toHaveCount(0);
});
