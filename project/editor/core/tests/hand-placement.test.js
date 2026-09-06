import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { validateRig } from '../validation/rig-validator.js';
import { addHandsCommand, areHandsInstalled, handPlacement, handsMarkup, handsViewBox, installHands } from '../sample/hand-feature.js';
import { HAND_PART_IDS, handElementId, handPartId } from '../sample/hand-artwork.js';
import { parsePath } from '../../../runtime/runtime.js';
import { handReachEllipse, normalizeHand } from '../hands/hand-model.js';

/**
 * Automatic first placement (VNX-20, docs/HAND_RIGGING.md).
 *
 * ```text
 * measure the body → place one hand → mirror it → a reach in proportion
 * ```
 *
 * A pair used to arrive at the coordinates the template wanted. This is the
 * same press on three mascots the template knows nothing about — a small one,
 * a large one, and one whose head sits off-centre — and on a project with
 * nothing to measure at all.
 */

const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });
const element = (over = {}) => ({
  baseTransform: transform(over), baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true },
  bindings: {}, meta: { nodeType: 'path' }, morph: { enabled: false, param: '', min: 0, max: 1, pathA: '', pathB: '' }
});

/**
 * One press, from the canvas's side: the artwork is appended first (with the
 * room the pair asked for), then the same options rig it. Exactly the sequence
 * `editor-app` runs, minus the DOM.
 */
function drawPair({ artboard = { width: 240, height: 240 }, body = null, bodyTransform = null } = {}) {
  const state = createCleanProjectState();
  state.svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${artboard.width} ${artboard.height}"><g id="faceRoot"></g></svg>`;
  state.elements = { faceRoot: element(bodyTransform || {}) };
  state.states = { idle: {} };
  state.activeState = 'idle';
  // The canvas measures artwork; the test plays that part. A body of `null` is
  // a project with nothing measurable on it.
  const options = { measure: body ? (id) => (id === 'faceRoot' ? body : null) : null };

  const viewBox = handsViewBox(state, options);
  const markup = handsMarkup(state, options);
  if (viewBox) state.svgMarkup = state.svgMarkup.replace(/viewBox="[^"]*"/, `viewBox="${viewBox}"`);
  state.svgMarkup = state.svgMarkup.replace('</svg>', `${markup}</svg>`);
  addHandElements(state);

  const ok = installHands(state, options);
  return { state, markup, options, ok, placement: handPlacement(state, options) };
}

/**
 * The canvas gives every node of the appended markup a rig record: the group
 * that is the hand, and the six parts inside it.
 */
function addHandElements(state) {
  for (const side of ['left', 'right']) {
    state.elements[handElementId(side)] = element();
    for (const part of HAND_PART_IDS) state.elements[handPartId(side, part)] = element();
  }
  state.layers = Object.keys(state.elements).filter((id) => !/^hand(Left|Right)./.test(id)).map((id) => ({
    id, type: /^hand/.test(id) ? 'g' : 'path', name: id,
    children: /^hand/.test(id) ? HAND_PART_IDS.map((part) => ({ id: `${id}${part.charAt(0).toUpperCase()}${part.slice(1)}`, type: 'path', name: part, children: [] })) : []
  }));
}

/** Every point a generated part names, straight out of its own path data. */
function pathPoints(d) {
  const { values } = parsePath(String(d || ''));
  const points = [];
  for (let i = 0; i + 1 < values.length; i += 2) points.push({ x: values[i], y: values[i + 1] });
  return points;
}

/** The parts of one side as the canvas drew them, in paint order. */
function drawnParts(markup, side) {
  return HAND_PART_IDS.flatMap((part) => pathPoints(new RegExp(`id="${handPartId(side, part)}"[^>]*\\sd="([^"]+)"`).exec(markup)?.[1]));
}

/**
 * Where a hand actually shows, on the canvas: its own outline, at the size the
 * rig gave it. A radius rather than a box, because the pair hangs tilted.
 */
function shownHand(state, side) {
  const hand = normalizeHand(state.hands[side], side);
  const item = state.elements[hand.element];
  const centre = handReachEllipse(hand, state.elements);
  // The group carries the tilt, the pivot and the size; the parts carry the outlines.
  const points = HAND_PART_IDS.flatMap((part) => pathPoints(state.elements[handPartId(side, part)].restPath));
  const radius = Math.max(...points.map((point) => Math.hypot(point.x - item.baseTransform.pivotX, point.y - item.baseTransform.pivotY)));
  return { at: { x: centre.cx, y: centre.cy }, radius: radius * item.baseTransform.scaleX, points };
}

const shapes = {
  small: { artboard: { width: 240, height: 240 }, body: { x: 90, y: 30, width: 60, height: 60 } },
  large: { artboard: { width: 800, height: 800 }, body: { x: 200, y: 100, width: 400, height: 400 } },
  offCentre: { artboard: { width: 240, height: 240 }, body: { x: 20, y: 20, width: 80, height: 80 } }
};

for (const [name, shape] of Object.entries(shapes)) {
  test(`a pair drawn on a ${name} mascot hangs below and outside its body`, () => {
    const { state, ok } = drawPair(shape);
    assert.equal(ok, true);
    assert.equal(areHandsInstalled(state), true);
    assert.deepEqual(validateRig(state), [], 'a placed pair is a valid rig on any mascot');

    const bottom = shape.body.y + shape.body.height;
    for (const side of ['left', 'right']) {
      const hand = normalizeHand(state.hands[side], side);
      const shown = shownHand(state, side);
      // Below: not across the face, and not merely below its middle -- the
      // whole outline clears the body's lowest point.
      assert.ok(shown.at.y > bottom, `${side} hangs below the body`);
      assert.ok(shown.at.y - shown.radius >= bottom - 0.05, `${side} does not overlap the body`);
      // Outside: past the edge on its own side.
      if (side === 'left') assert.ok(shown.at.x < shape.body.x, 'the left hand is outside the left edge');
      else assert.ok(shown.at.x > shape.body.x + shape.body.width, 'the right hand is outside the right edge');
      // And a reach that keeps the hand on the drawing at full stretch.
      assert.ok(hand.reach.x > 0 && hand.reach.y > 0);
      assert.ok(shown.at.x - hand.reach.x >= 0 && shown.at.x + hand.reach.x <= shape.artboard.width, `${side} can reach off the artboard`);
    }
  });

  test(`the ${name} mascot's hands are drawn where they are anchored`, () => {
    const { state, markup } = drawPair(shape);
    for (const side of ['left', 'right']) {
      const shown = shownHand(state, side);
      const drawn = drawnParts(markup, side);
      // The artwork the canvas appended and the outline the rig measures
      // against are the same drawing in the same place: one placement decides
      // both, so a hand can never be rigged beside its own artwork.
      assert.deepEqual(drawn, shown.points, `the ${side} hand's artwork is the outline it is rigged on`);
      // And the anchor is under the palm rather than off in a corner: the
      // reach ellipse the runtime limits the hand with is centred on it.
      const xs = drawn.map((point) => point.x), ys = drawn.map((point) => point.y);
      assert.ok(shown.at.x >= Math.min(...xs) && shown.at.x <= Math.max(...xs));
      assert.ok(shown.at.y >= Math.min(...ys) && shown.at.y <= Math.max(...ys));
    }
  });
}

test('the reach scales with the mascot, not with the drawing area', () => {
  const small = drawPair(shapes.small).state.hands.left.reach;
  const large = drawPair(shapes.large).state.hands.left.reach;

  // Four hundred wide against sixty: a hand on the large mascot reaches
  // further in the same proportion, rather than reaching the same few pixels.
  assert.ok(large.x > small.x * 5, `${large.x} is not a large mascot's reach next to ${small.x}`);
  // The same share of each mascot's own width, give or take the pixel a reach
  // is rounded to.
  const share = (reach, body) => reach.x / body.width;
  assert.ok(Math.abs(share(large, shapes.large.body) - share(small, shapes.small.body)) < 0.01);

  // The same mascot in a bigger artboard reaches exactly as far: what changed
  // is the drawing area, and the mascot did not.
  const body = { x: 20, y: 20, width: 120, height: 120 };
  const tight = drawPair({ artboard: { width: 240, height: 240 }, body }).state.hands.left.reach;
  const roomy = drawPair({ artboard: { width: 900, height: 900 }, body }).state.hands.left.reach;
  assert.deepEqual(roomy, tight);

  // And the hand itself is the mascot's size, not the artboard's.
  const { state } = drawPair(shapes.small);
  assert.equal(Math.round(state.elements.handLeft.baseTransform.scaleX * 100), 25, 'a sixty-wide mascot in a 240 artboard gets a quarter-size hand');
});

test('the right hand is the left one mirrored, about the mascot rather than the artboard', () => {
  const { state, placement } = drawPair(shapes.offCentre);
  const left = normalizeHand(state.hands.left, 'left'), right = normalizeHand(state.hands.right, 'right');
  const centre = shapes.offCentre.body.x + shapes.offCentre.body.width / 2;

  assert.equal(left.anchor.y, right.anchor.y, 'a pair hangs level');
  assert.ok(Math.abs((centre - left.anchor.x) - (right.anchor.x - centre)) < 0.02, 'both hands are the same distance from the mascot');
  // The mirror line is the mascot's own middle: on a head at 20…100 of a 240
  // artboard, mirroring about 120 would leave one hand nowhere near it.
  assert.ok(right.anchor.x < 120, 'the pair follows the head, not the canvas');
  assert.deepEqual(right.reach, left.reach, 'and both hands reach the same distance');
  assert.equal(placement.points.right.x - centre, centre - placement.points.left.x);
});

test('a project with nothing to measure still gets usable hands', () => {
  // No artwork at all: the pair itself is the only thing on the canvas, and
  // there is nothing to measure even if a canvas were there to do it.
  const state = createCleanProjectState();
  state.svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240">${handsMarkup(state)}</svg>`;
  state.elements = {};
  addHandElements(state);
  state.states = { idle: {} };
  state.activeState = 'idle';

  assert.equal(installHands(state), true);
  assert.deepEqual(validateRig(state), []);
  const artboard = { width: 240, height: 324 };
  for (const side of ['left', 'right']) {
    const hand = normalizeHand(state.hands[side], side);
    // Not (0, 0), not off the artboard, and with a reach worth dragging.
    assert.ok(hand.anchor.x > 0 && hand.anchor.x < artboard.width, `${side} is on the artboard`);
    assert.ok(hand.anchor.y > artboard.height / 2 && hand.anchor.y < artboard.height, `${side} hangs low on the artboard`);
    assert.ok(hand.reach.x > 30 && hand.reach.y > 30, `${side} can be dragged somewhere`);
    // Anchored to nothing rather than to itself: the only elements here are
    // the two hands, and a hand that hangs off itself is a loop.
    assert.equal(hand.parent, null);
    assert.equal(state.elements[hand.element].baseTransform.scaleX, 1);
  }
  assert.equal(state.hands.right.anchor.x - 120, 120 - state.hands.left.anchor.x, 'still a mirrored pair');
});

test('an unmeasured project is placed exactly where the pair has always gone', () => {
  // The fallback is not a new guess: it is the template's own placement, which
  // is right for a drawing that fills its artboard.
  const { state, markup } = drawPair({ artboard: { width: 240, height: 240 } });
  assert.equal(handsViewBox(createCleanProjectState(), {}), '0 0 240 324');
  // Drawn and rigged in the same place here too: the fallback runs through the
  // same placement, so the artwork and its rest outline cannot drift apart.
  for (const side of ['left', 'right']) {
    for (const part of HAND_PART_IDS) {
      const drawn = new RegExp(`id="${handPartId(side, part)}"[^>]*\\sd="([^"]+)"`).exec(markup)?.[1];
      assert.equal(state.elements[handPartId(side, part)].restPath, drawn, `${side} ${part}`);
    }
  }
  assert.deepEqual(state.hands.left.anchor, { x: 48, y: 259 });
  assert.deepEqual(state.hands.right.anchor, { x: 192, y: 259 });
  assert.deepEqual(state.hands.left.reach, { x: 38, y: 55, rotation: 180, scale: 0.25 });
  assert.equal(state.elements.handLeft.baseTransform.rotation, 200);
  assert.equal(state.elements.handRight.baseTransform.rotation, 160);
});

test('a body carrying its own transform still gets its ellipse around its hands', () => {
  // An imported mascot is usually a group with a transform on it. The anchor
  // is stored in that group's coordinates, so it has to be mapped back, or the
  // reach would be drawn as far from the hand as the group is from the origin.
  const shape = { artboard: { width: 400, height: 400 }, body: { x: 150, y: 60, width: 160, height: 160 }, bodyTransform: { x: 90, y: 40 } };
  const { state } = drawPair(shape);
  for (const side of ['left', 'right']) {
    const hand = normalizeHand(state.hands[side], side);
    const ellipse = handReachEllipse(hand, state.elements);
    const pivot = state.elements[hand.element].baseTransform;
    // The ellipse the canvas draws lands on the artwork the canvas drew.
    assert.ok(Math.abs(ellipse.cx - pivot.pivotX) < 0.02 && Math.abs(ellipse.cy - pivot.pivotY) < 0.02);
    // And the stored anchor is in the body's coordinates, not the artboard's.
    assert.ok(Math.abs(hand.anchor.x - pivot.pivotX + 90) < 0.02);
    assert.ok(Math.abs(hand.anchor.y - pivot.pivotY + 40) < 0.02);
  }
});

test('the whole pair is one command and one undo step, measurement included', () => {
  const { state, markup, options } = drawPair(shapes.large);
  // The document as the canvas leaves it after appending the artwork, before
  // anything is rigged: what `addHandsCommand` is handed.
  const before = createCleanProjectState();
  before.svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><g id="faceRoot"></g></svg>`;
  before.elements = { faceRoot: element() };
  before.states = { idle: {} };
  before.activeState = 'idle';
  const withHands = { elements: { ...before.elements } };
  addHandElements(withHands);
  const artwork = { svgMarkup: state.svgMarkup, layers: withHands.layers, layerMetadata: {}, elements: withHands.elements };

  const store = createEditorStore(before);
  const history = createHistory(store);
  let snapshots = 0, commands = 0;
  const snapshot = history.snapshot.bind(history), execute = store.execute.bind(store);
  history.snapshot = () => { snapshots += 1; return snapshot(); };
  store.execute = (command) => { commands += 1; return execute(command); };

  assert.equal(addHandsCommand(store, history, artwork, options), true);
  assert.equal(snapshots, 1, 'one snapshot for the pair');
  assert.equal(commands, 1, 'one command for the pair');
  assert.equal(areHandsInstalled(store.getDocument()), true);
  // The measurement reached the command: the hands are beside the mascot, not
  // in the corners of an 800-wide artboard.
  assert.ok(store.getDocument().hands.left.anchor.x > 100, 'the measured placement is what was written');
  assert.ok(markup.includes('handLeft'));

  history.undo();
  assert.equal(areHandsInstalled(store.getDocument()), false, 'one undo takes the whole pair back');
});
