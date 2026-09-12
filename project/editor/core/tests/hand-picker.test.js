import test from 'node:test';
import assert from 'node:assert/strict';
import { HAND_CONSOLE, handPickerLayout } from '../puppet/hand-console.js';
import { handPickerChange, handPickerModel, handPickerOffer, handPickerOverlay } from '../puppet/hand-picker.js';
import { handStyleIds, handStyleElementId } from '../hands/hand-style-art.js';
import { assignHand } from '../hands/hand-model.js';
import { normalizeHands } from '../../../runtime/runtime.js';

/**
 * Picking a hand on the canvas (docs/HAND_STYLES.md, docs/DIRECT_CONTROLS.md).
 *
 * One column beside the face, one cell per drawing, and every cell holds the
 * drawing it selects. What is pinned here is that the column never sits on top
 * of the controls that were already there, and that a press means one thing.
 */
const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 100, pivotY: 250, ...over });

const library = (side, ids) => ids.map((id) => ({ id, element: handStyleElementId(side, id) }));

function project({ ids = ['relaxed'], side = 'left', hidden = true } = {}) {
  const elements = { body: { baseTransform: transform() }, handLeft: { baseTransform: transform() } };
  for (const entry of library(side, ids)) elements[entry.element] = { baseTransform: transform() };
  const assigned = assignHand(null, side, { element: 'handLeft', parent: null, anchor: { x: 100, y: 250 }, reach: { x: 40, y: 35 } });
  const hands = normalizeHands({ hands: { [side]: { ...assigned.hands[side], styles: { library: library(side, ids), pivot: [100, 250] } } } });
  return {
    elements, hands,
    params: {
      ...assigned.parameters,
      handLStyle: { type: 'number', min: 0, max: ids.length - 1, default: 0, value: 0, options: [...ids] },
      ...(hidden ? { handLShow: { type: 'number', min: 0, max: 1, default: 0, value: 0 } } : {})
    }
  };
}

const out = { handLShow: 1, handLStyle: 0 };

/* ── Where the cells go ────────────────────────────────────────────────────── */

test("the drawings go beside the face on the hand's own side", () => {
  const rest = { x: 100, y: 250 }, reach = { x: 40, y: 35 };
  const left = handPickerLayout({ rest, reach, side: 'left', drawings: 3 });
  const right = handPickerLayout({ rest, reach, side: 'right', drawings: 3 });
  assert.ok(left.drawings.every((cell) => cell.x < rest.x), 'the left hand picks on the left');
  assert.ok(right.drawings.every((cell) => cell.x > rest.x), 'the right hand picks on the right');
  // Mirror images of each other about the hand.
  const round3 = (value) => Math.round(value * 1000) / 1000;
  assert.deepEqual(left.drawings.map((cell) => round3(rest.x - cell.x)), right.drawings.map((cell) => round3(cell.x - rest.x)));
  assert.ok(left.drawings.every((cell) => cell.y < rest.y), 'beside the face, which is above the hand');
  assert.equal(new Set(left.drawings.map((cell) => cell.x)).size, 1, 'one column, not a grid');
});

test('the column clears the slider that brings the hand out', () => {
  const rest = { x: 100, y: 250 }, reach = { x: 40, y: 35 };
  const { drawings: cells } = handPickerLayout({ rest, reach, side: 'left', drawings: 7 });
  // The show slider is a line at this distance out (`handConsoleLayout`).
  const slider = rest.x - reach.x * (1 + HAND_CONSOLE.showOut);
  for (const cell of cells) assert.ok(cell.x + cell.size / 2 < slider, `a cell reaches the slider at ${slider}`);
});

test('more drawings mean smaller cells, never a column off the canvas', () => {
  const few = handPickerLayout({ rest: { x: 100, y: 250 }, reach: { x: 40, y: 35 }, side: 'left', drawings: 2 });
  const many = handPickerLayout({ rest: { x: 100, y: 250 }, reach: { x: 40, y: 35 }, side: 'left', drawings: 8 });
  assert.ok(many.drawings[0].size < few.drawings[0].size);
  const span = 35 * (HAND_CONSOLE.pickTop + HAND_CONSOLE.pickBottom);
  const used = many.drawings[many.drawings.length - 1].y - many.drawings[0].y + many.drawings[0].size;
  assert.ok(used <= span + 0.5, `${used} of ${span}`);
  // ...and never bigger than the cap, however few there are.
  assert.ok(few.drawings[0].size <= 35 * HAND_CONSOLE.pickMax + 0.01);
  assert.deepEqual(handPickerLayout({ rest: { x: 0, y: 0 }, drawings: 0 }), { drawings: [] });
});

/* ── What the cells are ────────────────────────────────────────────────────── */

test('every drawing the library holds is offered, drawn or not', () => {
  const picker = handPickerModel(project(), 'left', out);
  assert.deepEqual(picker.cells.map((cell) => cell.style), [...handStyleIds()]);
  const relaxed = picker.cells.find((cell) => cell.style === 'relaxed');
  assert.equal(relaxed.offer, false, 'this one is drawn');
  assert.equal(relaxed.active, true, 'and it is the one showing');
  assert.deepEqual(handPickerChange(relaxed), { handLStyle: 0 });
  assert.equal(handPickerOffer(relaxed), null);
  assert.match(relaxed.hint, /Show the relaxed hand/);
  const fist = picker.cells.find((cell) => cell.style === 'fist');
  assert.equal(fist.offer, true, 'this one is not drawn yet');
  assert.equal(handPickerChange(fist), null, 'so there is no index to write');
  assert.deepEqual(handPickerOffer(fist), { side: 'left', style: 'fist' });
  assert.match(fist.hint, /Draw the fist hand/);
});

test("a cell that is drawn writes its own place in the hand's library", () => {
  const picker = handPickerModel(project({ ids: [...handStyleIds()] }), 'left', { ...out, handLStyle: 2 });
  assert.deepEqual(picker.cells.map((cell) => cell.value), handStyleIds().map((id, index) => index));
  assert.equal(picker.cells.find((cell) => cell.active).style, 'fist');
  assert.deepEqual(handPickerChange(picker.cells[1]), { handLStyle: 1 });
  assert.ok(picker.cells.every((cell) => !cell.disabled), 'nothing here is a press that gets taken back');
});

test('there is no view row left: an angle is not something a hand is asked for', () => {
  const picker = handPickerModel(project(), 'left', out);
  assert.equal(picker.cells.every((cell) => cell.kind === 'style'), true);
  for (const gone of ['view', 'angle', 'facing', 'anim']) {
    assert.equal(JSON.stringify(picker).toLowerCase().includes(gone), false, `no ${gone} in the picker`);
  }
});

test('a hand still behind the head has no picker, only the slider that brings it out', () => {
  const state = project();
  assert.equal(handPickerModel(state, 'left', { handLShow: 0 }), null);
  assert.equal(handPickerModel(state, 'left', {}), null);
  assert.ok(handPickerModel(state, 'left', { handLShow: 1 }));
  // A hand that never hides has nothing to be gated on.
  assert.ok(handPickerModel(project({ hidden: false }), 'left', {}));
});

test('a hand with no drawings has no picker at all', () => {
  const state = project();
  delete state.hands.left.styles;
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
  const ids = handPickerModel(project({ ids: ['relaxed', 'fist'] }), 'left', out).cells.map((cell) => cell.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => id.startsWith('hand-left-pick-')));
});
