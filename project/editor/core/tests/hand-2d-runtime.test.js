import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileRigFrame, createHandSprites, handPoseFromValues, handSpritePoses, handViewFromValues,
  normalizeHand, normalizeHands, normalizeHandSprites
} from '../../../runtime/runtime.js';
import { HAND_SPRITE_VIEWS } from '../hands/hand-sprite-set.js';

/**
 * A 2D hand in the frame (docs/HANDS_2D.md, PHASES 11-14, 32, 44-46).
 *
 * The drawings are children of the hand group, so the hand's own transform
 * carries them: what the runtime does per frame is choose one and write
 * opacities. These tests are that promise, plus the two the refit is for --
 * a swap that never resizes the hand, and two hands that never see each other.
 */
const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 100, pivotY: 100, ...over });
const drawingId = (side, pose, view) => `${side}Draw-${pose}-${view}`;

const drawings = (side, poses = ['relaxed']) => poses.flatMap((pose) => HAND_SPRITE_VIEWS.map((view) => ({
  pose, view, element: drawingId(side, pose, view), side, pivot: [100, 100]
})));

const elements = (poses = ['relaxed']) => {
  const out = { body: { baseTransform: transform() } };
  for (const side of ['left', 'right']) {
    out[`${side}Hand`] = { baseTransform: transform() };
    for (const drawing of drawings(side, poses)) out[drawing.element] = { baseTransform: transform() };
  }
  return out;
};

// `cut` unless a test is about the swap itself: what most of these check is
// which drawing was chosen, not how long it took to arrive.
const rig = ({ poses = ['relaxed'], ...sprites } = {}) => normalizeHands({
  hands: Object.fromEntries(['left', 'right'].map((side) => [side, {
    element: `${side}Hand`, parent: 'body', anchor: { x: side === 'left' ? -20 : 20, y: 40 },
    sprites: { swap: 'cut', drawings: drawings(side, poses), ...sprites }
  }]))
});

const run = (hands, values, { sprites = createHandSprites(hands), delta = 1, els = elements() } = {}) =>
  compileRigFrame(els, values, {}, {}, { hands, handSprites: sprites, delta });

const showing = (frame, side) => Object.entries(frame)
  .filter(([id, item]) => id.startsWith(`${side}Draw-`) && item.opacity > 0.001)
  .map(([id]) => id);

test('a hand shows one drawing and hides the rest', () => {
  const hands = rig();
  const frame = run(hands, { handLView: 2 });
  assert.deepEqual(showing(frame, 'left'), [drawingId('left', 'relaxed', 'front')]);
  assert.equal(frame[drawingId('left', 'relaxed', 'sideLeft')].opacity, 0);
  assert.equal(frame.leftHand.handView, 'front');
  assert.equal(frame.leftHand.handPose, 'relaxed');
});

test('the view parameter steps along the row', () => {
  const hands = rig();
  const sprites = createHandSprites(hands);
  for (const [index, view] of HAND_SPRITE_VIEWS.entries()) {
    const frame = run(hands, { handLView: index }, { sprites });
    assert.deepEqual(showing(frame, 'left'), [drawingId('left', 'relaxed', view)], view);
  }
  // Out of range is the nearest end of the row, never nothing.
  assert.deepEqual(showing(run(hands, { handLView: 99 }, { sprites }), 'left'), [drawingId('left', 'relaxed', 'sideRight')]);
  assert.deepEqual(showing(run(hands, { handLView: -99 }, { sprites }), 'left'), [drawingId('left', 'relaxed', 'sideLeft')]);
});

test('the pose parameter picks a drawing, and nothing else about the hand changes', () => {
  const hands = rig({ poses: ['relaxed', 'fist'] });
  const els = elements(['relaxed', 'fist']);
  const sprites = createHandSprites(hands);
  const relaxed = run(hands, { handLPose: 0, handLView: 2, handLX: 0.5 }, { sprites, els });
  const fist = run(hands, { handLPose: 1, handLView: 2, handLX: 0.5 }, { sprites, els });
  assert.deepEqual(showing(relaxed, 'left'), [drawingId('left', 'relaxed', 'front')]);
  assert.deepEqual(showing(fist, 'left'), [drawingId('left', 'fist', 'front')]);
  assert.deepEqual(fist.leftHand.transform, relaxed.leftHand.transform);
});

test('a hand with drawings never writes a shape weight: a change of look is a swap', () => {
  const hands = rig({ poses: ['relaxed', 'fist'] });
  const frame = run(hands, { handLPose: 1, handLView: 0 }, { els: elements(['relaxed', 'fist']) });
  for (const [id, item] of Object.entries(frame)) {
    assert.equal(item.shapeWeights, undefined, id);
    assert.equal(item.morph, null, id);
  }
});

test('automatic mode reads the orientation the pseudo-3D turn used to', () => {
  const hands = rig({ viewMode: 'auto' });
  const sprites = createHandSprites(hands);
  assert.deepEqual(showing(run(hands, { handLFacing: 0 }, { sprites }), 'left'), [drawingId('left', 'relaxed', 'front')]);
  assert.deepEqual(showing(run(hands, { handLFacing: 1 }, { sprites }), 'left'), [drawingId('left', 'relaxed', 'sideRight')]);
  assert.deepEqual(showing(run(hands, { handLFacing: -1 }, { sprites }), 'left'), [drawingId('left', 'relaxed', 'sideLeft')]);
});

test('a hand hovering on a threshold does not strobe between two drawings', () => {
  const hands = rig({ viewMode: 'auto', swap: 'cut' });
  const sprites = createHandSprites(hands);
  const seen = new Set();
  for (let i = 0; i < 60; i += 1) {
    // 22.5 degrees is the front/three-quarter boundary; 0.25 of the sweep.
    seen.add(showing(run(hands, { handLFacing: 0.25 + Math.sin(i) * 0.04 }, { sprites, delta: 1 / 60 }), 'left')[0]);
  }
  assert.deepEqual([...seen], [drawingId('left', 'relaxed', 'front')]);
});

test('a manual view is kept whatever the orientation says', () => {
  const hands = rig({ viewMode: 'manual' });
  const frame = run(hands, { handLView: 0, handLFacing: 1 });
  assert.deepEqual(showing(frame, 'left'), [drawingId('left', 'relaxed', 'sideLeft')]);
});

test('a turn of the hand is not a change of drawing', () => {
  const hands = rig({ viewMode: 'auto' });
  const sprites = createHandSprites(hands);
  const still = run(hands, { handLFacing: 0, handLRotation: 0 }, { sprites });
  const turned = run(hands, { handLFacing: 0, handLRotation: 1 }, { sprites });
  assert.deepEqual(showing(turned, 'left'), showing(still, 'left'));
  assert.notEqual(turned.leftHand.transform.rotation, still.leftHand.transform.rotation);
});

test('a swap cross-fades briefly and the two opacities sum to one', () => {
  const hands = rig({ swap: 'crossfade' });
  const sprites = createHandSprites(hands);
  run(hands, { handLView: 2 }, { sprites });
  // The frame the change is asked on starts the fade at zero; the next one is
  // halfway through the 80 ms it lasts.
  const start = run(hands, { handLView: 4 }, { sprites, delta: 1 / 60 });
  assert.equal(start[drawingId('left', 'relaxed', 'front')].opacity, 1);
  assert.equal(start[drawingId('left', 'relaxed', 'sideRight')].opacity, 0);
  const mid = run(hands, { handLView: 4 }, { sprites, delta: 0.04 });
  const front = mid[drawingId('left', 'relaxed', 'front')].opacity;
  const side = mid[drawingId('left', 'relaxed', 'sideRight')].opacity;
  assert.ok(front > 0 && side > 0);
  assert.equal(Math.round((front + side) * 1000), 1000);
  const done = run(hands, { handLView: 4 }, { sprites, delta: 1 });
  assert.deepEqual(showing(done, 'left'), [drawingId('left', 'relaxed', 'sideRight')]);
});

test('a set of one generic hand mirrors its own views, turned over around the shared pivot', () => {
  // `side: null` is a drawing that serves either hand as it stands, which is
  // the only kind that may be flipped into the view beside it: flipping a
  // drawing of a *left* glove makes a right one.
  const hands = normalizeHands({
    hands: {
      left: {
        element: 'leftHand', parent: 'body',
        sprites: { swap: 'cut', drawings: [
          { pose: 'relaxed', view: 'front', element: 'a', side: null, pivot: [100, 100] },
          { pose: 'relaxed', view: 'threeQuarterLeft', element: 'b', side: null, pivot: [100, 100] }
        ] }
      }
    }
  });
  const els = { body: { baseTransform: transform() }, leftHand: { baseTransform: transform() }, a: { baseTransform: transform() }, b: { baseTransform: transform() } };
  const frame = run(hands, { handLView: 3 }, { els });
  assert.ok(frame.b.opacity > 0);
  assert.equal(frame.b.transform.scaleX, -1);
  assert.deepEqual([frame.b.transform.pivotX, frame.b.transform.pivotY], [100, 100]);
  assert.equal(frame.a.transform.scaleX, 1);
});

test('a hand never flips its own drawings: a left glove turned over is a right one', () => {
  const hands = normalizeHands({
    hands: {
      left: {
        element: 'leftHand', parent: 'body',
        sprites: { swap: 'cut', drawings: [
          { pose: 'relaxed', view: 'front', element: 'a', pivot: [100, 100] },
          { pose: 'relaxed', view: 'threeQuarterLeft', element: 'b', pivot: [100, 100] }
        ] }
      }
    }
  });
  assert.equal(hands.left.sprites.drawings.every((drawing) => drawing.side === 'left'), true);
  const els = { body: { baseTransform: transform() }, leftHand: { baseTransform: transform() }, a: { baseTransform: transform() }, b: { baseTransform: transform() } };
  const frame = run(hands, { handLView: 3 }, { els });
  assert.ok(frame.a.opacity > 0);
  assert.equal(frame.b.opacity, 0);
  assert.equal(frame.a.transform.scaleX, 1);
});

test('an old project keeps the pose it was showing, through its own parameters', () => {
  const hand = normalizeHand({
    element: 'leftHand',
    poses: [{ id: 'fist', parameter: 'handLFist' }, { id: 'point', parameter: 'handLPoint' }],
    sprites: { drawings: drawings('left', ['relaxed', 'fist', 'point']) }
  }, 'left');
  assert.equal(handPoseFromValues(hand, {}), 'relaxed');
  assert.equal(handPoseFromValues(hand, { handLFist: 1 }), 'fist');
  assert.equal(handPoseFromValues(hand, { handLFist: 0.6, handLPoint: 0.9 }), 'point');
  // A pose parameter of its own always wins over the bridge.
  assert.equal(handPoseFromValues(hand, { handLPose: 0, handLFist: 1 }), 'relaxed');
  assert.deepEqual(handSpritePoses(hand.sprites), ['relaxed', 'fist', 'point']);
  assert.equal(handViewFromValues(hand, {}), 'front');
  assert.equal(handViewFromValues(hand, { handLView: 4 }), 'sideRight');
});

test('a hand with no drawings is untouched: it deforms as it always did', () => {
  const hands = normalizeHands({ hands: { left: { element: 'leftHand', poses: [{ id: 'fist', parameter: 'handLFist', shapeKey: 'k' }] } } });
  assert.equal(hands.left.sprites, null);
  assert.deepEqual(Object.keys(hands.left.parameters), ['x', 'y', 'rotation', 'scale', 'depth']);
  const els = { leftHand: { baseTransform: transform() } };
  const frame = compileRigFrame(els, { handLFist: 1 }, {}, {}, { hands });
  assert.deepEqual(frame.leftHand.shapeWeights, { k: 1 });
  assert.equal(frame.leftHand.handDrawing, undefined);
});

test('a set with no drawings at all is no set', () => {
  assert.equal(normalizeHandSprites({ drawings: [] }), null);
  assert.equal(normalizeHandSprites(null), null);
  assert.equal(normalizeHandSprites({ drawings: [{ pose: 'relaxed', view: 'front' }] }), null);
});

/* ── Two hands (PHASE 45) ──────────────────────────────────────────────────── */

test('two hands hold different poses and views and never reach each other', () => {
  const hands = rig({ poses: ['relaxed', 'open', 'point'] });
  const els = elements(['relaxed', 'open', 'point']);
  const sprites = createHandSprites(hands);
  const frame = run(hands, { handLPose: 1, handLView: 2, handRPose: 2, handRView: 3, handLX: -1, handRX: 1 }, { sprites, els });
  assert.deepEqual(showing(frame, 'left'), [drawingId('left', 'open', 'front')]);
  assert.deepEqual(showing(frame, 'right'), [drawingId('right', 'point', 'threeQuarterRight')]);
  assert.ok(frame.leftHand.transform.x < 0);
  assert.ok(frame.rightHand.transform.x > 0);
  // Move one, and nothing about the other changes.
  const moved = run(hands, { handLPose: 1, handLView: 2, handRPose: 2, handRView: 3, handLX: 1, handRX: 1 }, { sprites, els });
  assert.deepEqual(moved.rightHand.transform, frame.rightHand.transform);
  assert.deepEqual(showing(moved, 'right'), showing(frame, 'right'));
});

test('the two hands choose their views independently', () => {
  const hands = rig({ viewMode: 'auto' });
  const sprites = createHandSprites(hands);
  const frame = run(hands, { handLFacing: -1, handRFacing: 1 }, { sprites });
  assert.deepEqual(showing(frame, 'left'), [drawingId('left', 'relaxed', 'sideLeft')]);
  assert.deepEqual(showing(frame, 'right'), [drawingId('right', 'relaxed', 'sideRight')]);
});

/* ── The reference movement (PHASE 44) ─────────────────────────────────────── */

/**
 * Off the left of the artboard, in, front → 3/4 → side → front, and out again.
 *
 * What it is looking for is what a pseudo-3D hand did wrong on the way: a pop,
 * a change of size, a pivot that wanders. The transform is the hand's own and
 * the drawing is a swap, so none of the three has anywhere to come from -- and
 * that is exactly what is asserted, frame by frame.
 */
test('a hand crossing the artboard turns without popping, resizing or drifting', () => {
  const hands = rig({ viewMode: 'auto', swap: 'crossfade' });
  const sprites = createHandSprites(hands);
  const frames = [];
  const steps = 120;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;                       // 0 → 1, left to right
    const facing = -1 + 2 * t;                 // turning all the way through the row
    const frame = run(hands, {
      handLX: -1.6 + 3.2 * t,                  // off one edge to off the other
      handLY: Math.sin(t * Math.PI) * -0.4,    // a shallow arc, not a straight line
      handLRotation: Math.sin(t * Math.PI * 2) * 0.5,
      handLFacing: facing
    }, { sprites, delta: 1 / 60 });
    frames.push({ t, frame, drawing: frame.leftHand.handDrawing, view: frame.leftHand.handView });
  }

  // The hand passes through the row in order, and never goes back on itself.
  const views = frames.map((item) => item.view).filter((view, index, all) => view !== all[index - 1]);
  assert.deepEqual(views, ['sideLeft', 'threeQuarterLeft', 'front', 'threeQuarterRight', 'sideRight']);

  for (let i = 1; i < frames.length; i += 1) {
    const before = frames[i - 1].frame.leftHand, now = frames[i].frame.leftHand;
    const at = `frame ${i}`;
    // The pivot is a convention, and it holds for every drawing.
    assert.equal(now.transform.pivotX, before.transform.pivotX, at);
    assert.equal(now.transform.pivotY, before.transform.pivotY, at);
    // Nothing about the size changes when the drawing does.
    assert.equal(now.transform.scaleX, before.transform.scaleX, at);
    assert.equal(now.transform.scaleY, before.transform.scaleY, at);
    // The movement is continuous: no step is a jump.
    assert.ok(Math.hypot(now.transform.x - before.transform.x, now.transform.y - before.transform.y) < 3, at);
    assert.ok(Math.abs(now.transform.rotation - before.transform.rotation) < 3, at);
  }

  // Exactly one drawing is fully on screen at rest, and at most two during a swap.
  for (const { frame } of frames) {
    const lit = Object.entries(frame).filter(([id, item]) => id.startsWith('leftDraw-') && item.opacity > 0.001);
    assert.ok(lit.length >= 1 && lit.length <= 2);
    assert.equal(Math.round(lit.reduce((sum, [, item]) => sum + item.opacity, 0) * 1000), 1000);
  }
});
