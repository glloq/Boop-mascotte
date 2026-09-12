import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileRigFrame, createHandStyleSwaps, handStyleFromValues, handStyleList,
  normalizeHand, normalizeHands, normalizeHandStyleSet
} from '../../../runtime/runtime.js';
import { HAND_STYLE_IDS } from '../../../runtime/hand-vocabulary.js';

/**
 * A hand in the frame (docs/HAND_STYLES.md).
 *
 * The drawings are children of the hand group, so the hand's own transform
 * carries them: what the runtime does per frame is choose one and write
 * visibilities. These tests are that promise, plus the three the refit is for —
 * a swap that never resizes the hand, a drawing that never deforms, and two
 * hands that never see each other.
 */
const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 100, pivotY: 100, ...over });
const styleId = (side, id) => `${side}Style-${id}`;
const library = (side, ids = HAND_STYLE_IDS) => ids.map((id) => ({ id, element: styleId(side, id) }));

const elements = (ids = HAND_STYLE_IDS) => {
  const out = { body: { baseTransform: transform() } };
  for (const side of ['left', 'right']) {
    out[`${side}Hand`] = { baseTransform: transform() };
    for (const entry of library(side, ids)) out[entry.element] = { baseTransform: transform() };
  }
  return out;
};

const rig = ({ ids = HAND_STYLE_IDS, ...styles } = {}) => normalizeHands({
  hands: Object.fromEntries(['left', 'right'].map((side) => [side, {
    element: `${side}Hand`, parent: 'body', anchor: { x: side === 'left' ? -20 : 20, y: 40 },
    styles: { library: library(side, ids), ...styles }
  }]))
});

const run = (hands, values, { swaps = createHandStyleSwaps(hands), els = elements() } = {}) =>
  compileRigFrame(els, values, {}, {}, { hands, handStyles: swaps });

const showing = (frame, side) => Object.entries(frame)
  .filter(([id, item]) => id.startsWith(`${side}Style-`) && item.opacity > 0.001)
  .map(([id]) => id);

/* ── PHASE 3/29: the style is the whole of a hand's shape ──────────────────── */

test('a hand shows one drawing and hides the rest', () => {
  const hands = rig();
  const frame = run(hands, { handLStyle: 1 });
  assert.deepEqual(showing(frame, 'left'), [styleId('left', 'open')]);
  assert.equal(frame[styleId('left', 'relaxed')].opacity, 0);
  assert.equal(frame.leftHand.handStyle, 'open');
});

test("the style parameter indexes the hand's own library", () => {
  const hands = rig();
  const swaps = createHandStyleSwaps(hands);
  for (const [index, id] of HAND_STYLE_IDS.entries()) {
    assert.deepEqual(showing(run(hands, { handLStyle: index }, { swaps }), 'left'), [styleId('left', id)], id);
  }
  // Out of range lands on an end of the list rather than on nothing at all.
  assert.deepEqual(showing(run(hands, { handLStyle: 99 }, { swaps }), 'left'), [styleId('left', HAND_STYLE_IDS.at(-1))]);
  assert.deepEqual(showing(run(hands, { handLStyle: -4 }, { swaps }), 'left'), [styleId('left', 'relaxed')]);
});

test('a hand with no parameter set shows the drawing it rests on', () => {
  const hands = rig({ showing: 'fist' });
  assert.equal(handStyleFromValues(hands.left, {}), 'fist');
  assert.deepEqual(showing(run(hands, {}), 'left'), [styleId('left', 'fist')]);
});

test('nothing is ever between two drawings', () => {
  const hands = rig();
  const swaps = createHandStyleSwaps(hands);
  // Half an index is still one drawing: a choice rounds, it does not blend.
  for (const value of [0.49, 0.5, 1.2, 1.7]) {
    const shown = showing(run(hands, { handLStyle: value }, { swaps }), 'left');
    assert.equal(shown.length, 1, `handLStyle ${value} shows exactly one drawing`);
  }
});

/* ── PHASE 41: a sequence of styles, with nothing else moving ──────────────── */

test('relaxed → open → point → fist → relaxed swaps sprite and nothing else', () => {
  const hands = rig();
  const swaps = createHandStyleSwaps(hands);
  const sequence = ['relaxed', 'open', 'point', 'fist', 'relaxed'];
  let previous = null;
  for (const id of sequence) {
    const frame = run(hands, { handLStyle: HAND_STYLE_IDS.indexOf(id) }, { swaps });
    assert.deepEqual(showing(frame, 'left'), [styleId('left', id)], id);
    const hand = frame.leftHand.transform;
    // The hand itself has not moved, turned or resized across the whole
    // sequence, and neither has the drawing inside it.
    if (previous) assert.deepEqual(hand, previous, `${id} did not move the hand`);
    previous = hand;
    const drawing = frame[styleId('left', id)].transform;
    assert.deepEqual(drawing, transform(), 'a drawing carries no transform of its own');
    assert.equal(frame[styleId('left', id)].path, undefined, 'and no geometry was recomputed for it');
  }
});

/* ── PHASE 40: a whole gesture is transform only ───────────────────────────── */

test('a hand enters, rises, turns, waves and leaves without the drawing changing', () => {
  const hands = rig({ showing: 'open' });
  const swaps = createHandStyleSwaps(hands);
  const open = HAND_STYLE_IDS.indexOf('open');
  const beats = [
    { handLX: -1, handLY: 1 },                                   // in from the corner
    { handLX: -0.4, handLY: -0.6 },                              // up
    { handLX: -0.4, handLY: -0.8, handLRotation: 0.2 },          // a little turn
    { handLX: -0.4, handLY: -0.8, handLRotation: -0.2 },         // and back: the wave
    { handLX: -0.4, handLY: -0.8, handLRotation: 0.2 },
    { handLX: -0.6, handLY: 0.4 },                               // down
    { handLX: -1, handLY: 1 }                                    // and out
  ];
  const seen = new Set();
  let moved = 0;
  let last = null;
  for (const beat of beats) {
    const frame = run(hands, { handLStyle: open, ...beat }, { swaps });
    seen.add(frame.leftHand.handStyle);
    const drawing = frame[styleId('left', 'open')];
    assert.deepEqual(drawing.transform, transform(), 'the sprite itself never moves');
    assert.equal(drawing.path, undefined, 'and is never redrawn');
    if (last && (last.x !== frame.leftHand.transform.x || last.y !== frame.leftHand.transform.y || last.rotation !== frame.leftHand.transform.rotation)) moved += 1;
    last = frame.leftHand.transform;
  }
  assert.deepEqual([...seen], ['open'], 'one drawing for the whole gesture');
  assert.equal(moved, beats.length - 1, 'and every beat moved the hand');
});

/* ── PHASE 10/42: two hands, entirely independent ──────────────────────────── */

test('the two hands choose, move and hide independently', () => {
  const hands = rig();
  const swaps = createHandStyleSwaps(hands);
  const index = (id) => HAND_STYLE_IDS.indexOf(id);
  const first = run(hands, {
    handLStyle: index('open'), handRStyle: index('point'),
    handLX: -0.8, handRX: 0.3, handLRotation: 0.5, handRScale: 0.5
  }, { swaps });
  assert.deepEqual(showing(first, 'left'), [styleId('left', 'open')]);
  assert.deepEqual(showing(first, 'right'), [styleId('right', 'point')]);
  assert.notEqual(first.leftHand.transform.x, first.rightHand.transform.x);
  assert.notEqual(first.leftHand.transform.rotation, first.rightHand.transform.rotation);
  assert.notEqual(first.leftHand.transform.scaleX, first.rightHand.transform.scaleX);

  const second = run(hands, { handLStyle: index('peace'), handRStyle: index('fist') }, { swaps });
  assert.deepEqual(showing(second, 'left'), [styleId('left', 'peace')]);
  assert.deepEqual(showing(second, 'right'), [styleId('right', 'fist')]);
});

test('one hand hidden leaves the other alone', () => {
  const hands = rig();
  const els = elements();
  els.leftHand.baseOpacity = 0;
  const frame = run(hands, { handLStyle: 1, handRStyle: 2 }, { els });
  assert.equal(frame.leftHand.opacity, 0, 'the left hand is off');
  assert.equal(frame.rightHand.opacity, 1);
  assert.deepEqual(showing(frame, 'right'), [styleId('right', 'fist')]);
});

/* ── PHASE 30: swapping while nobody is looking ────────────────────────────── */

test('a hidden swap holds the change until nobody can see the hand', () => {
  const hands = rig({ swap: 'hidden' });
  const swaps = createHandStyleSwaps(hands);
  const els = elements();
  run(hands, { handLStyle: 0 }, { swaps, els });
  const held = run(hands, { handLStyle: 2 }, { swaps, els });
  assert.deepEqual(showing(held, 'left'), [styleId('left', 'relaxed')], 'still the old drawing');
  // Faded out is out of sight...
  els.leftHand.baseOpacity = 0;
  run(hands, { handLStyle: 2 }, { swaps, els });
  els.leftHand.baseOpacity = 1;
  assert.deepEqual(showing(run(hands, { handLStyle: 2 }, { swaps, els }), 'left'), [styleId('left', 'fist')]);
});

test('...and so is behind the head, which is where a hand rests', () => {
  const hands = rig({ swap: 'hidden' });
  const swaps = createHandStyleSwaps(hands);
  const els = elements();
  // A hand sunk into the `behind` band is behind the head, and a change of
  // drawing there is one nobody sees (docs/HAND_STYLES.md).
  els.leftHand.depth = -1;
  run(hands, { handLStyle: 0 }, { swaps, els });
  const behind = run(hands, { handLStyle: 4 }, { swaps, els });
  assert.equal(behind.leftHand.depthBand, 'behind');
  assert.deepEqual(showing(behind, 'left'), [styleId('left', 'thumbsUp')], 'taken at once, out of sight');
});

/* ── The record itself ─────────────────────────────────────────────────────── */

test('a library is normalized to whole drawings, said once each', () => {
  const styles = normalizeHandStyleSet({
    library: [
      { id: 'open', element: 'a' }, { id: 'palmOpen', element: 'b' },
      { id: 'fist' }, { id: '', element: 'c' }, { id: 'peace', element: 'd', name: 'V sign' }
    ]
  });
  assert.deepEqual(styles.library.map((entry) => entry.id), ['open', 'peace'], 'a name twice is one drawing; one with no artwork is none');
  assert.deepEqual(styles.library[0], { id: 'open', label: 'Open', element: 'a', mirrored: false });
  assert.equal(styles.library[1].label, 'V sign', "a hand's own label survives");
  assert.equal(styles.showing, 'open');
  assert.equal(styles.swap, 'cut');
  assert.equal(normalizeHandStyleSet({ library: [] }), null);
  assert.equal(normalizeHandStyleSet(null), null);
});

test('a hand with drawings names a style parameter; one without does not', () => {
  const withStyles = normalizeHand({ element: 'handLeft', styles: { library: library('left') } }, 'left');
  assert.equal(withStyles.parameters.style, 'handLStyle');
  assert.deepEqual(Object.keys(withStyles.parameters).sort(), ['depth', 'rotation', 'scale', 'style', 'x', 'y']);
  const without = normalizeHand({ element: 'handLeft' }, 'left');
  assert.equal(without.parameters.style, undefined);
  assert.equal(handStyleList(without.styles).length, 0);
});
