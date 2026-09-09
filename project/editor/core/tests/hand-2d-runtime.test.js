import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileRigFrame, createHandSprites, handDrawingFromValues, handDrawings,
  normalizeHand, normalizeHands, normalizeHandSprites
} from '../../../runtime/runtime.js';
import { GENERATED_HAND_DRAWINGS } from '../hands/hand-sprite-set.js';

/**
 * A 2D hand in the frame (docs/HANDS_2D.md).
 *
 * The drawings are children of the hand group, so the hand's own transform
 * carries them: what the runtime does per frame is choose one and write
 * opacities. These tests are that promise, plus the two the refit is for --
 * a swap that never resizes the hand, and two hands that never see each other.
 */
const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 100, pivotY: 100, ...over });
const drawingId = (side, id) => `${side}Draw-${id}`;

const drawings = (side, ids = GENERATED_HAND_DRAWINGS) => ids.map((id) => ({ id, element: drawingId(side, id), pivot: [100, 100] }));

const elements = (ids = GENERATED_HAND_DRAWINGS) => {
  const out = { body: { baseTransform: transform() } };
  for (const side of ['left', 'right']) {
    out[`${side}Hand`] = { baseTransform: transform() };
    for (const drawing of drawings(side, ids)) out[drawing.element] = { baseTransform: transform() };
  }
  return out;
};

// `cut` unless a test is about the swap itself: what most of these check is
// which drawing was chosen, not how long it took to arrive.
const rig = ({ ids = GENERATED_HAND_DRAWINGS, ...sprites } = {}) => normalizeHands({
  hands: Object.fromEntries(['left', 'right'].map((side) => [side, {
    element: `${side}Hand`, parent: 'body', anchor: { x: side === 'left' ? -20 : 20, y: 40 },
    sprites: { swap: 'cut', drawings: drawings(side, ids), ...sprites }
  }]))
});

const run = (hands, values, { sprites = createHandSprites(hands), delta = 1, els = elements() } = {}) =>
  compileRigFrame(els, values, {}, {}, { hands, handSprites: sprites, delta });

const showing = (frame, side) => Object.entries(frame)
  .filter(([id, item]) => id.startsWith(`${side}Draw-`) && item.opacity > 0.001)
  .map(([id]) => id);

test('a hand shows one drawing and hides the rest', () => {
  const hands = rig();
  const frame = run(hands, { handLDrawing: 1 });
  assert.deepEqual(showing(frame, 'left'), [drawingId('left', 'palmOpen')]);
  assert.equal(frame[drawingId('left', 'sideOpen')].opacity, 0);
  assert.equal(frame.leftHand.handDrawing, 'palmOpen');
});

test('the drawing parameter indexes the hand’s own pictures', () => {
  const hands = rig();
  const sprites = createHandSprites(hands);
  for (const [index, id] of GENERATED_HAND_DRAWINGS.entries()) {
    assert.deepEqual(showing(run(hands, { handLDrawing: index }, { sprites }), 'left'), [drawingId('left', id)], id);
  }
  // Out of range is the nearest end of the list, never nothing.
  assert.deepEqual(showing(run(hands, { handLDrawing: 99 }, { sprites }), 'left'), [drawingId('left', GENERATED_HAND_DRAWINGS.at(-1))]);
  assert.deepEqual(showing(run(hands, { handLDrawing: -99 }, { sprites }), 'left'), [drawingId('left', 'sideOpen')]);
});

test('choosing a drawing changes nothing else about the hand', () => {
  const hands = rig();
  const sprites = createHandSprites(hands);
  const first = run(hands, { handLDrawing: 0, handLX: 0.5 }, { sprites });
  const second = run(hands, { handLDrawing: 2, handLX: 0.5 }, { sprites });
  assert.deepEqual(showing(second, 'left'), [drawingId('left', 'frontFist')]);
  assert.deepEqual(second.leftHand.transform, first.leftHand.transform);
});

test('a hand with drawings never writes a shape weight of its own: a change of look is a swap', () => {
  const frame = run(rig(), { handLDrawing: 2 });
  for (const [id, item] of Object.entries(frame)) {
    assert.equal(item.shapeWeights, undefined, id);
    assert.equal(item.morph, null, id);
  }
});

test('there is no angle left to read: turning the hand is not choosing a drawing', () => {
  const hands = rig();
  const sprites = createHandSprites(hands);
  const still = run(hands, { handLDrawing: 1, handLRotation: 0 }, { sprites });
  const turned = run(hands, { handLDrawing: 1, handLRotation: 1 }, { sprites });
  assert.deepEqual(showing(turned, 'left'), showing(still, 'left'));
  assert.notEqual(turned.leftHand.transform.rotation, still.leftHand.transform.rotation);
  // And a facing axis nobody wrote is a value nothing reads.
  const facing = run(hands, { handLDrawing: 1, handLFacing: 1 }, { sprites });
  assert.deepEqual(showing(facing, 'left'), showing(still, 'left'));
  assert.equal(hands.left.parameters.facing, undefined);
  assert.equal(hands.left.parameters.view, undefined);
  assert.equal(hands.left.parameters.pose, undefined);
});

test('a swap cross-fades briefly and the two opacities sum to one', () => {
  const hands = rig({ swap: 'crossfade' });
  const sprites = createHandSprites(hands);
  run(hands, { handLDrawing: 1 }, { sprites });
  // The frame the change is asked on starts the fade at zero; the next one is
  // halfway through the 80 ms it lasts.
  const start = run(hands, { handLDrawing: 2 }, { sprites, delta: 1 / 60 });
  assert.equal(start[drawingId('left', 'palmOpen')].opacity, 1);
  assert.equal(start[drawingId('left', 'frontFist')].opacity, 0);
  const mid = run(hands, { handLDrawing: 2 }, { sprites, delta: 0.04 });
  const palm = mid[drawingId('left', 'palmOpen')].opacity;
  const fist = mid[drawingId('left', 'frontFist')].opacity;
  assert.ok(palm > 0 && fist > 0);
  assert.equal(Math.round((palm + fist) * 1000), 1000);
  const done = run(hands, { handLDrawing: 2 }, { sprites, delta: 1 });
  assert.deepEqual(showing(done, 'left'), [drawingId('left', 'frontFist')]);
});

test('an old project keeps the hand it was showing, through its own parameters', () => {
  const hand = normalizeHand({
    element: 'leftHand',
    poses: [{ id: 'fist', parameter: 'handLFist' }, { id: 'spread', parameter: 'handLSpread' }],
    sprites: { drawings: drawings('left') }
  }, 'left');
  assert.equal(handDrawingFromValues(hand, {}), 'sideOpen', 'the picture the set rests on');
  assert.equal(handDrawingFromValues(hand, { handLFist: 1 }), 'frontFist');
  assert.equal(handDrawingFromValues(hand, { handLFist: 0.6, handLSpread: 0.9 }), 'palmOpen');
  // A drawing parameter of its own always wins over the bridge.
  assert.equal(handDrawingFromValues(hand, { handLDrawing: 0, handLFist: 1 }), 'sideOpen');
  assert.deepEqual(handDrawings(hand.sprites).map((drawing) => drawing.id), [...GENERATED_HAND_DRAWINGS]);
});

test('a hand with no drawings is untouched: it deforms as it always did', () => {
  const hands = normalizeHands({ hands: { left: { element: 'leftHand', poses: [{ id: 'fist', parameter: 'handLFist', shapeKey: 'k' }] } } });
  assert.equal(hands.left.sprites, undefined, 'nothing to say, so nothing said');
  assert.deepEqual(Object.keys(hands.left.parameters), ['x', 'y', 'rotation', 'scale', 'depth']);
  const els = { leftHand: { baseTransform: transform() } };
  const frame = compileRigFrame(els, { handLFist: 1 }, {}, {}, { hands });
  assert.deepEqual(frame.leftHand.shapeWeights, { k: 1 });
  assert.equal(frame.leftHand.handDrawing, undefined);
});

test('a set with no drawings at all is no set', () => {
  assert.equal(normalizeHandSprites({ drawings: [] }), null);
  assert.equal(normalizeHandSprites(null), null);
  assert.equal(normalizeHandSprites({ drawings: [{ id: 'palmOpen' }] }), null, 'a picture with no group to draw is no picture');
  assert.equal(normalizeHandSprites({ drawings: [{ element: 'a' }] }), null, 'nor is one with no name');
});

test('a set says what it rests on, and its pictures say what they can do', () => {
  const sprites = normalizeHandSprites({ showing: 'fist', drawings: drawings('left') });
  assert.equal(sprites.showing, 'frontFist', 'an alias resolves against the set');
  assert.equal(normalizeHandSprites({ showing: 'nonsense', drawings: drawings('left') }).showing, 'sideOpen');
  assert.equal(normalizeHandSprites({ drawings: [{ id: 'wave', element: 'w', anim: 'Wave harder' }] }).drawings[0].anim, 'Wave harder');
});

/* ── Two hands ─────────────────────────────────────────────────────────────── */

test('two hands hold different drawings and never reach each other', () => {
  const hands = rig();
  const sprites = createHandSprites(hands);
  const frame = run(hands, { handLDrawing: 1, handRDrawing: 2, handLX: -1, handRX: 1 }, { sprites });
  assert.deepEqual(showing(frame, 'left'), [drawingId('left', 'palmOpen')]);
  assert.deepEqual(showing(frame, 'right'), [drawingId('right', 'frontFist')]);
  assert.ok(frame.leftHand.transform.x < 0);
  assert.ok(frame.rightHand.transform.x > 0);
  // Move one, and nothing about the other changes.
  const moved = run(hands, { handLDrawing: 1, handRDrawing: 2, handLX: 1, handRX: 1 }, { sprites });
  assert.deepEqual(moved.rightHand.transform, frame.rightHand.transform);
  assert.deepEqual(showing(moved, 'right'), showing(frame, 'right'));
});

/* ── The reference movement ────────────────────────────────────────────────── */

/**
 * Off the left of the artboard, in, changing hand three times, and out again.
 *
 * What it is looking for is what a pseudo-3D hand did wrong on the way: a pop,
 * a change of size, a pivot that wanders. The transform is the hand's own and
 * the drawing is a swap, so none of the three has anywhere to come from -- and
 * that is exactly what is asserted, frame by frame.
 */
test('a hand crossing the artboard changes drawing without popping, resizing or drifting', () => {
  const hands = rig({ swap: 'crossfade' });
  const sprites = createHandSprites(hands);
  const frames = [];
  const steps = 120;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;                       // 0 → 1, left to right
    const frame = run(hands, {
      handLX: -1.6 + 3.2 * t,                  // off one edge to off the other
      handLY: Math.sin(t * Math.PI) * -0.4,    // a shallow arc, not a straight line
      handLRotation: Math.sin(t * Math.PI * 2) * 0.5,
      handLDrawing: Math.min(GENERATED_HAND_DRAWINGS.length - 1, Math.floor(t * GENERATED_HAND_DRAWINGS.length))
    }, { sprites, delta: 1 / 60 });
    frames.push({ t, frame, drawing: frame.leftHand.handDrawing });
  }

  // The hand passes through its pictures in order, and never goes back.
  const seen = frames.map((item) => item.drawing).filter((id, index, all) => id !== all[index - 1]);
  assert.deepEqual(seen, [...GENERATED_HAND_DRAWINGS]);

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

/* ── Reactions (docs/HAND_GESTURES.md) ─────────────────────────────────────── */

test('a reaction gesture reaches a hand that shows drawings', async () => {
  const { createReactionController, normalizeReactions } = await import('../../../runtime/runtime.js');
  const hands = rig();
  const reactions = normalizeReactions({ reactions: [{
    id: 'hello', trigger: { type: 'click' },
    gestures: [{ side: 'left', pose: 'wave' }, { side: 'right', pose: 'fist' }],
    timing: { attack: 0.2, hold: 0.6, release: 0.2 }
  }] });
  const controller = createReactionController(() => ({ reactions, clips: [], hands }));
  controller.fire('hello', 0);
  // Half in: the drawing is struck. `wave` is an open palm, so it is `palmOpen`.
  const struck = controller.evaluate(0.5, {}).params;
  assert.equal(struck.handLDrawing, 1, 'wave → palmOpen');
  assert.equal(struck.handRDrawing, 2, 'fist → frontFist');
  // A drawing index is never eased into: at a tenth of the attack there is no
  // half-drawing, only the hand it already had.
  assert.equal(controller.evaluate(0.02, {}).params.handLDrawing, undefined);
  // ...and it lets go on the way out.
  assert.equal(controller.evaluate(1.5, {}).params.handLDrawing, undefined);
});

test('a gesture at a weight below half never strikes a drawing', async () => {
  const { createReactionController, normalizeReactions } = await import('../../../runtime/runtime.js');
  const hands = rig();
  const reactions = normalizeReactions({ reactions: [{ id: 'faint', trigger: { type: 'click' }, gestures: [{ side: 'left', pose: 'fist', weight: 0.3 }], timing: { attack: 0, hold: 1, release: 0 } }] });
  const controller = createReactionController(() => ({ reactions, clips: [], hands }));
  controller.fire('faint', 0);
  assert.equal(controller.evaluate(0.5, {}).params.handLDrawing, undefined);
});

test('a gesture for a hand the set does not draw is left alone, not guessed at', async () => {
  const { createReactionController, normalizeReactions } = await import('../../../runtime/runtime.js');
  const hands = rig({ ids: ['sideOpen'] });
  const reactions = normalizeReactions({ reactions: [{ id: 'point', trigger: { type: 'click' }, gestures: [{ side: 'left', pose: 'point' }], timing: { attack: 0, hold: 1, release: 0 } }] });
  const controller = createReactionController(() => ({ reactions, clips: [], hands }));
  controller.fire('point', 0);
  assert.deepEqual(controller.evaluate(0.5, {}).params, {});
});

test('a hand that still deforms takes its gesture as a weight, as it always did', async () => {
  const { createReactionController, normalizeReactions } = await import('../../../runtime/runtime.js');
  const reactions = normalizeReactions({ reactions: [{ id: 'hello', trigger: { type: 'click' }, gestures: [{ side: 'left', pose: 'wave' }], timing: { attack: 0, hold: 1, release: 0 } }] });
  const controller = createReactionController(() => ({ reactions, clips: [], hands: null }));
  controller.fire('hello', 0);
  assert.equal(controller.evaluate(0.5, {}).params.handLWave, 1);
});
