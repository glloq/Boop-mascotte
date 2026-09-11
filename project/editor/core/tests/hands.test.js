import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRigFrame, createMascotEngine, normalizeHands, softenReach, handOffset, applyElementTransform, anchorDrift } from '../../../runtime/runtime.js';
import { createSpringFollower, createInertiaGroup } from '../../../runtime/inertia.js';
import * as runtimeHands from '../../../runtime/hands.js';
import {
  assignHand, removeHand, setHandAnchor, setHandParent, setHandRestOffset, setHandReach,
  setHandDepth, setHandSoftness, setHandInertia, setHandStyles,
  mirrorHand, handParameters, handReachEllipse, withinReach
} from '../hands/hand-model.js';
import { validateHands } from '../validation/rig-validator.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createExportRig } from '../export/export-rig.js';
import { createProjectSnapshot, applyProjectSnapshot } from '../state/project-snapshot.js';
import { createInitialState, createSampleProject } from '../state/store.js';
import { shapeDeltaFromPaths } from '../shape-keys/shape-key-model.js';

const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });
const elements = () => ({
  body: { baseTransform: transform(), bindings: { translateY: { expression: 'bounce', amplitude: 10 } } },
  handLeft: { baseTransform: transform() },
  handRight: { baseTransform: transform() }
});

const rigged = () => {
  const a = assignHand(null, 'left', { element: 'handLeft', parent: 'body', anchor: { x: -20, y: 40 } });
  const b = assignHand(a.hands, 'right', { element: 'handRight', parent: 'body', anchor: { x: 20, y: 40 } });
  return b.hands;
};

test('a hand is assigned per side with the parameters it needs', () => {
  const result = assignHand(null, 'left', { element: 'handLeft' });
  assert.equal(result.ok, true);
  assert.equal(result.hands.left.element, 'handLeft');
  assert.deepEqual(Object.keys(result.parameters), ['handLX', 'handLY', 'handLRotation', 'handLScale', 'handLDepth']);
  assert.deepEqual(Object.keys(assignHand(null, 'right', { element: 'handRight' }).parameters), ['handRX', 'handRY', 'handRRotation', 'handRScale', 'handRDepth']);
});

test('assigning refuses an unknown side or missing artwork with a readable reason', () => {
  assert.equal(assignHand(null, 'foot', { element: 'x' }).reason, 'unknown-side');
  assert.equal(assignHand(null, 'left', {}).reason, 'missing-artwork');
  assert.match(assignHand(null, 'left', {}).message, /Choose the artwork/);
});

test('left and right hands are independent', () => {
  const hands = rigged();
  const frame = compileRigFrame(elements(), { handLX: 1, handLY: 0, handRX: 0, handRY: 0 }, {}, {}, { hands });
  assert.ok(frame.handLeft.transform.x > 0);
  assert.equal(frame.handRight.transform.x, 0);
});

test('moving the body moves both anchors while local hand movement is preserved', () => {
  const hands = rigged();
  const still = compileRigFrame(elements(), { bounce: 0, handLX: 0.5 }, {}, {}, { hands });
  const bounced = compileRigFrame(elements(), { bounce: 1, handLX: 0.5 }, {}, {}, { hands });
  assert.equal(bounced.body.transform.y, 10);
  assert.equal(bounced.handLeft.transform.y - still.handLeft.transform.y, 10);
  assert.equal(bounced.handRight.transform.y - still.handRight.transform.y, 10);
  // Local movement survives the drift instead of being replaced by it.
  assert.equal(bounced.handLeft.transform.x, still.handLeft.transform.x);
});

test('a hand with no parent does not drift', () => {
  const hands = { left: normalizeHands({ hands: { left: { element: 'handLeft', anchor: { x: 5, y: 5 } } } }).left };
  const frame = compileRigFrame(elements(), { bounce: 1 }, {}, {}, { hands });
  assert.equal(frame.handLeft.transform.y, 0);
});

test('an anchor follows the body through rotation and scale, not just translation', () => {
  const rotated = applyElementTransform(transform({ rotation: 90, pivotX: 0, pivotY: 0 }), { x: 10, y: 0 });
  assert.ok(Math.abs(rotated.x) < 1e-9 && Math.abs(rotated.y - 10) < 1e-9);
  const scaled = applyElementTransform(transform({ scaleX: 2, scaleY: 3 }), { x: 4, y: 5 });
  assert.deepEqual(scaled, { x: 8, y: 15 });
  const drift = anchorDrift(
    { parent: 'body', anchor: { x: 10, y: 0 } },
    { body: { baseTransform: transform() } },
    { body: { transform: transform({ rotation: 90 }) } }
  );
  assert.ok(Math.abs(drift.x + 10) < 1e-9 && Math.abs(drift.y - 10) < 1e-9);
});

test('hand rotation and scale are ranges around rest', () => {
  const hands = rigged();
  const frame = compileRigFrame(elements(), { handLRotation: 1, handLScale: 1 }, {}, {}, { hands });
  assert.equal(frame.handLeft.transform.rotation, 30);
  assert.ok(Math.abs(frame.handLeft.transform.scaleX - 1.2) < 1e-9);
  const negative = compileRigFrame(elements(), { handLRotation: -0.5 }, {}, {}, { hands });
  assert.equal(negative.handLeft.transform.rotation, -15);
});

test('reach maps normalized input onto the ellipse', () => {
  const hand = normalizeHands({ hands: { left: { element: 'handLeft', reach: { x: 40, y: 30 } } } }).left;
  assert.deepEqual(handOffset(hand, 1, 0), { x: 40, y: 0 });
  assert.deepEqual(handOffset(hand, 0, -1), { x: 0, y: -30 });
  assert.deepEqual(handOffset(hand, 0, 0), { x: 0, y: 0 });
});

test('reach is a soft limit: a little overshoot, never a wall', () => {
  assert.equal(softenReach(0.5), 0.5);
  assert.equal(softenReach(1), 1);
  assert.ok(softenReach(1.4, 0.25) > 1 && softenReach(1.4, 0.25) < 1.25);
  assert.ok(softenReach(50, 0.25) <= 1.25);
  // A hard limit is still available for anyone who wants one.
  assert.equal(softenReach(9, 0), 1);
  assert.equal(withinReach(0.6, 0.6), true);
  assert.equal(withinReach(1, 1), false);
});

test('a diagonal at full input stays close to the reach boundary', () => {
  const hand = normalizeHands({ hands: { left: { element: 'handLeft', reach: { x: 40, y: 40 } } } }).left;
  const offset = handOffset(hand, 1, 1);
  const radius = Math.hypot(offset.x / 40, offset.y / 40);
  assert.ok(radius > 1 && radius < 1.25, `radius ${radius}`);
});

test('the reach guide is an ellipse around the anchor in artwork coordinates', () => {
  const hands = setHandRestOffset(rigged(), 'left', { x: 5, y: -5 });
  assert.deepEqual(handReachEllipse(hands.left, elements()), { cx: -15, cy: 35, rx: 40, ry: 30, overshoot: 0.25 });
});

test('anchor, rest offset, reach, depth, softness and inertia are edited immutably', () => {
  const hands = rigged();
  assert.deepEqual(setHandAnchor(hands, 'left', { x: 1, y: 2 }).left.anchor, { x: 1, y: 2 });
  assert.deepEqual(hands.left.anchor, { x: -20, y: 40 });
  assert.equal(setHandParent(hands, 'left', 'torso').left.parent, 'torso');
  assert.equal(setHandReach(hands, 'left', { x: 99 }).left.reach.x, 99);
  assert.equal(setHandReach(hands, 'left', { x: 99 }).left.reach.y, 30);
  assert.equal(setHandDepth(hands, 'left', 0.8).left.depth, 0.8);
  assert.equal(setHandSoftness(hands, 'left', 0).left.softness, 0);
  assert.equal(setHandInertia(hands, 'left', { enabled: true }).left.inertia.enabled, true);
  assert.equal(removeHand(removeHand(hands, 'left'), 'right'), null);
});

/* Styles (docs/HAND_STYLES.md) */

const withStyles = (hands, side = 'left', ids = ['relaxed', 'open', 'fist']) => ({
  ...hands,
  [side]: {
    ...hands[side],
    styles: { library: ids.map((id) => ({ id, element: `${hands[side].element}Style-${id}` })) }
  }
});
const styleElements = (side = 'left', ids = ['relaxed', 'open', 'fist']) => Object.fromEntries(
  ids.map((id) => [`hand${side === 'right' ? 'Right' : 'Left'}Style-${id}`, { baseTransform: transform(), baseOpacity: 1 }])
);

test('a hand with drawings names one more parameter, and only that one', () => {
  const hands = normalizeHands({ hands: withStyles(rigged()) });
  assert.equal(hands.left.parameters.style, 'handLStyle');
  assert.equal(hands.right.parameters.style, undefined, 'the other hand has none until it is given drawings');
  assert.equal(hands.left.parameters.anim, undefined, 'and no drawing has an animation of its own');
});

test('which drawing a hand rests on, and how it swaps, are patched not replaced', () => {
  const hands = normalizeHands({ hands: withStyles(rigged()) });
  const rested = setHandStyles(hands, 'left', { showing: 'fist' });
  assert.equal(rested.left.styles.showing, 'fist');
  assert.deepEqual(rested.left.styles.library.map((entry) => entry.id), ['relaxed', 'open', 'fist'], 'the library is untouched');
  assert.equal(setHandStyles(rested, 'left', { swap: 'hidden' }).left.styles.swap, 'hidden');
  assert.equal(setHandStyles(hands, 'right', { showing: 'fist' }).right.styles, undefined, 'a hand with no drawings is left alone');
});

test('no drawing is mandatory: a hand with none still animates', () => {
  const frame = compileRigFrame(elements(), { handLX: 1 }, {}, {}, { hands: rigged() });
  assert.equal(frame.handLeft.shapeWeights, undefined);
  assert.ok(frame.handLeft.transform.x > 0);
});

test('a hand shows exactly one drawing, and never deforms one', () => {
  const hands = normalizeHands({ hands: withStyles(rigged()) });
  const els = { ...elements(), ...styleElements('left') };
  const frame = compileRigFrame(els, { handLStyle: 1 }, {}, {}, { hands });
  assert.equal(frame['handLeftStyle-open'].opacity, 1);
  assert.equal(frame['handLeftStyle-relaxed'].opacity, 0);
  assert.equal(frame['handLeftStyle-fist'].opacity, 0);
  assert.equal(frame.handLeft.shapeWeights, undefined, 'nothing raises a shape key on a hand');
  assert.deepEqual(frame['handLeftStyle-open'].transform, transform(), 'a drawing carries no transform of its own');
});

test('a drawing from before the refit is still shown, as the choice it always was', () => {
  // "Method B": a pose whose whole artwork stood in for the hand. Those
  // drawings are static already, so they go on being shown until the project is
  // migrated (docs/HAND_STYLES.md, "Deprecated fields").
  const withVariant = { ...elements(), handLeftFist: { baseTransform: transform(), baseOpacity: 1 } };
  const hands = normalizeHands({ hands: { ...rigged(), left: { ...rigged().left, poses: [{ id: 'fist', parameter: 'handLFist', variant: 'handLeftFist' }] } } });
  const down = compileRigFrame(withVariant, { handLFist: 0 }, {}, {}, { hands });
  assert.equal(down.handLeft.opacity, 1);
  assert.equal(down.handLeftFist.opacity, 0);
  const up = compileRigFrame(withVariant, { handLFist: 1 }, {}, {}, { hands });
  assert.equal(up.handLeft.opacity, 0);
  assert.equal(up.handLeftFist.opacity, 1);
  // Half-raised is not half a hand: a choice is taken, never blended into.
  const half = compileRigFrame(withVariant, { handLFist: 0.4 }, {}, {}, { hands });
  assert.equal(half.handLeftFist.opacity, 0);
  assert.equal(half.handLeft.opacity, 1);
  // And it goes where the hand goes.
  const moved = compileRigFrame(withVariant, { bounce: 1, handLX: 0.5, handLRotation: 1, handLFist: 1 }, {}, {}, { hands });
  const hand = moved.handLeft.transform, drawing = moved.handLeftFist.transform;
  assert.deepEqual([drawing.x, drawing.y, drawing.rotation], [hand.x, hand.y, hand.rotation]);
  assert.equal(moved.handLeftFist.depthBand, moved.handLeft.depthBand);
});

test('a pose from an older file deforms nothing, whatever it claimed', () => {
  const rest = 'M0 0 L10 0 L10 10 Z';
  const withRest = { ...elements(), handLeft: { baseTransform: transform(), restPath: rest } };
  const hands = normalizeHands({ hands: { ...rigged(), left: { ...rigged().left, poses: [{ id: 'wave', parameter: 'handLWave', shapeKey: 'wave' }] } } });
  assert.equal(hands.left.poses[0].shapeKey, undefined, 'the field is dropped on the way in');
  const shapeKeys = [{ id: 'wave', target: 'handLeft', delta: shapeDeltaFromPaths(rest, 'M0 -4 L10 0 L10 10 Z') }];
  const frame = compileRigFrame(withRest, { handLWave: 1 }, {}, {}, { hands, shapeKeys });
  assert.equal(frame.handLeft.shapeWeights, undefined);
  assert.equal(frame.handLeft.path, rest, 'the hand is the shape it was drawn as');
});

test('a hand’s drawings are reported when their artwork has gone, and only then', () => {
  const hands = normalizeHands({ hands: withStyles(rigged()) });
  const base = { elements: { handLeft: {}, ...Object.fromEntries(Object.keys(styleElements('left')).map((id) => [id, {}])) }, params: { ...handParameters('left'), handLStyle: { type: 'number', min: 0, max: 2, default: 0, value: 0 } }, hands };
  assert.deepEqual(validateHands(base).filter((issue) => /drawing/.test(issue)), []);
  const lost = { ...base, elements: { ...base.elements } };
  delete lost.elements['handLeftStyle-fist'];
  assert.match(validateHands(lost).find((issue) => /drawing/.test(issue)), /no longer exists/);
});

/* Mirroring */

test('mirroring copies a hand’s placement to the other side, and nothing else', () => {
  const hands = setHandRestOffset(withStyles(rigged()), 'left', { x: 6, y: 2 });
  const mirrored = mirrorHand(hands, 'left', { mirrorX: 0, element: 'handRight' });
  assert.deepEqual(mirrored.right.anchor, { x: 20, y: 40 });
  assert.deepEqual(mirrored.right.restOffset, { x: -6, y: 2 });
  assert.equal(mirrored.right.reach.rotation, -30);
  assert.equal(mirrored.right.element, 'handRight');
  // The two hands hold their own drawings and choose their own: nothing about
  // one hand's appearance is copied onto the other (docs/HAND_STYLES.md).
  assert.equal(mirrored.right.styles, undefined);
  assert.equal(mirrored.left.styles.library.length, 3, 'and the source hand is untouched');
  assert.equal(hands.left.reach.rotation, 30);
});

test('mirroring around an artboard centre line places the hand symmetrically', () => {
  const hands = mirrorHand(rigged(), 'left', { mirrorX: 100, element: 'handRight' });
  assert.equal(hands.right.anchor.x, 220);
});

test('mirroring onto a hand that already has drawings leaves them alone', () => {
  const hands = withStyles(withStyles(rigged(), 'left', ['relaxed']), 'right', ['fist', 'peace']);
  const mirrored = mirrorHand(hands, 'left', { mirrorX: 100, element: 'handRight' });
  assert.deepEqual(mirrored.right.styles.library.map((entry) => entry.id), ['fist', 'peace']);
});

/* Inertia */

test('a spring follower lags, overshoots and settles', () => {
  const follower = createSpringFollower({ stiffness: 0.3, damping: 0.7, maxOvershoot: 0.4 });
  follower.reset(0);
  const samples = [];
  for (let i = 0; i < 40; i += 1) samples.push(follower.step(1));
  assert.ok(samples[0] < 1, 'lags behind at first');
  assert.ok(Math.max(...samples) > 1, 'overshoots');
  assert.ok(Math.abs(samples.at(-1) - 1) < 0.01, 'settles');
});

test('overshoot is capped so a stiff setting cannot throw the hand away', () => {
  const follower = createSpringFollower({ stiffness: 1, damping: 1, maxOvershoot: 0.2 });
  follower.reset(0);
  const samples = [];
  for (let i = 0; i < 60; i += 1) samples.push(follower.step(1));
  assert.ok(Math.max(...samples) <= 1.2 + 1e-9);
  assert.ok(Math.min(...samples) >= -0.2 - 1e-9);
});

test('inertia is switchable off and passes values straight through', () => {
  const group = createInertiaGroup({ enabled: false });
  assert.deepEqual(group.step({ handLX: 1 }), { handLX: 1 });
  assert.deepEqual(group.step({ handLX: -1 }), { handLX: -1 });
});

test('followAmount dials the effect down without retuning the spring', () => {
  const full = createInertiaGroup({ enabled: true, stiffness: 0.3, damping: 0.7, followAmount: 1 });
  const half = createInertiaGroup({ enabled: true, stiffness: 0.3, damping: 0.7, followAmount: 0.5 });
  full.step({ handLX: 0 }); half.step({ handLX: 0 });
  const a = full.step({ handLX: 1 }).handLX;
  const b = half.step({ handLX: 1 }).handLX;
  assert.ok(a < 1 && b < 1);
  assert.ok(Math.abs(b - 1) < Math.abs(a - 1), 'a smaller followAmount lags less');
});

test('a long stall does not launch the hand across the screen', () => {
  const follower = createSpringFollower({ stiffness: 0.4, damping: 0.7, maxOvershoot: 0.4 });
  follower.reset(0);
  assert.ok(follower.step(1, 30) <= 1.4);
});

test('the default inertia settings are stable', () => {
  const group = createInertiaGroup({ enabled: true });
  group.step({ handLX: 0 });
  let last = 0;
  for (let i = 0; i < 200; i += 1) last = group.step({ handLX: 1 }).handLX;
  assert.ok(Math.abs(last - 1) < 0.01, `settled at ${last}`);
});

/* Model plumbing */

test('hands survive normalization, snapshots and export', () => {
  const rig = normalizeRig({ params: {}, states: {}, elements: elements(), hands: rigged() });
  assert.equal(rig.hands.left.element, 'handLeft');
  assert.equal(normalizeRig({ params: {}, states: {}, elements: {} }).hands, null);

  const state = createSampleProject();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><g id="handLeft"><path d="M0 0L1 1"/></g></svg>';
  state.elements = elements();
  state.params = { ...state.params, ...handParameters('left'), ...handParameters('right') };
  state.hands = rigged();
  const snapshot = createProjectSnapshot(state, () => state.svgMarkup);
  const restored = createInitialState();
  applyProjectSnapshot(restored, snapshot);
  assert.deepEqual(restored.hands, state.hands);
  assert.equal(createExportRig(restored).hands.right.element, 'handRight');
});

test('a project without hands restores as none', () => {
  const state = createSampleProject();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg"><path id="a" d="M0 0L1 1"/></svg>';
  const snapshot = createProjectSnapshot(state, () => state.svgMarkup);
  const restored = createInitialState();
  applyProjectSnapshot(restored, snapshot);
  assert.equal(restored.hands, null);
});

test('hand diagnostics read like advice', () => {
  const hands = normalizeHands({ hands: { left: {
    element: 'ghost', parent: 'nobody', reach: { x: 0, y: 10 },
    styles: { showing: 'peace', library: [{ id: 'open', element: 'gone' }] }
  } } });
  const issues = validateHands({ elements: {}, params: {}, hands });
  assert.ok(issues.some((issue) => /its artwork "ghost" no longer exists/.test(issue)));
  assert.ok(issues.some((issue) => /anchored to "nobody"/.test(issue)));
  assert.ok(issues.some((issue) => /reach must be wider than zero/.test(issue)));
  assert.ok(issues.some((issue) => /its artwork no longer exists: "gone"/.test(issue)));
  // A hand asked to rest on a drawing it has not got rests on one it has:
  // the record heals itself, so there is nothing left to report.
  assert.equal(hands.left.styles.showing, 'open');
  assert.deepEqual(validateHands({ elements: {}, params: {} }), []);
  // Hand-edited past that, it is reported rather than drawn blank.
  const broken = { elements: { handLeft: {}, gone: {} }, params: {}, hands: { left: { ...hands.left, element: 'handLeft', styles: { ...hands.left.styles, showing: 'peace' } } } };
  assert.ok(validateHands(broken).some((issue) => /rests on "peace"/.test(issue)));
});

test('hand diagnostics catch a drawing named twice, and leave a stable spring alone', () => {
  const hands = normalizeHands({ hands: { right: {
    element: 'handRight', inertia: { enabled: true, damping: 1 },
    styles: { library: [{ id: 'open', element: 'a' }, { id: 'palmOpen', element: 'b' }] }
  } } });
  // Two entries that migrate onto one style are one drawing, so there is
  // nothing to report -- the library never holds a name twice.
  assert.deepEqual(hands.right.styles.library.map((entry) => entry.id), ['open']);
  const issues = validateHands({ elements: { handRight: {}, a: {} }, params: { ...handParameters('right'), handRStyle: { type: 'number', min: 0, max: 0, default: 0, value: 0 } }, shapeKeys: [], hands });
  assert.deepEqual(issues.filter((issue) => /drawing|stiffness/.test(issue)), []);
});

/**
 * A hand's depth is its record's, plus its parameter, plus whatever the
 * artwork's own depth says: a keyform on the group is how a pair rests behind
 * the head (docs/HAND_RIGGING.md, "Behind the head").
 */
test('the artwork\'s own depth counts towards the hand\'s band', () => {
  const hands = rigged();
  const keyforms = [{ id: 'handLeft-show-depth', target: { kind: 'element', id: 'handLeft' }, channel: 'depth',
    axes: [{ parameter: 'handLShow', values: [0, 0.7, 1] }], keyforms: [{ at: [0], value: -1 }, { at: [1], value: -1 }, { at: [2], value: 0 }] }];
  const params = { handLShow: { type: 'number', min: 0, max: 1, default: 0, value: 0 }, handLDepth: { type: 'number', min: -1, max: 1, default: 0, value: 0 } };
  const at = (show, depth = 0) => compileRigFrame(elements(), { handLShow: show, handLDepth: depth }, {}, {}, { hands: normalizeHands({ hands }), keyforms, params });
  assert.equal(at(0).handLeft.depthBand, 'behind', 'tucked away: behind whatever it was drawn over');
  assert.equal(at(0).handLeft.depth, -1);
  assert.equal(at(1).handLeft.depthBand, 'normal', 'out: where it was drawn');
  assert.equal(at(1).handLeft.depth, 0);
  // The parameter and the record still add on top, clamped like any depth.
  assert.equal(at(1, 0.5).handLeft.depth, 0.5);
  assert.equal(at(0, 0.5).handLeft.depth, -0.5);
  assert.equal(at(0, -1).handLeft.depth, -1, 'never past the back');
  // A hand with no such keyform is exactly as before.
  assert.equal(compileRigFrame(elements(), { handLDepth: 0.2 }, {}, {}, { hands: normalizeHands({ hands }) }).handLeft.depth, 0.2);
});

/**
 * A hand asked out from behind the head travels there (docs/HAND_RIGGING.md,
 * "Behind the head"): whatever sets the show parameter, in one frame or over
 * many, the drawn value eases towards it over a fixed span.
 */
test('the reveal eases the show parameters towards what is asked, and never jumps', () => {
  const { createHandReveal, HAND_REVEAL_SECONDS } = runtimeHands;
  const reveal = createHandReveal({ handLShow: { type: 'number', min: 0, max: 1, default: 0, value: 0 }, headX: {} });
  assert.deepEqual(reveal.names, ['handLShow'], 'only the show parameters the rig has');
  // The first frame is where the hand starts: nothing slides in from nowhere.
  assert.equal(reveal.step({ handLShow: 0, headX: 0.3 }, 0).handLShow, 0);
  assert.equal(reveal.settled(), true);
  // Asked out in one frame, it is on its way, not there.
  const first = reveal.step({ handLShow: 1 }, 0.05);
  assert.ok(first.handLShow > 0 && first.handLShow < 0.2, `eased in: ${first.handLShow}`);
  assert.equal(reveal.settled(), false);
  const half = reveal.step({ handLShow: 1 }, HAND_REVEAL_SECONDS / 2 - 0.05);
  assert.ok(Math.abs(half.handLShow - 0.5) < 0.01, `halfway at half the span: ${half.handLShow}`);
  const there = reveal.step({ handLShow: 1 }, HAND_REVEAL_SECONDS);
  assert.equal(there.handLShow, 1);
  assert.equal(reveal.settled(), true);
  // Sent back halfway out, it turns round from where it is.
  reveal.step({ handLShow: 0 }, 0);
  const turning = reveal.step({ handLShow: 0 }, HAND_REVEAL_SECONDS / 2);
  assert.ok(turning.handLShow > 0.4 && turning.handLShow < 0.6, `from where it was: ${turning.handLShow}`);
  reveal.step({ handLShow: 1 }, 0);
  assert.equal(reveal.step({ handLShow: 1 }, 10).handLShow, 1, 'and out again');
  // Other parameters pass through untouched; a rig with no show parameter is left exactly alone.
  assert.equal(reveal.step({ handLShow: 1, headX: 0.7 }, 0).headX, 0.7);
  const bare = { handLX: 0.4 };
  assert.equal(createHandReveal({}).step(bare, 1), bare);
  reveal.reset();
  assert.equal(reveal.step({ handLShow: 0 }, 0).handLShow, 0, 'after a reset the hand starts where it is asked');
});

test('the reach guide follows the artwork: a hand moved by its own base transform rests where its drawing is', () => {
  const hands = setHandRestOffset(rigged(), 'left', { x: 5, y: -5 });
  const moved = { ...elements(), handLeft: { baseTransform: transform({ x: 10, y: -4, rotation: 20, scaleX: 1.5, scaleY: 1.5 }) } };
  assert.deepEqual(handReachEllipse(hands.left, moved), { cx: -5, cy: 31, rx: 40, ry: 30, overshoot: 0.25 }, 'a turn and a resize are about the pivot: only the move counts');
  // And through a body that has moved too: the move is in the body's space, as the anchor is.
  const carried = { ...moved, body: { baseTransform: transform({ x: 100, y: 0 }) } };
  assert.deepEqual(handReachEllipse(hands.left, carried).cx, 95);
});

/* ── A hand that is put down stays down (V3-11) ────────────────────────────────
 *
 * The measured defect: with the mascot idle and nothing touching it the right
 * hand's box drifted for as long as anyone watched, and its transform carried a
 * `translate(0 -0.31…)` throughout. Idle hands floats `handRY` — but pinning
 * `handRY` did not stop it, which made it look as though something in the
 * hand's carry were integrating.
 *
 * Nothing integrates. The exported engine composed the behaviours **after** the
 * live override layer, so a behaviour won the parameter it drives and no page
 * could hold a hand still — while `getParams()` reported the value it had been
 * asked for. `docs/PARAMETER_MIXER.md` declares the opposite order, and the
 * editor preview always ran it.
 *
 * These drive the engine the way a page does and read the transform it writes,
 * because that attribute is what the browser measurement read.
 */
const restingRig = () => normalizeRig({
  params: {
    bounce: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
    handRX: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
    handRY: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
    handRRotation: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
    handRScale: { type: 'number', min: -1, max: 1, default: 0, value: 0 },
    handRDepth: { type: 'number', min: -1, max: 1, default: 0, value: 0 }
  },
  states: { idle: { bounce: 0, handRX: 0, handRY: 0, handRRotation: 0, handRScale: 0, handRDepth: 0 } },
  activeState: 'idle', transitions: { idle: [] },
  elements: { body: { baseTransform: transform(), bindings: { translateY: { expression: 'bounce', amplitude: 10 } } }, handRight: { baseTransform: transform() } },
  hands: { right: { side: 'right', element: 'handRight', parent: 'body', anchor: { x: 20, y: 40 } } },
  // Idle hands, and the body sway the hand hangs from: the two doors a movement
  // reaches a floating hand through (docs/HAND_RIGGING.md, "Anchors").
  behaviors: [
    { id: 'auto-hand-r-y', type: 'oscillator', name: 'Right hand float', enabled: true, parameter: 'handRY', amplitude: .06, frequency: .31, offset: 0 },
    { id: 'auto-breathing', type: 'oscillator', name: 'Breathing', enabled: true, parameter: 'bounce', amplitude: .05, frequency: .22, offset: 0 }
  ]
});

/** The engine, driven one frame at a time, writing onto nodes a test can read. */
const drivenEngine = (rig) => {
  const node = (id) => ({ id, tagName: 'g', attrs: {}, setAttribute(name, value) { this.attrs[name] = value; } });
  const nodes = { body: node('body'), handRight: node('handRight') };
  let clock = 0, pending = null;
  const engine = createMascotEngine({ svgRoot: { id: '', querySelector: (selector) => nodes[selector.slice(1)] || null },
    rig, requestFrame: (fn) => { pending = fn; return 1; }, cancelFrame: () => {}, now: () => clock });
  engine.start();
  return { engine, nodes, frame(count = 1) { for (let i = 0; i < count; i += 1) { clock += 1000 / 60; const fn = pending; pending = null; fn?.(clock); } } };
};

test('a hand left alone reaches a resting position and stays there', () => {
  const { engine, nodes, frame } = drivenEngine(restingRig());
  frame(40);
  const alive = new Set();
  // The engine renders at its own rate, so a handful of ticks is a handful of
  // frames: read over enough of them that "it moved" is not a rounding story.
  for (let i = 0; i < 60; i += 1) { frame(); alive.add(nodes.handRight.attrs.transform); }
  assert.ok(alive.size > 5, `the idle really is moving the hand to begin with (${alive.size} transforms)`);

  // What a page does to put a hand down: hold everything that moves it.
  for (const [name, value] of Object.entries({ handRY: 0, handRRotation: 0, bounce: 0 })) engine.setParameter(name, value);
  frame(20);
  const reads = [];
  for (let i = 0; i < 60; i += 1) { frame(); reads.push(nodes.handRight.attrs.transform); }
  assert.equal(new Set(reads).size, 1, `it comes to rest and stays there (${new Set(reads).size} transforms, ${reads[0]} … ${reads[reads.length - 1]})`);
  assert.match(reads[0], /^translate\(0 0\)/, 'and rests exactly where it was placed');
  assert.equal(engine.getParams().handRY, 0, 'which is also what it reports');
});

test('a behaviour never beats live control: the declared mixer order holds in the engine too', () => {
  const { engine, nodes, frame } = drivenEngine(restingRig());
  frame(40);
  // One hand parameter held, the other movement left to float: the pin is exact
  // rather than a floor the idle is added to.
  engine.setParameter('handRY', .5);
  frame(10);
  const held = [];
  for (let i = 0; i < 30; i += 1) { frame(); held.push(nodes.handRight.attrs.transform); }
  // handRY .5 over the default reach of 30 is 15 units, plus whatever the body
  // sway lends the anchor — which still moves, because nothing pinned it.
  assert.ok(held.every((read) => /^translate\(0 1[45]\./.test(read)), `the held value is the value asked for (${held[0]})`);
  assert.ok(new Set(held).size > 5, 'and the movement nobody pinned is still running');
  engine.clearParameter('handRY');
  frame(10);
  assert.doesNotMatch(nodes.handRight.attrs.transform, /^translate\(0 1[45]\./, 'clearing it hands the parameter back to the idle');
});
