import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandAssetLibrary, EMPTY_HAND_LIBRARY } from '../../../runtime/hand-assets.js';
import { HAND_SWAP_SECONDS, createHandSprite, createHandSwap, isHandOffscreen } from '../../../runtime/hand-sprite.js';

/**
 * A hand, drawn (docs/HANDS_2D.md, PHASES 10, 14-15). The sprite selects a
 * drawing and places it; it never deforms one, and the only thing it ever
 * blends between two drawings is opacity.
 */
const library = () => createHandAssetLibrary(
  ['sideLeft', 'threeQuarterLeft', 'front', 'threeQuarterRight', 'sideRight']
    .map((view) => ({ pose: 'relaxed', view, element: `relaxed-${view}` }))
    .concat([{ pose: 'point', view: 'front', element: 'point-front' }]),
  { pivot: [100, 100] }
);

test('a sprite reports the drawing and the transform, and never a deformation', () => {
  const sprite = createHandSprite({ library: library(), side: 'left' });
  const drawn = sprite.resolve({ pose: 'relaxed', view: 'front', x: 12, y: -4, rotation: 15, scale: 1.25 });
  assert.equal(drawn.asset.element, 'relaxed-front');
  assert.deepEqual(drawn.transform, { x: 12, y: -4, rotation: 15, scale: 1.25, flipX: false, pivot: [100, 100] });
  for (const forbidden of ['skew', 'skewX', 'perspective', 'squash', 'morph', 'shapeWeights']) {
    assert.equal(forbidden in drawn.transform, false, forbidden);
    assert.equal(forbidden in drawn, false, forbidden);
  }
});

test('a hand\'s rotation does not change its view', () => {
  const sprite = createHandSprite({ library: library(), side: 'left', view: { mode: 'auto' } });
  const still = sprite.resolve({ pose: 'relaxed', rotation: 0 }, { orientation: 0 });
  const turned = sprite.resolve({ pose: 'relaxed', rotation: 60 }, { orientation: 0 });
  assert.equal(still.view, 'front');
  assert.equal(turned.view, 'front');
  assert.equal(turned.asset.element, 'relaxed-front');
  assert.equal(turned.transform.rotation, 60);
});

test('a turn past the preferred range is reported, not clamped', () => {
  const sprite = createHandSprite({ library: library(), side: 'left' });
  const drawn = sprite.resolve({ pose: 'relaxed', view: 'sideLeft', rotation: 120 });
  assert.equal(drawn.transform.rotation, 120);
  assert.equal(drawn.rotationAdvice.within, false);
  assert.equal(drawn.rotationAdvice.nearest, 70);
  assert.equal(sprite.resolve({ pose: 'relaxed', view: 'front', rotation: 120 }).rotationAdvice.within, true);
});

test('the drawing\'s own mirroring and the hand\'s own flip compose', () => {
  const partial = createHandAssetLibrary([{ pose: 'relaxed', view: 'threeQuarterLeft', element: 'l' }]);
  const sprite = createHandSprite({ library: partial, side: 'left' });
  assert.equal(sprite.resolve({ pose: 'relaxed', view: 'threeQuarterRight' }).flipX, true);
  sprite.reset({ pose: 'relaxed', view: 'threeQuarterRight', flipX: true });
  assert.equal(sprite.resolve({ pose: 'relaxed', view: 'threeQuarterRight', flipX: true }).flipX, false);
});

test('an invisible hand draws nothing but keeps its place', () => {
  const sprite = createHandSprite({ library: library(), side: 'left' });
  const drawn = sprite.resolve({ pose: 'relaxed', view: 'front', x: 30, visible: false });
  assert.equal(drawn.opacity, 0);
  assert.equal(drawn.visible, false);
  assert.equal(drawn.transform.x, 30);
});

test('a sprite change is a swap, and a short one', () => {
  const sprite = createHandSprite({ library: library(), side: 'left' });
  sprite.reset({ pose: 'relaxed', view: 'front' });
  const half = HAND_SWAP_SECONDS / 2;
  const start = sprite.resolve({ pose: 'relaxed', view: 'sideRight' }, { delta: 0 });
  assert.equal(start.asset.element, 'relaxed-sideRight');
  assert.equal(start.opacity, 0);
  assert.equal(start.leavingOpacity, 1);
  const middle = sprite.resolve({ pose: 'relaxed', view: 'sideRight' }, { delta: half });
  assert.equal(Math.round(middle.opacity * 100), 50);
  assert.equal(Math.round(middle.leavingOpacity * 100), 50);
  const done = sprite.resolve({ pose: 'relaxed', view: 'sideRight' }, { delta: half });
  assert.equal(done.opacity, 1);
  assert.equal(done.leaving, null);
  assert.equal(done.settled, true);
});

test('the two opacities of a cross-fade always sum to one', () => {
  const swap = createHandSwap({ asset: 'a' });
  let sum = 0;
  for (let i = 0; i < 6; i += 1) {
    const step = swap.step('b', HAND_SWAP_SECONDS / 5);
    sum = step.opacity + step.leavingOpacity;
    assert.equal(Math.round(sum * 1000), 1000);
  }
});

test('a cut takes the new drawing outright', () => {
  const swap = createHandSwap({ mode: 'cut', asset: 'a' });
  const step = swap.step('b', 0);
  assert.deepEqual([step.showing, step.opacity, step.leaving], ['b', 1, null]);
});

test('a swap held until the hand is hidden waits, then takes the latest drawing', () => {
  const swap = createHandSwap({ mode: 'hidden', asset: 'a' });
  assert.equal(swap.step('b', 0.1).showing, 'a');
  assert.equal(swap.step('c', 0.1).showing, 'a');
  assert.equal(swap.step('c', 0.1, { hidden: true }).showing, 'c');
  assert.equal(swap.step('c', 0.1).settled, true);
});

test('a hand that changes its mind back before it hides never swaps at all', () => {
  const swap = createHandSwap({ mode: 'hidden', asset: 'a' });
  swap.step('b', 0.1);
  assert.equal(swap.step('a', 0.1).showing, 'a');
  assert.equal(swap.step('a', 0.1, { hidden: true }).showing, 'a');
});

test('a hand off the artboard is off screen, and one with no artboard never is', () => {
  const board = { x: 0, y: 0, width: 240, height: 240 };
  assert.equal(isHandOffscreen({ x: 120, y: 120 }, board, 30), false);
  assert.equal(isHandOffscreen({ x: -40, y: 120 }, board, 30), true);
  assert.equal(isHandOffscreen({ x: -20, y: 120 }, board, 30), false);
  assert.equal(isHandOffscreen({ x: 120, y: 300 }, board, 30), true);
  assert.equal(isHandOffscreen({ x: -400, y: 0 }, null, 30), false);
});

test('an empty set draws nothing and the sprite still reports a place to put it', () => {
  const sprite = createHandSprite({ library: EMPTY_HAND_LIBRARY, side: 'left' });
  const drawn = sprite.resolve({ pose: 'relaxed', view: 'front', x: 5 });
  assert.equal(drawn.asset, null);
  assert.equal(drawn.missing, true);
  assert.equal(drawn.opacity, 0);
  assert.equal(drawn.transform.x, 5);
});

test('a missing sprite is reported once, with what was asked for', () => {
  const seen = [];
  const sprite = createHandSprite({ library: library(), side: 'left', warn: (report) => seen.push(report) });
  for (let i = 0; i < 4; i += 1) sprite.resolve({ pose: 'fist', view: 'sideRight' }, { delta: 0.016 });
  assert.equal(seen.length, 1);
  assert.deepEqual([seen[0].wanted.pose, seen[0].wanted.view], ['fist', 'sideRight']);
});

test('two sprites never see each other', () => {
  const set = library();
  const left = createHandSprite({ library: set, side: 'left', view: { mode: 'auto' } });
  const right = createHandSprite({ library: set, side: 'right', view: { mode: 'manual' } });
  const l = left.resolve({ pose: 'relaxed', x: -20 }, { orientation: -1, delta: 1 });
  const r = right.resolve({ pose: 'point', view: 'front', x: 20 }, { orientation: -1, delta: 1 });
  assert.equal(l.view, 'sideLeft');
  assert.equal(r.view, 'front');
  assert.equal(r.asset.element, 'point-front');
  assert.equal(left.resolve({ pose: 'relaxed', x: -20 }, { orientation: -1, delta: 1 }).view, 'sideLeft');
});
