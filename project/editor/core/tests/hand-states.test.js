import test from 'node:test';
import assert from 'node:assert/strict';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createHandStateCommands } from '../hands/hand-state-commands.js';
import { handStateElementId, handStates, moveHandDrawing, freeHandStateId } from '../hands/hand-state-model.js';
import { elementSpan } from '../face-library/face-part-artwork.js';
import { validateRig } from '../validation/rig-validator.js';

/**
 * A hand's states, owned rather than borrowed (UIR-05).
 *
 * Every one of these is the same question asked four ways: after the operation,
 * does the *other* hand still hold exactly what it held? That is §16's
 * separation, and it is the one the whole hand model is built on.
 */

const ui = () => {
  const store = createEditorStore(createTemplateProjectState());
  const history = createHistory(store);
  return { store, history, hands: createHandStateCommands(store, history), doc: () => store.getDocument() };
};
const markupOf = (document, side, id) => {
  const span = elementSpan(document.svgMarkup, handStateElementId(side, id));
  return span ? document.svgMarkup.slice(span.start, span.end) : null;
};
/** Every drawing group on a hand, so a copy that lands on another one is caught. */
const groupsOf = (document, side) => [...document.svgMarkup.matchAll(new RegExp(`<g id="(${handStateElementId(side, '')}[\\w-]+)"`, 'g'))].map((match) => match[1]);

test('a state is renamed on one hand, and the other hand keeps its own name for it', () => {
  const app = ui();
  const right = handStates(app.doc(), 'right');
  assert.equal(app.hands.rename('left', 'point', 'Pointing up'), true);
  assert.equal(handStates(app.doc(), 'left').find((state) => state.id === 'point').name, 'Pointing up');
  assert.deepEqual(handStates(app.doc(), 'right'), right, 'the right hand was not renamed with it');
  // An empty name is the set's own back, never a state with no name.
  assert.equal(app.hands.rename('left', 'point', '   '), true);
  assert.equal(handStates(app.doc(), 'left').find((state) => state.id === 'point').name, 'Point');
});

test('a state is duplicated on its own hand, with its own drawing and its own entry', () => {
  const app = ui();
  const before = app.doc();
  const rightBefore = handStates(before, 'right');
  assert.equal(app.hands.duplicate('left', 'point'), true);
  const after = app.doc();
  const states = handStates(after, 'left');
  assert.equal(states.length, handStates(before, 'left').length + 1);
  const copy = states.at(-1);
  assert.deepEqual([copy.id, copy.name], ['point-copy', 'Point copy']);
  // Its own drawing, in the document, under its own ids.
  assert.equal(copy.element, 'handLeftStyle-point-copy', 'the copy has an element id of its own');
  assert.ok(markupOf(after, 'left', 'point-copy'), 'the copy is drawn');
  assert.notEqual(markupOf(after, 'left', 'point-copy'), markupOf(after, 'left', 'point'), 'and under ids of its own');
  assert.ok(after.elements['handLeftStyle-point-copy'], 'with a record the editor can select');
  // One group more than before, and every id still distinct: a copy that took
  // another state's id would write a second drawing over it.
  assert.deepEqual(groupsOf(after, 'left'), [...groupsOf(before, 'left'), 'handLeftStyle-point-copy']);
  // Nothing else moved.
  assert.equal(markupOf(after, 'left', 'point'), markupOf(before, 'left', 'point'), 'the original is untouched');
  assert.deepEqual(handStates(after, 'right'), rightBefore, 'and the other hand did not gain it');
  // The parameter indexes the library, so it grew with it.
  assert.deepEqual(after.params.handLStyle.options, states.map((state) => state.id));
  assert.equal(after.params.handLStyle.max, states.length - 1);
});

test('mirror copy gives the other hand the drawing, and no link to it afterwards', () => {
  const app = ui();
  // A state the right hand does not have, so the copy is visible as an arrival.
  assert.equal(app.hands.remove('right', 'point'), true);
  const leftBefore = handStates(app.doc(), 'left');
  assert.equal(app.hands.mirror('left', 'point'), true);
  const after = app.doc();
  assert.ok(handStates(after, 'right').some((state) => state.id === 'point'), 'the right hand has it now');
  assert.deepEqual(handStates(after, 'left'), leftBefore, 'and the left hand is exactly as it was');
  assert.ok(markupOf(after, 'right', 'point'), 'drawn on the right hand');
  assert.equal(groupsOf(after, 'right').filter((id) => id === 'handRightStyle-point').length, 1, 'once');
  assert.ok(after.hands.right.styles.library.find((entry) => entry.id === 'point').mirrored, 'and marked as the mirror it is');

  // No link: renaming the copy leaves the original alone, and deleting it does too.
  assert.equal(app.hands.rename('right', 'point', 'Jab'), true);
  assert.equal(handStates(app.doc(), 'left').find((state) => state.id === 'point').name, 'Point');
  assert.equal(app.hands.remove('right', 'point'), true);
  assert.deepEqual(handStates(app.doc(), 'left'), leftBefore);
});

test('a state is deleted with its drawing, and the last one never is', () => {
  const app = ui();
  const before = app.doc();
  const element = handStateElementId('left', 'peace');
  assert.ok(before.elements[element]);
  assert.equal(app.hands.remove('left', 'peace'), true);
  const after = app.doc();
  assert.equal(markupOf(after, 'left', 'peace'), null, 'the drawing went with the state');
  assert.equal(after.elements[element], undefined, 'and so did its records');
  assert.equal(handStates(after, 'right').length, handStates(before, 'right').length, 'the other hand is untouched');

  // Down to one, and the last refuses: a hand with nothing to draw is broken.
  for (const state of handStates(app.doc(), 'left').slice(1)) app.hands.remove('left', state.id);
  assert.equal(handStates(app.doc(), 'left').length, 1);
  assert.equal(app.hands.remove('left', handStates(app.doc(), 'left')[0].id), false);
});

test('deleting the state a hand rests on moves it to one that is still there', () => {
  const app = ui();
  const resting = app.doc().hands.left.styles.showing;
  assert.equal(app.hands.remove('left', resting), true);
  const showing = app.doc().hands.left.styles.showing;
  assert.notEqual(showing, resting);
  assert.ok(handStates(app.doc(), 'left').some((state) => state.id === showing && state.active));
});

test('every one of them is one undo step, and leaves a project that still validates', () => {
  const app = ui();
  const before = structuredClone(app.doc());
  const revision = app.store.getPersistentRevision();
  app.hands.duplicate('left', 'point');
  app.hands.rename('left', 'point-copy', 'Jab');
  app.hands.mirror('left', 'point-copy');
  app.hands.remove('left', 'point-copy');
  assert.equal(app.store.getPersistentRevision(), revision + 4, 'four operations, four revisions');
  assert.deepEqual(validateRig(app.doc()).filter((issue) => issue.severity === 'error'), [], 'and nothing broken');
  for (let n = 0; n < 4; n += 1) app.history.undo();
  assert.deepEqual(app.doc(), before, 'four undos put every one of them back');
});

test('a copied drawing is mirrored by arithmetic, and a path it cannot be is left alone', () => {
  // Absolute M/L/C is the shape every drawing in a set has: an even value is an
  // x and an odd one a y, so mirroring is `from.x + to.x - x`.
  const moved = moveHandDrawing('<path d="M 10 20 L 30 40 Z" />', { from: { x: 50, y: 0 }, to: { x: 150, y: 10 }, flip: true });
  assert.match(moved, /d="M190 30 L170 50 Z"/);
  // Without a flip it is a translation, which is what a duplicate on the same
  // hand needs when the two frames differ.
  assert.match(moveHandDrawing('<path d="M 10 20" />', { from: { x: 0, y: 0 }, to: { x: 5, y: 5 } }), /d="M15 25"/);
  // An arc's flags are not coordinates, so flipping by index would be nonsense:
  // it copies across as it is drawn instead.
  const arc = '<path d="M 0 0 A 5 5 0 0 1 10 10" />';
  assert.equal(moveHandDrawing(arc, { from: { x: 0, y: 0 }, to: { x: 9, y: 0 }, flip: true }), arc);
});

test('a free id is found rather than a name collided with', () => {
  const app = ui();
  assert.equal(freeHandStateId(app.doc(), 'left', 'point'), 'point-2', 'taken, so the next one');
  assert.equal(freeHandStateId(app.doc(), 'left', 'jab'), 'jab');
  assert.equal(freeHandStateId(app.doc(), 'left', '99 fist!'), 'fist-2', 'and what an author typed is made into one');
});
