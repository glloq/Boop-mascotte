import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HAND_SWAP, HAND_SWAP_MODES, HAND_SWAP_SECONDS, createHandSwap, handSwapMode, isHandOffscreen
} from '../../../runtime/hand-sprite.js';

const SPAN = HAND_SWAP_SECONDS;

test('a swap mode is one of three, and anything else is the default', () => {
  assert.deepEqual([...HAND_SWAP_MODES], ['cut', 'crossfade', 'hidden']);
  assert.equal(DEFAULT_HAND_SWAP, 'crossfade');
  assert.equal(handSwapMode('cut'), 'cut');
  assert.equal(handSwapMode('dissolve'), 'crossfade');
  assert.equal(handSwapMode(undefined), 'crossfade');
});

test('a cut is the new drawing on the frame it is asked for', () => {
  const swap = createHandSwap({ mode: 'cut', drawing: 'palmOpen' });
  const step = swap.step('frontFist', 1 / 60);
  assert.equal(step.showing, 'frontFist');
  assert.equal(step.opacity, 1);
  assert.equal(step.leaving, null);
  assert.equal(step.settled, true);
});

test('a cross-fade is two drawings and one pair of opacities, briefly', () => {
  const swap = createHandSwap({ mode: 'crossfade', drawing: 'palmOpen' });
  const half = swap.step('frontFist', SPAN / 2);
  assert.equal(half.showing, 'frontFist');
  assert.equal(half.leaving, 'palmOpen');
  // Nothing is blended but opacity, and the two always sum to one hand.
  assert.ok(Math.abs(half.opacity + half.leavingOpacity - 1) < 1e-9);
  assert.equal(half.settled, false);
  const done = swap.step('frontFist', SPAN);
  assert.equal(done.leaving, null);
  assert.equal(done.opacity, 1);
  assert.equal(done.settled, true);
});

test('a hidden swap waits until nobody can see it', () => {
  const swap = createHandSwap({ mode: 'hidden', drawing: 'palmOpen' });
  const held = swap.step('frontFist', 1, { hidden: false });
  assert.equal(held.showing, 'palmOpen', 'the change waits');
  assert.equal(held.settled, false);
  const taken = swap.step('frontFist', 1, { hidden: true });
  assert.equal(taken.showing, 'frontFist');
  assert.equal(taken.leaving, null, 'a swap nobody saw needs no fade');
  assert.equal(taken.settled, true);
});

test('a hand that changes its mind back never swaps', () => {
  const swap = createHandSwap({ mode: 'hidden', drawing: 'palmOpen' });
  swap.step('frontFist', 1, { hidden: false });
  const back = swap.step('palmOpen', 1, { hidden: false });
  assert.equal(back.showing, 'palmOpen');
  assert.equal(back.settled, true, 'the waiting change is stale, not pending');
  const still = swap.step('palmOpen', 1, { hidden: true });
  assert.equal(still.showing, 'palmOpen');
});

test('a reset shows a drawing outright: a seek, not an animation', () => {
  const swap = createHandSwap({ mode: 'crossfade', drawing: 'palmOpen' });
  swap.step('frontFist', SPAN / 4);
  assert.equal(swap.settled, false);
  swap.reset('sideOpen');
  assert.equal(swap.showing, 'sideOpen');
  assert.equal(swap.leaving, null);
  assert.equal(swap.settled, true);
});

test('a hand off the artboard is off it, by its own radius', () => {
  const bounds = { x: 0, y: 0, width: 100, height: 100 };
  assert.equal(isHandOffscreen({ x: 50, y: 50 }, bounds, 10), false);
  assert.equal(isHandOffscreen({ x: -20, y: 50 }, bounds, 10), true);
  assert.equal(isHandOffscreen({ x: -5, y: 50 }, bounds, 10), false, 'half in is not out');
  assert.equal(isHandOffscreen({ x: 130, y: 50 }, bounds, 10), true);
  assert.equal(isHandOffscreen({ x: 999, y: 999 }, null, 10), false, 'no artboard, no edge to leave');
});
