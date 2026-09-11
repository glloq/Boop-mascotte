import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { PROJECT_TEMPLATES, applyTemplateProject } from '../sample/templates/index.js';
import { GLYPH_FOR_ROLE, GLYPH_KINDS, handleGlyph } from '../puppet/handle-glyph.js';
import { handleBoardModel, resolveRigHandles } from '../puppet/handle-model.js';
import { hasPartGlyph, renderPartGlyph } from '../../ui/rig-controls/part-glyph.js';

/**
 * A control that looks like the thing it moves (V3-14, docs/FACE_CONTROL_RIG.md).
 *
 * Every control on the mascot used to be the same blue dot with a different
 * `title` on it, and the one word that said which was the one a pointer has to
 * sit still to show. Each one carries a picture of its own sub-part now, posed
 * by the very axes that control drives.
 */
const paths = new Set(['head', 'mouth', 'teeth', 'tongue', 'lidUpperLeft', 'lidLowerLeft', 'lidUpperRight', 'lidLowerRight', 'browLeft', 'browRight', 'nose', 'hair', 'hairTop', 'hairBack', 'shadeLeft', 'shadeRight', 'faceLight', 'shadeHair']);
const eyeChildren = (side) => [`eyeWhite${side}`, `pupil${side}`, `glint${side}`, `spark${side}`, `lidUpper${side}`, `lidLower${side}`, `rim${side}`];
const earChildren = (side) => [`ear${side}Shape`, `ear${side}Fold`];
const shadingChildren = ['shadeLeft', 'shadeRight', 'faceLight', 'shadeHair'];
const faceChildren = ['hairBack', 'earLeft', 'earRight', 'head', 'faceShading', ...shadingChildren,
  'mouth', 'tongue', 'teeth', 'eyeLeft', 'eyeRight', 'eyebrows', 'browLeft', 'browRight', 'nose', 'hairTop', 'hairFront', 'hair'];
const nested = { eyeLeft: eyeChildren('Left'), eyeRight: eyeChildren('Right'), faceShading: shadingChildren };
const topChildren = faceChildren.filter((id) => !shadingChildren.includes(id));
const ids = ['faceRoot', ...faceChildren, ...eyeChildren('Left'), ...eyeChildren('Right'), ...earChildren('Left'), ...earChildren('Right')];
const element = (id) => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: paths.has(id) ? 'path' : 'circle' } });

function project() {
  const state = createCleanProjectState();
  state.svgMarkup = PROJECT_TEMPLATES.basic.svg;
  state.elements = Object.fromEntries(ids.map((id) => [id, element(id)]));
  const leaf = (id) => ({ id, type: state.elements[id].meta.nodeType, name: id, children: [] });
  state.layers = [{ id: 'faceRoot', type: 'g', name: 'faceRoot', children: topChildren.map((id) => (nested[id]
    ? { id, type: 'g', name: id, children: nested[id].map(leaf) }
    : leaf(id))) }];
  applyTemplateProject(state);
  return state;
}
const byId = (state) => Object.fromEntries(resolveRigHandles(state).map((handle) => [handle.id, handle]));

test('every important sub-part of the face has a control that shows it', () => {
  const handles = byId(project());
  const kinds = Object.fromEntries(Object.entries(handles).map(([id, handle]) => [id, handleGlyph(handle, {})?.kind]));
  // The parts the ask named, and the ones beside them: the mouth, the tongue,
  // the teeth, the eyes, the brows, the pupils and the jaw.
  assert.deepEqual([kinds.mouth, kinds.tongue, kinds.teeth, kinds.eyes, kinds.eyebrows, kinds.gaze, kinds.jaw],
    ['mouth', 'tongue', 'teeth', 'eye', 'brow', 'pupil', 'jaw']);
  assert.deepEqual([kinds.nose, kinds.hair, kinds.ears, kinds.head], ['nose', 'hair', 'ear', 'head']);
  // One picture per pair of sides: a left brow and a right brow are brows.
  assert.equal(kinds.browLeft, kinds.browRight);
  assert.equal(kinds.eyeLeft, kinds.eyeRight);
  assert.equal(kinds.pupilLeft, kinds.pupilRight);
  // Every control the face carries has one, so nothing is left as a bare dot.
  assert.deepEqual(Object.entries(kinds).filter(([, kind]) => !kind).map(([id]) => id), []);
  // The teeth had no control at all: they were a movement of the mouth with a
  // slider in a panel and nothing on the mascot (V3-14).
  assert.equal(handles.teeth.y.control, 'teeth');
  assert.equal(handles.tongueShow.y.control, 'tongue');
});

test('the picture is chosen by the role of the artwork, never by the control it is on', () => {
  // Roles are the registry's own word for what a piece of a face is, so a
  // mascot whose mouth is called something else still gets a mouth, and a part
  // nobody has a picture for gets none rather than a wrong one.
  assert.equal(GLYPH_FOR_ROLE.leftBrow, 'brow');
  assert.equal(handleGlyph({ role: 'element' }, {}), null);
  assert.equal(handleGlyph({}, {}), null);
  assert.equal(handleGlyph(null, {}), null);
  for (const kind of GLYPH_KINDS) assert.ok(hasPartGlyph(kind), `${kind} has no drawing`);
  assert.equal(hasPartGlyph('spleen'), false);
});

test('the picture is posed by the very axes the control drives, and reads screen-wards', () => {
  const handles = byId(project());
  // `eyeOpen` rests wide and counts *down* as the lid closes, and the control
  // is inverted so that a drag down shuts it. The picture follows the drag,
  // not the number: one lid closes downwards whatever its movement counts.
  assert.equal(handleGlyph(handles.eyes, { eyeOpen: 1 }).y, 0, 'at rest, nothing has moved');
  assert.equal(handleGlyph(handles.eyes, { eyeOpen: 0 }).y, 1, 'shut is all the way down');
  // The mouth counts up as it opens and is not inverted, and lands in the same
  // place: down is down on both of them.
  assert.equal(handleGlyph(handles.mouth, { mouthOpen: 1, smile: -1 }).y, 1);
  assert.equal(handleGlyph(handles.mouth, { mouthOpen: 1, smile: -1 }).x, -1);
  // A movement that rests in the middle of an odd range still reads as "all
  // the way" at its own far end: `pupilScale` runs 0.4 → 1.6 and rests at 1.
  assert.equal(handleGlyph(handles.pupilScale, { pupilScale: 1.6 }).y, -1, 'dilated is dragged outwards');
  assert.equal(handleGlyph(handles.pupilScale, { pupilScale: 0.4 }).y, 1);
  assert.equal(handleGlyph(handles.pupilScale, {}).y, 0);
  // How a control is *operated* decides what its picture does with the drag: a
  // ring is a size and a target is a place, on the same pair of pupils.
  assert.equal(handleGlyph(handles.pupilScale, {}).controller, 'radial');
  assert.equal(handleGlyph(handles.gaze, {}).controller, 'target');
  // A turn is a turn: the tilt's picture is swung by its orbit and nothing else.
  assert.equal(handleGlyph(handles.headTilt, { headTilt: 1 }).orbit, 1);
});

test('the same picture is on the mascot and in the board, and it says nothing out loud', () => {
  const board = handleBoardModel(project(), { eyeOpen: 0 });
  const rows = board.layers.flatMap((layer) => layer.items);
  const eyes = rows.find((row) => row.id === 'eyes');
  assert.equal(eyes.glyph.kind, 'eye');
  assert.equal(eyes.glyph.y, 1, 'the row and the handle are posed from the same values');

  const markup = renderPartGlyph(eyes.glyph);
  assert.match(markup, /data-part-glyph="eye"/);
  assert.match(markup, /aria-hidden="true"/, 'the control already says what it is in words');
  assert.match(markup, /currentColor/, 'so a control keeps whichever of the six colours it was given');
  assert.equal(renderPartGlyph(null), '', 'a control with no picture draws no picture');
  assert.equal(renderPartGlyph({ kind: 'spleen' }), '');

  // The drawing changes as the movement does -- that is the whole of the idea,
  // and a picture that did not would be an icon with extra steps.
  const open = renderPartGlyph(handleGlyph(resolveRigHandles(project()).find((handle) => handle.id === 'eyes'), { eyeOpen: 1 }));
  assert.notEqual(open, markup);
  // Every kind draws something, whatever it is handed.
  for (const kind of GLYPH_KINDS) assert.match(renderPartGlyph({ kind, x: 0.5, y: -0.5, orbit: 1, controller: 'pad' }), /<path|<circle|<g /);
});
