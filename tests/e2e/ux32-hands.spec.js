import { test, expect } from '@playwright/test';
import { openFreshEditor, openSetupSection, startBuiltFace } from './editor-helpers.js';

/**
 * Hands without an import (docs/HAND_STYLES.md, docs/HAND_RIGGING.md).
 *
 * "Il va falloir donner une bonne base pour ajouter des mains (avec 4 doigts)
 * sans avoir besoin d'importer de svg." Hand Setup could rig a hand, but its
 * first step was "choose the artwork that draws this hand" — and there was no
 * way to make that artwork in the editor.
 *
 * A pair drawn now is **static drawings**: six whole pictures a side, one of
 * them showing, chosen rather than blended between. Nothing inside a drawing
 * ever moves, so nothing wobbles on the way from one to the next, and no angle
 * chooses anything.
 */
const PARTS = ['cuff', 'index', 'middle', 'ring', 'thumb', 'palm'];
/** The drawings a pair is given, in the order the picker lists them. */
const STYLES = ['relaxed', 'open', 'fist', 'point', 'thumbsUp', 'peace'];
/** The drawing a hand rests in. */
const REST = 'relaxed';
const styleId = (side, style = REST) => `hand${side}Style-${style}`;
/** Which drawing of a hand is on screen. */
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

test('@critical one press draws a pair of hands as six drawings each, and rigs them', async ({ page }) => {
  await openHands(page);
  await expect(page.locator('#hand-setup')).toHaveAttribute('data-hand-setup-count', '0');
  await page.getByRole('button', { name: 'Draw a pair of hands' }).click();

  await expect(page.locator('#hand-setup')).toHaveAttribute('data-hand-setup-count', '2');
  await expect(page.locator('#canvas #handLeft')).toBeVisible();
  await expect(page.locator('#canvas #handRight')).toBeVisible();
  // A hand is six drawings, each six paths; one is showing and the rest are not.
  for (const side of ['Left', 'Right']) {
    await expect(page.locator(`#canvas #hand${side} > g`)).toHaveCount(STYLES.length);
    for (const style of STYLES) {
      await expect(page.locator(`#canvas #${styleId(side, style)}`)).toHaveCount(1);
      await expect(page.locator(`#canvas #${styleId(side, style)} > path`)).toHaveCount(6);
    }
    expect(await lit(page, side)).toEqual([styleId(side, REST)]);
  }
  // The six are six drawings, not one drawn six times: the same palm and the
  // same cuff with different fingers on it, which is what a hand is.
  const pictures = await page.evaluate(({ styles, parts }) => styles.map((style) =>
    parts.map((part) => document.querySelector(`#canvas #handLeftStyle-${style}-${part}`)?.getAttribute('d')).join('|')), { styles: STYLES, parts: PARTS });
  expect(new Set(pictures).size).toBe(STYLES.length);
  expect(pictures.every((d) => /C/.test(d))).toBe(true);
  // The right hand is the left one mirrored, which is why the set is six files.
  expect(await pathOf(page, `handRightStyle-${REST}-palm`)).not.toBe(await pathOf(page, `handLeftStyle-${REST}-palm`));
  // Drawn as gloves: white, with one black line.
  await expect(page.locator(`#canvas #handLeftStyle-${REST}-palm`)).toHaveAttribute('fill', '#ffffff');

  const document_ = await documentOf(page);
  for (const side of ['left', 'right']) {
    const hand = document_.hands[side];
    expect(hand.parent).toBe('head');
    expect(hand.element).toBe(side === 'left' ? 'handLeft' : 'handRight');
    // A gesture is a drawing, so the hand carries a library and no poses.
    expect(hand.poses).toEqual([]);
    expect(hand.styles.library.map((entry) => entry.id)).toEqual(STYLES);
    const capital = side === 'left' ? 'L' : 'R';
    expect(document_.params[`hand${capital}Style`].options).toEqual(STYLES);
    expect(document_.params[`hand${capital}Style`].max).toBe(STYLES.length - 1);
    // Every drawing turns around the same point, so a swap cannot move the hand.
    expect(new Set(hand.styles.library.map((entry) => document_.elements[entry.element].baseTransform.pivotX)).size).toBe(1);
    // Nothing reads an angle any more, and nothing bends a finger.
    for (const gone of ['View', 'Facing', 'Anim', 'Grip', 'Flip', 'Index', 'Thumb']) {
      expect(document_.params[`hand${capital}${gone}`], `hand${capital}${gone}`).toBeUndefined();
    }
    expect(document_.keyforms.some((keyform) => /-facing-/.test(keyform.id))).toBe(false);
    // Not one shape key anywhere on a hand: a drawing is never deformed.
    expect(document_.shapeKeys.some((key) => /^hand(Left|Right)/.test(key.target || ''))).toBe(false);
  }
  expect(document_.animationClips.some((clip) => clip.id === 'hand-wave')).toBe(true);

  // A pair of hands hangs *below* the mascot, so adding them adds the room:
  // a face drawn to fill its artboard left them on the cheeks with nowhere to
  // reach. They point down with their thumbs towards the middle -- the drawings
  // are made fingers-up, which is the one orientation a hanging hand never
  // has. The artboard grows by exactly the room the pair needs, measured from
  // the body (VNX-20), instead of to a blind 4:3 that gave 324.
  const height = Number(/viewBox="0 0 240 (\d+)"/.exec(document_.svgMarkup)?.[1]);
  expect(height).toBeGreaterThan(240);
  expect(height).not.toBe(324);
  expect(height).toBeLessThan(345);
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

test('@critical a drawing is swapped, never deformed, and the hand still travels', async ({ page }) => {
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
  const rest = await pathOf(page, `handLeftStyle-${REST}-palm`);
  const open = await boxOf(page, 'handLeft');

  // The row of drawings swaps the hand: another comes up, and the one that was
  // showing goes down. Neither of them changes shape.
  await page.locator('#hand-setup [data-hand-style-chip="left:fist"]').click();
  await expect.poll(() => lit(page, 'Left')).toEqual([styleId('Left', 'fist')]);
  await expect.poll(async () => (await page.evaluate(() => window.__BOOP_E2E__.effectiveParams())).handLStyle).toBe(2);
  await expect(page.locator('#hand-setup [data-hand-style-chip="left:fist"]')).toHaveClass(/chip-active/);
  expect(await pathOf(page, `handLeftStyle-${REST}-palm`)).toBe(rest, 'a drawing is never deformed into another');
  // A swap does not move the hand: the group is where it was, to the pixel,
  // because every drawing shares one box and one pivot (docs/HAND_STYLES.md).
  // One pixel of slack for the rounding, and no more -- the old turn moved a
  // hand by tens of them.
  const held = await boxOf(page, 'handLeft');
  expect(Math.abs(held.x - open.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(held.y - open.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(held.w - open.w)).toBeLessThanOrEqual(1);
  // ...and the open hand is wider than the fist, because it is a drawing of one
  // and not the same drawing stretched.
  await page.locator('#hand-setup [data-hand-style-chip="left:open"]').click();
  await expect.poll(() => lit(page, 'Left')).toEqual([styleId('Left', 'open')]);
  expect((await boxOf(page, styleId('Left', 'open'))).w)
    .toBeGreaterThan((await boxOf(page, styleId('Left', 'fist'))).w, 'an open hand is wider than a fist');
  // Only the hand it belongs to: the other is still on its own drawing.
  expect(await lit(page, 'Right')).toEqual([styleId('Right', REST)]);

  // Turning the hand is not changing its drawing: there is no angle left that
  // could (docs/HAND_STYLES.md, "Rotation").
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('handLRotation', 0.4));
  await page.waitForTimeout(200);
  expect(await lit(page, 'Left')).toEqual([styleId('Left', 'open')]);
  const turned = await pathOf(page, 'handLeftStyle-open-index');
  await page.evaluate(() => window.__BOOP_E2E__.setLiveParam('handLRotation', 0));
  expect(await pathOf(page, 'handLeftStyle-open-index')).toBe(turned, 'turning a hand never redraws it');

  // And it travels: the reach is set up, so the hand moves from the first frame.
  await page.evaluate(() => { window.__BOOP_E2E__.setLiveParam('handLX', -1); window.__BOOP_E2E__.setLiveParam('handLY', -1); });
  await expect.poll(async () => (await boxOf(page, 'handLeft')).y).toBeLessThan(open.y);
});

test('@critical the hand to show is picked beside the face', async ({ page }) => {
  await openHands(page);
  await page.getByRole('button', { name: 'Draw a pair of hands' }).click();
  await expect(page.locator('#canvas #handLeft')).toBeVisible();
  // Behind the head there is nothing to pick between: the slider that brings
  // the hand out is the only control drawn, exactly as it was.
  await expect(page.locator('[data-hand-pick]:not([hidden])')).toHaveCount(0);
  await expect(page.locator('.puppet-handle[data-handle-slot="show"]:not([hidden])')).toHaveCount(2);
  await page.evaluate(() => { window.__BOOP_E2E__.setLiveParam('handLShow', 1); window.__BOOP_E2E__.setLiveParam('handRShow', 1); });
  // One column a side, one cell per drawing -- no row of views under the hand.
  await expect.poll(() => page.locator('[data-hand-pick]:not([hidden])').count()).toBe(2 * STYLES.length);

  // Every drawing the library holds is offered, and the one showing is marked.
  for (const style of STYLES) {
    await expect(page.locator(`[data-hand-pick="hand-left-pick-${style}"]`)).toHaveCount(1);
  }
  await expect(page.locator(`[data-hand-pick="hand-left-pick-${REST}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-hand-pick="hand-left-pick-fist"]')).toHaveAttribute('aria-pressed', 'false');
  // ...and the turn is still a control, round the hand's own ring.
  await expect(page.locator('.puppet-handle[data-handle-slot="ring"]:not([hidden])')).not.toHaveCount(0);

  // A press swaps the hand, and only that hand.
  await page.locator('[data-hand-pick="hand-left-pick-fist"]').click();
  await expect.poll(() => lit(page, 'Left')).toEqual([styleId('Left', 'fist')]);
  await expect(page.locator('[data-hand-pick="hand-left-pick-fist"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await lit(page, 'Right')).toEqual([styleId('Right', REST)]);
});

test('@critical the two hands are chosen, placed and turned independently', async ({ page }) => {
  await openHands(page);
  await page.getByRole('button', { name: 'Draw a pair of hands' }).click();
  await expect(page.locator('#canvas #handLeft')).toBeVisible();
  await page.evaluate(() => { window.__BOOP_E2E__.setLiveParam('handLShow', 1); window.__BOOP_E2E__.setLiveParam('handRShow', 1); });
  const choose = (side, style) => page.evaluate(([hand, index]) => window.__BOOP_E2E__.setLiveParam(`hand${hand}Style`, index),
    [side, STYLES.indexOf(style)]);

  await choose('L', 'open');
  await choose('R', 'point');
  await expect.poll(() => lit(page, 'Left')).toEqual([styleId('Left', 'open')]);
  expect(await lit(page, 'Right')).toEqual([styleId('Right', 'point')]);

  await choose('L', 'peace');
  await choose('R', 'fist');
  await expect.poll(() => lit(page, 'Left')).toEqual([styleId('Left', 'peace')]);
  expect(await lit(page, 'Right')).toEqual([styleId('Right', 'fist')]);

  // And their movements never meet either.
  const before = await boxOf(page, 'handRight');
  await page.evaluate(() => { window.__BOOP_E2E__.setLiveParam('handLY', -1); window.__BOOP_E2E__.setLiveParam('handLRotation', 1); });
  await page.waitForTimeout(200);
  const after = await boxOf(page, 'handRight');
  expect(after).toEqual(before, 'moving one hand does not move the other');
});

test('@critical a drawn pair rests behind the head and comes out for a drawing, the Wave or a page\'s call', async ({ page }) => {
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
  await page.locator(`#hand-setup [data-hand-style-chip="left:${REST}"]`).click();
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

test('artwork that cannot hold a drawing is told so, rather than half-converted', async ({ page }) => {
  await openHands(page);
  // A drawing rides *inside* the hand's group, which is what makes a swap one
  // visibility (docs/HAND_STYLES.md). The built face is single shapes, so a
  // hand set up on one of them is told the shorter road rather than left with
  // half a conversion.
  await page.selectOption('#hand-setup [data-hand-card="left"] select[data-hand-field="artwork"]', 'pupilRight');
  const advanced = page.locator('#hand-setup [data-keep-open="hand:left:advanced"]');
  await advanced.locator('summary').click();
  await page.locator('#hand-setup [data-hand-action="use-styles"]').click();
  await expect(page.locator('[role="status"]').first()).toContainText('single shape');
  for (const style of STYLES) await expect(page.locator(`#canvas #${styleId('Left', style)}`)).toHaveCount(0);
  await expect.poll(async () => (await documentOf(page)).hands.left.styles).toBeUndefined();
  // And the road it points at works: one press draws a pair with the library.
  await page.locator('#hand-setup [data-hand-action="remove"][data-hand-side="left"]').click();
  await page.getByRole('button', { name: 'Draw a pair of hands' }).click();
  for (const style of STYLES) await expect(page.locator(`#canvas #${styleId('Left', style)}`)).toHaveCount(1);
});
