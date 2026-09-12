import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { validateRig } from '../validation/rig-validator.js';
import { installStyleHands, styleHandsMarkup } from '../hands/hand-style-install.js';
import { handStyleElementId, handStyleIds } from '../hands/hand-style-art.js';
import {
  describeHandDrawings, handDrawingFrame, handDrawingIsCustom, handDrawingLayerIds,
  pristineHandDrawing, restoreHandDrawing
} from '../hands/hand-drawing.js';

/**
 * Editing one drawing of one hand (docs/HAND_STYLES.md, "A gesture is a file").
 *
 * The point of the whole refit: there is something inside a drawing to open,
 * reshape and put back. What is tested here is the pair of questions the panel
 * asks -- has this been reshaped, and can the set's drawing come back -- and
 * that answering them never moves a hand.
 */

const record = (nodeType = 'path') => ({
  baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1,
  constraints: { translate: true, rotate: true, scale: true }, bindings: {},
  meta: { nodeType }, morph: { enabled: false, param: '', min: 0, max: 1, pathA: '', pathB: '' }
});

/** A mascot with a pair of hands made of drawings from the start. */
function drawnMascot() {
  const state = createCleanProjectState();
  state.svgMarkup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><g id="faceRoot"></g></svg>';
  state.elements = { faceRoot: record('g') };
  state.states = { idle: {} };
  state.activeState = 'idle';
  const markup = styleHandsMarkup(state);
  state.svgMarkup = state.svgMarkup.replace('</svg>', `${markup}</svg>`);
  for (const match of markup.matchAll(/<(g|path) id="([^"]+)"/g)) state.elements[match[2]] ||= record(match[1]);
  assert.equal(installStyleHands(state), true);
  return state;
}

/** Reshape one layer of one drawing, the way the Node tool would. */
function reshape(state, id, d = 'M 0 0 L 1 1 Z') {
  const before = state.svgMarkup;
  state.svgMarkup = state.svgMarkup.replace(new RegExp(`(<path id="${id}"[^>]*\\sd=")[^"]*(")`), `$1${d}$2`);
  assert.notEqual(state.svgMarkup, before, `${id} is in the document to reshape`);
  return state;
}

test('a drawing is a group of layers, and every one of them has a name to edit it by', () => {
  const state = drawnMascot();
  const drawings = describeHandDrawings(state, 'left');
  assert.deepEqual(drawings.map((drawing) => drawing.id), handStyleIds());
  assert.equal(drawings.filter((drawing) => drawing.resting).length, 1, 'one drawing is the one the hand rests on');
  for (const drawing of drawings) {
    assert.equal(drawing.element, handStyleElementId('left', drawing.id));
    assert.ok(drawing.layers.length >= 1, `${drawing.id} has layers to edit`);
    for (const layer of drawing.layers) {
      assert.ok(state.svgMarkup.includes(`id="${layer}"`), `${layer} is drawn`);
      assert.ok(state.elements[layer], `${layer} is a piece the editor can select`);
      assert.match(layer, new RegExp(`^${drawing.element}-`), 'a layer is named under the drawing that owns it');
    }
  }
});

test('the set is what a drawing is measured against, and a move of the hand is not a reshape', () => {
  const state = drawnMascot();
  for (const id of handStyleIds()) assert.equal(handDrawingIsCustom(state, 'left', id), false, `${id} is as the set draws it`);

  // Moving, turning and resizing the whole hand is what the rig does every
  // frame. None of it is an edit of a drawing.
  state.elements.handLeft.baseTransform = { ...state.elements.handLeft.baseTransform, x: 30, y: -12, rotation: 24, scaleX: 1.4, scaleY: 1.4 };
  assert.equal(handDrawingIsCustom(state, 'left', 'open'), false, 'a hand that moved still draws what the set draws');

  // One point of one layer, and only that drawing reads as reshaped.
  reshape(state, `${handStyleElementId('left', 'open')}-palm`);
  assert.equal(handDrawingIsCustom(state, 'left', 'open'), true, 'the drawing that was reshaped says so');
  assert.equal(handDrawingIsCustom(state, 'left', 'fist'), false, 'and its neighbours do not');
  assert.equal(handDrawingIsCustom(state, 'right', 'open'), false, 'nor the other hand');
  assert.equal(describeHandDrawings(state, 'left').find((drawing) => drawing.id === 'open').custom, true);

  // A question that cannot be asked is answered with "I do not know", not "no".
  assert.equal(handDrawingIsCustom(state, 'left', 'nonsense'), null);
  assert.equal(handDrawingIsCustom(createCleanProjectState(), 'left', 'open'), null, 'a mascot with no hands has no drawings');
});

test("the set's drawing comes back into the group that is already there", () => {
  const state = drawnMascot();
  const element = handStyleElementId('left', 'open');
  const before = state.svgMarkup;
  const hidden = /<g id="handLeftStyle-open"[^>]*opacity="0"/.test(before);

  reshape(state, `${element}-palm`);
  reshape(state, `${element}-thumb`, 'M 2 2 L 3 3 Z');
  assert.equal(handDrawingIsCustom(state, 'left', 'open'), true);

  assert.equal(restoreHandDrawing(state, 'left', 'open'), true);
  assert.equal(handDrawingIsCustom(state, 'left', 'open'), false, 'the set draws it again');
  assert.equal(state.svgMarkup, before, 'and the document is what it was, to the character');
  assert.equal(/<g id="handLeftStyle-open"[^>]*opacity="0"/.test(state.svgMarkup), hidden,
    'a restore never changes which drawing is showing');
  assert.deepEqual(validateRig(state), []);
});

test('a restore takes a shape drawn into the drawing with it, rig record and all', () => {
  const state = drawnMascot();
  const element = handStyleElementId('left', 'fist');
  state.svgMarkup = state.svgMarkup.replace(`<g id="${element}"`, `<g id="${element}"`)
    .replace(new RegExp(`(<g id="${element}"[^>]*>)`), '$1<path id="handLeftStyle-fist-doodle" d="M 0 0 L 5 5 Z" fill="#f00" />');
  state.elements['handLeftStyle-fist-doodle'] = record('path');
  assert.equal(handDrawingIsCustom(state, 'left', 'fist'), true, 'a shape drawn into it is a reshape');

  assert.equal(restoreHandDrawing(state, 'left', 'fist'), true);
  assert.ok(!state.svgMarkup.includes('handLeftStyle-fist-doodle'), 'the doodle is gone from the drawing');
  assert.equal(state.elements['handLeftStyle-fist-doodle'], undefined, 'and so is the record nothing draws any more');
  assert.deepEqual(validateRig(state), [], 'a rig with no element nothing draws');
  for (const layer of handDrawingLayerIds('left', 'fist')) assert.ok(state.elements[layer], `${layer} is still a piece`);
});

test('a hand that is not placed has nothing to restore from, and says so instead of guessing', () => {
  const state = drawnMascot();
  // The frame is the hand's own pivot: without one, and with nothing to
  // measure, there is no "where the set would draw it".
  state.elements.handLeft.baseTransform = { ...state.elements.handLeft.baseTransform, pivotX: 0, pivotY: 0 };
  assert.equal(handDrawingFrame(state, 'left'), null);
  assert.equal(pristineHandDrawing(state, 'left', 'open'), '');
  assert.equal(handDrawingIsCustom(state, 'left', 'open'), null);
  assert.equal(restoreHandDrawing(state, 'left', 'open'), false, 'and nothing is written');
  // Measured from the canvas instead, it can be asked again.
  const measure = (id) => (id === 'handLeft' ? { x: 20, y: 240, width: 60, height: 60 } : null);
  assert.ok(handDrawingFrame(state, 'left', measure));
  assert.equal(handDrawingIsCustom(state, 'left', 'open', { measure }), true, 'drawn at one size, measured at another');
});
