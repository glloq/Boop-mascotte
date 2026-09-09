import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HAND_SWAP, HAND_SWAP_MODES, createHandSwap, handSpriteTransform, handSwapMode
} from '../../../runtime/hand-sprite.js';

test('a swap mode is one of two, and anything else is a cut', () => {
  // There is no cross-fade any more: blending two drawings is the thing this
  // system exists to not do (PHASE 30).
  assert.deepEqual([...HAND_SWAP_MODES], ['cut', 'hidden']);
  assert.equal(DEFAULT_HAND_SWAP, 'cut');
  assert.equal(handSwapMode('hidden'), 'hidden');
  assert.equal(handSwapMode('crossfade'), 'cut', 'what an older file asked for reads as a cut');
  assert.equal(handSwapMode(undefined), 'cut');
});

test('a cut is the new drawing on the frame it is asked for', () => {
  const swap = createHandSwap({ mode: 'cut', style: 'open' });
  const step = swap.step('fist');
  assert.equal(step.showing, 'fist');
  assert.equal(step.settled, true);
  assert.equal(step.visible, true);
});

test('a hidden swap waits until nobody can see it', () => {
  const swap = createHandSwap({ mode: 'hidden', style: 'open' });
  const held = swap.step('fist', { hidden: false });
  assert.equal(held.showing, 'open', 'the change waits');
  assert.equal(held.settled, false);
  const taken = swap.step('fist', { hidden: true });
  assert.equal(taken.showing, 'fist');
  assert.equal(taken.settled, true);
});

test('a hand that changes its mind back never swaps', () => {
  const swap = createHandSwap({ mode: 'hidden', style: 'open' });
  swap.step('fist', { hidden: false });
  const back = swap.step('open', { hidden: false });
  assert.equal(back.showing, 'open');
  assert.equal(back.settled, true, 'the waiting change is stale, not pending');
  assert.equal(swap.step('open', { hidden: true }).showing, 'open');
});

test('a reset shows a drawing outright: a seek, not an animation', () => {
  const swap = createHandSwap({ mode: 'hidden', style: 'open' });
  swap.step('fist', { hidden: false });
  assert.equal(swap.settled, false);
  swap.reset('peace');
  assert.equal(swap.showing, 'peace');
  assert.equal(swap.settled, true);
});

/* ── One hand, one transform (PHASE 20) ────────────────────────────────────── */

test('a hand on screen is an asset and a transform, and nothing else', () => {
  const state = { style: 'open', x: 120, y: 180, rotation: 12, scale: 1.5, visible: true };
  assert.deepEqual(handSpriteTransform(state, 'left'), {
    style: 'open', asset: 'open', visible: true, x: 120, y: 180, rotation: 12, scaleX: 1.5, scaleY: 1.5
  });
  // The right hand is the same file, mirrored (PHASE 11).
  const right = handSpriteTransform(state, 'right');
  assert.equal(right.asset, 'open');
  assert.equal(right.scaleX, -1.5);
  assert.equal(right.scaleY, 1.5);
});

test('a manual flip and the mirror for the other hand cancel', () => {
  const state = { style: 'point', scale: 1, flipX: true };
  assert.equal(handSpriteTransform(state, 'left').scaleX, -1);
  assert.equal(handSpriteTransform(state, 'right').scaleX, 1, 'flipped twice is not flipped');
});

test('an unknown style still draws something, and visibility is honoured', () => {
  assert.equal(handSpriteTransform({ style: 'threeQuarterBack' }, 'left').asset, 'relaxed');
  assert.equal(handSpriteTransform({ style: 'open', visible: false }, 'left').visible, false);
  assert.equal(handSpriteTransform({}, 'left').visible, true);
});
