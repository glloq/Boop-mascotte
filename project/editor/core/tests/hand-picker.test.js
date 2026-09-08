import test from 'node:test';
import assert from 'node:assert/strict';
import { HAND_CONSOLE, handPickerLayout } from '../puppet/hand-console.js';
import { handPickerChange, handPickerModel, handPickerOffer, handPickerOverlay } from '../puppet/hand-picker.js';
import { GENERATED_SPRITE_POSES, HAND_SPRITE_VIEWS, handSpriteElementId } from '../hands/hand-sprite-set.js';
import { assignHand } from '../hands/hand-model.js';
import { normalizeHands } from '../../../runtime/runtime.js';

/**
 * Picking a hand on the canvas (docs/HANDS_2D.md, docs/DIRECT_CONTROLS.md).
 *
 * The poses go beside the face, the views under the hand, and every cell holds
 * the drawing it selects. What is pinned here is that the two never sit on top
 * of the controls that were already there, and that a press means one thing.
 */
const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 100, pivotY: 250, ...over });

const drawings = (side, poses) => poses.flatMap((pose) => HAND_SPRITE_VIEWS.map((view) => ({
  pose, view, side, element: handSpriteElementId(side, pose, view), pivot: [100, 250]
})));

function project({ poses = ['relaxed'], side = 'left', hidden = true, viewMode = 'manual' } = {}) {
  const elements = { body: { baseTransform: transform() }, handLeft: { baseTransform: transform() } };
  for (const drawing of drawings(side, poses)) elements[drawing.element] = { baseTransform: transform() };
  const assigned = assignHand(null, side, { element: 'handLeft', parent: null, anchor: { x: 100, y: 250 }, reach: { x: 40, y: 35 } });
  const hands = normalizeHands({ hands: { [side]: { ...assigned.hands[side], sprites: { viewMode, drawings: drawings(side, poses), pivot: [100, 250] } } } });
  return {
    elements, hands,
    params: {
      ...assigned.parameters,
      handLPose: { type: 'number', min: 0, max: poses.length - 1, default: 0, value: 0 },
      handLView: { type: 'number', min: 0, max: 4, default: 2, value: 2 },
      ...(hidden ? { handLShow: { type: 'number', min: 0, max: 1, default: 0, value: 0 } } : {})
    }
  };
}

const out = { handLShow: 1, handLPose: 0, handLView: 2 };

/* ── Where the cells go ────────────────────────────────────────────────────── */

test('the poses go beside the face on the hand\'s own side, and the views under it', () => {
  const rest = { x: 100, y: 250 }, reach = { x: 40, y: 35 };
  const left = handPickerLayout({ rest, reach, side: 'left', poses: 3, views: 5 });
  const right = handPickerLayout({ rest, reach, side: 'right', poses: 3, views: 5 });
  assert.ok(left.poses.every((cell) => cell.x < rest.x), 'the left hand picks on the left');
  assert.ok(right.poses.every((cell) => cell.x > rest.x), 'the right hand picks on the right');
  // Mirror images of each other about the hand.
  const round3 = (value) => Math.round(value * 1000) / 1000;
  assert.deepEqual(left.poses.map((cell) => round3(rest.x - cell.x)), right.poses.map((cell) => round3(cell.x - rest.x)));
  assert.ok(left.poses.every((cell) => cell.y < rest.y), 'beside the face, which is above the hand');
  assert.ok(left.views.every((cell) => cell.y > rest.y + reach.y), 'and the views under the hand');
});

test('the column clears the slider that brings the hand out', () => {
  const rest = { x: 100, y: 250 }, reach = { x: 40, y: 35 };
  const { poses } = handPickerLayout({ rest, reach, side: 'left', poses: 7, views: 5 });
  // The show slider is a line at this distance out (`handConsoleLayout`).
  const slider = rest.x - reach.x * (1 + HAND_CONSOLE.showOut);
  for (const cell of poses) assert.ok(cell.x + cell.size / 2 < slider, `a cell reaches the slider at ${slider}`);
});

test('the views are laid out in the order they turn, evenly and centred on the hand', () => {
  const { views } = handPickerLayout({ rest: { x: 100, y: 250 }, reach: { x: 40, y: 35 }, side: 'left', poses: 1, views: 5 });
  assert.equal(views.length, 5);
  assert.deepEqual([...views].sort((a, b) => a.x - b.x).map((cell) => cell.x), views.map((cell) => cell.x), 'left to right');
  assert.equal(views[2].x, 100, 'the middle view is over the hand');
  const steps = views.slice(1).map((cell, index) => Math.round((cell.x - views[index].x) * 100) / 100);
  assert.equal(new Set(steps).size, 1, 'evenly spaced');
  assert.equal(new Set(views.map((cell) => cell.y)).size, 1, 'on one line');
});

test('more drawings mean smaller cells, never a column off the canvas', () => {
  const few = handPickerLayout({ rest: { x: 100, y: 250 }, reach: { x: 40, y: 35 }, side: 'left', poses: 2, views: 5 });
  const many = handPickerLayout({ rest: { x: 100, y: 250 }, reach: { x: 40, y: 35 }, side: 'left', poses: 8, views: 5 });
  assert.ok(many.poses[0].size < few.poses[0].size);
  const span = 35 * (HAND_CONSOLE.pickTop + HAND_CONSOLE.pickBottom);
  const used = many.poses[many.poses.length - 1].y - many.poses[0].y + many.poses[0].size;
  assert.ok(used <= span + 0.5, `${used} of ${span}`);
  // ...and never bigger than the cap, however few there are.
  assert.ok(few.poses[0].size <= 35 * HAND_CONSOLE.pickMax + 0.01);
  assert.deepEqual(handPickerLayout({ rest: { x: 0, y: 0 }, poses: 0, views: 0 }), { poses: [], views: [] });
});

/* ── What the cells are ────────────────────────────────────────────────────── */

test('every hand the generator can draw is offered, drawn or not', () => {
  const picker = handPickerModel(project(), 'left', out);
  const poses = picker.cells.filter((cell) => cell.kind === 'pose');
  assert.deepEqual(poses.map((cell) => cell.pose), [...GENERATED_SPRITE_POSES]);
  const relaxed = poses.find((cell) => cell.pose === 'relaxed');
  assert.equal(relaxed.offer, false, 'this one is drawn');
  assert.equal(relaxed.active, true, 'and it is the one showing');
  assert.deepEqual(handPickerChange(relaxed), { handLPose: 0 });
  assert.equal(handPickerOffer(relaxed), null);
  const fist = poses.find((cell) => cell.pose === 'fist');
  assert.equal(fist.offer, true, 'this one is not drawn yet');
  assert.equal(handPickerChange(fist), null, 'so there is no index to write');
  assert.deepEqual(handPickerOffer(fist), { side: 'left', pose: 'fist' });
  assert.match(fist.hint, /Draw the fist hand/);
});

test('a pose cell shows its own shape, front on, whatever the hand is turned to', () => {
  const picker = handPickerModel(project({ poses: ['relaxed', 'fist'] }), 'left', { ...out, handLView: 4 });
  for (const cell of picker.cells.filter((item) => item.kind === 'pose')) {
    assert.equal(cell.drawing.view, 'front', cell.pose);
    assert.equal(cell.drawing.pose, cell.pose);
  }
  // ...and a view cell shows the pose the hand is in, because that is the
  // question it is asking.
  for (const cell of picker.cells.filter((item) => item.kind === 'view')) assert.equal(cell.drawing.pose, 'relaxed');
});

test('a view cell writes its place in the row, and the one showing is marked', () => {
  const picker = handPickerModel(project(), 'left', { ...out, handLView: 3 });
  const views = picker.cells.filter((cell) => cell.kind === 'view');
  assert.deepEqual(views.map((cell) => cell.drawing.view), [...HAND_SPRITE_VIEWS]);
  assert.deepEqual(views.map((cell) => cell.value), [0, 1, 2, 3, 4]);
  assert.equal(views.find((cell) => cell.active).drawing.view, 'threeQuarterRight');
  assert.deepEqual(handPickerChange(views[0]), { handLView: 0 });
});

test('in automatic mode the view row says what is showing and does not offer to override it', () => {
  const picker = handPickerModel(project({ viewMode: 'auto' }), 'left', out);
  const views = picker.cells.filter((cell) => cell.kind === 'view');
  assert.ok(views.every((cell) => cell.disabled), 'a press the next frame takes back is a broken button');
  assert.equal(handPickerChange(views[0]), null);
  assert.match(views[0].hint, /turn automatic off/);
  // The poses are still pickable: automatic chooses the view, not the hand.
  assert.equal(picker.cells.filter((cell) => cell.kind === 'pose').every((cell) => !cell.disabled), true);
});

test('a hand still behind the head has no picker, only the slider that brings it out', () => {
  const state = project();
  assert.equal(handPickerModel(state, 'left', { handLShow: 0 }), null);
  assert.equal(handPickerModel(state, 'left', {}), null);
  assert.ok(handPickerModel(state, 'left', { handLShow: 1 }));
  // A hand that never hides has nothing to be gated on.
  assert.ok(handPickerModel(project({ hidden: false }), 'left', {}));
});

test('a hand that still deforms has no picker at all', () => {
  const state = project();
  delete state.hands.left.sprites;
  assert.equal(handPickerModel(state, 'left', out), null);
  assert.equal(handPickerModel({}, 'left', out), null);
  assert.equal(handPickerModel(state, 'right', out), null, 'and neither has a hand that is not there');
});

test('the overlay is both hands, and only the ones with drawings', () => {
  const state = project();
  assert.deepEqual(handPickerOverlay(state, out).map((picker) => picker.side), ['left']);
  assert.deepEqual(handPickerOverlay({}, {}), []);
});

test('every cell has its own id, so a press means one thing', () => {
  const ids = handPickerModel(project({ poses: ['relaxed', 'fist'] }), 'left', out).cells.map((cell) => cell.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith('hand-left-pick-')));
});
