import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HAND_DRAWING, HAND_DRAWINGS, HAND_DRAWING_ALIASES, HAND_SIDES,
  handDrawing, handDrawingAnim, handDrawingId, handDrawingName, handSideId, handSideLetter, normalizeHandState
} from '../../../runtime/hand-vocabulary.js';

test('a hand is a side and a drawing, and nothing about angles', () => {
  assert.deepEqual([...HAND_SIDES], ['left', 'right']);
  assert.equal(handSideId('right'), 'right');
  assert.equal(handSideId('nonsense'), 'left');
  assert.equal(handSideLetter('right'), 'R');
  assert.equal(handSideLetter('left'), 'L');
  // The catalogue is a flat list, not a grid: no view, no face, no angle.
  const catalogue = JSON.stringify(HAND_DRAWINGS);
  for (const gone of ['view', 'angle', 'face', 'mirror', 'threeQuarter', 'facing']) {
    assert.doesNotMatch(catalogue, new RegExp(gone, 'i'), `${gone} is not part of a drawing any more`);
  }
});

test('every drawing is named, and says what it can do on its own', () => {
  assert.deepEqual(HAND_DRAWINGS.map((drawing) => drawing.id), ['sideOpen', 'palmOpen', 'frontFist']);
  for (const drawing of HAND_DRAWINGS) {
    assert.ok(drawing.name && drawing.name !== drawing.id, `${drawing.id} reads as words`);
    assert.ok(drawing.anim, `${drawing.id} carries an animation of its own`);
  }
  assert.equal(handDrawingAnim('frontFist'), 'Thumb up');
  assert.equal(handDrawingName('sideOpen'), 'Side, open');
});

test('a name the catalogue knows resolves; one it does not is not invented', () => {
  assert.equal(handDrawingId('palmOpen'), 'palmOpen');
  assert.equal(handDrawingId('  frontFist  '), 'frontFist');
  assert.equal(handDrawingId('nonsense'), null);
  assert.equal(handDrawingId(''), null);
  assert.equal(handDrawingId(null), null);
  assert.equal(handDrawing('nonsense'), null);
});

test('an alias is a name for a picture the system already has', () => {
  // A wave is an open palm and a rotation clip, not a picture of its own.
  assert.equal(handDrawingId('wave'), 'palmOpen');
  assert.equal(handDrawingId('open'), 'palmOpen');
  assert.equal(handDrawingId('relaxed'), 'sideOpen');
  assert.equal(handDrawingId('fist'), 'frontFist');
  assert.equal(handDrawingId('thumbsUp'), 'frontFist', 'the fist raises one as its own animation');
  for (const [alias, target] of Object.entries(HAND_DRAWING_ALIASES)) {
    assert.ok(HAND_DRAWINGS.some((drawing) => drawing.id === target), `${alias} points at a drawing that exists`);
  }
});

test("a set's own names answer before the catalogue's", () => {
  const own = [{ id: 'wave', name: 'Big wave', anim: 'Wave harder' }, { id: 'palmOpen' }];
  assert.equal(handDrawingId('wave', own), 'wave', 'a set that drew a wave means its own');
  assert.equal(handDrawingName('wave', own), 'Big wave');
  assert.equal(handDrawingAnim('wave', own), 'Wave harder');
  // Without such a set the same name is still the alias it always was.
  assert.equal(handDrawingId('wave'), 'palmOpen');
});

test('a hand state lands on something drawable, whatever it is handed', () => {
  const drawings = [{ id: 'palmOpen' }, { id: 'frontFist' }];
  assert.equal(normalizeHandState({ drawing: 'frontFist' }, 'left', drawings).drawing, 'frontFist');
  assert.equal(normalizeHandState({ drawing: 'sideOpen' }, 'left', drawings).drawing, 'palmOpen',
    'a picture the set has not got falls back to the one it rests on, not to a catalogue entry it never drew');
  assert.equal(normalizeHandState({}, 'left').drawing, DEFAULT_HAND_DRAWING);
  const state = normalizeHandState({ side: 'right', anim: 5, x: 'x', scale: 2, visible: false }, 'left');
  assert.equal(state.side, 'right');
  assert.equal(state.anim, 1, 'an animation is a fraction of itself');
  assert.equal(state.x, 0);
  assert.equal(state.scale, 2);
  assert.equal(state.visible, false);
  assert.equal(normalizeHandState({ anim: -3 }).anim, 0);
});
