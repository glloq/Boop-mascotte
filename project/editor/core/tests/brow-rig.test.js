import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRigFrame, normalizeRigPins, parsePath } from '../../../runtime/runtime.js';
import { createCleanProjectState } from '../state/store.js';
import { PROJECT_TEMPLATES, applyTemplateProject } from '../sample/templates/index.js';
import { BROW_BOXES, BROW_RESTS } from '../sample/templates/face-artwork.js';
import { BROW_RIG_PARAMETERS, browReadout, enableBrowRig, generateBrowPins, hasBrowRig, withoutBrowRig } from '../rig/brow-rig.js';
import { resolveRigHandles } from '../puppet/handle-model.js';
import { rigControlGroups } from '../puppet/control-groups.js';

/**
 * The eyebrow's own shape (docs/FACE_CONTROL_RIG.md, CR-19).
 *
 * A brow that only raises and turns is a rigid bar hinged in the middle. Worry
 * and anger are the two ends of one brow disagreeing, and neither is reachable
 * by turning a raise or a tilt further.
 */
const paths = new Set(['head', 'mouth', 'teeth', 'tongue', 'lidUpperLeft', 'lidLowerLeft', 'lidUpperRight', 'lidLowerRight', 'browLeft', 'browRight', 'nose', 'hair', 'hairTop', 'hairBack', 'shadeLeft', 'shadeRight', 'faceLight', 'shadeHair']);
const eyeChildren = (side) => [`eyeWhite${side}`, `pupil${side}`, `glint${side}`, `spark${side}`, `lidUpper${side}`, `lidLower${side}`, `rim${side}`];
const earChildren = (side) => [`ear${side}Shape`, `ear${side}Fold`];
/** The shading is a folder of its own now, clipped to the head. */
const shadingChildren = ['shadeLeft', 'shadeRight', 'faceLight', 'shadeHair'];
const faceChildren = ['hairBack', 'earLeft', 'earRight', 'head', 'faceShading', ...shadingChildren,
  'mouth', 'tongue', 'teeth', 'eyeLeft', 'eyeRight', 'eyebrows', 'browLeft', 'browRight', 'nose', 'hairTop', 'hairFront', 'hair'];
/** The children the artwork nests, so a synthetic tree matches the drawn one. */
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

/** Every point of one brow, as drawn for a pose. */
const brow = (state, values, id = 'browLeft') => {
  const path = compileRigFrame(state.elements, { ...state.params, ...values }, {}, {},
    { shapeKeys: state.shapeKeys, rigPins: state.rigPins })[id].path;
  const parsed = parsePath(path);
  return Array.from({ length: parsed.values.length / 2 }, (_, index) => ({ x: parsed.values[index * 2], y: parsed.values[index * 2 + 1] }));
};

/**
 * The two ends of a brow and the arch between them, found by where they are
 * rather than by which index they happen to occupy.
 *
 * V1's brow was a stroked three-point curve, so a test could name its points.
 * V2's is a drawn shape with a tapered outer tip and a blunt inner end, and it
 * has nine — but the *rig* has not changed, and neither has what these tests
 * are about: whether the two ends of one brow can disagree. So they ask the
 * geometry where the ends are.
 */
const inner = (side) => (side === 'left' ? BROW_BOXES.left.box.x + BROW_BOXES.left.box.width : BROW_BOXES.right.box.x);
const outer = (side) => (side === 'left' ? BROW_BOXES.left.box.x : BROW_BOXES.right.box.x + BROW_BOXES.right.box.width);
const near = (points, x, reach = 6) => points.filter((point) => Math.abs(point.x - x) <= reach);
const height = (points) => points.reduce((total, point) => total + point.y, 0) / points.length;
/** How high one end of the brow is, averaged over the points that draw it. */
const end = (points, side, which) => height(near(points, which === 'inner' ? inner(side) : outer(side)));
/** And the arch, which is everything that is neither end. */
const arch = (points, side) => height(points.filter((point) =>
  Math.abs(point.x - inner(side)) > 6 && Math.abs(point.x - outer(side)) > 6));

test('each brow has two ends that can disagree (CR-19)', () => {
  const state = project();
  assert.equal(hasBrowRig(state), true, 'the template ships with the rig');
  for (const name of Object.keys(BROW_RIG_PARAMETERS)) assert.ok(state.params[name], name);

  // At rest it is the brow that was drawn: every offset is 0.
  const rest = brow(state, {});
  assert.deepEqual(rest.map((point) => [point.x, point.y]),
    Array.from({ length: parsePath(BROW_RESTS.browLeft).values.length / 2 },
      (_, index) => [parsePath(BROW_RESTS.browLeft).values[index * 2], parsePath(BROW_RESTS.browLeft).values[index * 2 + 1]]));

  // Worry: the inner end goes up and the outer end stays where it was drawn.
  const worry = brow(state, { browInnerLeft: 1 });
  const rose = end(rest, 'left', 'inner') - end(worry, 'left', 'inner');
  assert.ok(rose > 5, `the inner end rose: ${rose}`);
  assert.ok(Math.abs(end(worry, 'left', 'outer') - end(rest, 'left', 'outer')) < 1e-6, 'and the outer end did not move at all');
  // The artwork between them follows a little, or a raised end reads as a kink
  // rather than an eyebrow.
  const followed = arch(rest, 'left') - arch(worry, 'left');
  assert.ok(followed > 1 && followed < rose, `the arch follows, less than the end: ${followed} against ${rose}`);

  // Anger is the same control the other way, which is what makes it one control.
  const anger = brow(state, { browInnerLeft: -1 });
  assert.ok(end(anger, 'left', 'inner') - end(rest, 'left', 'inner') > 5, 'the inner end dropped');
  assert.ok(Math.abs(end(anger, 'left', 'outer') - end(rest, 'left', 'outer')) < 1e-6, 'and the outer end still did not move');

  // An end goes up and down and never sideways: the pin is directional.
  for (const point of [...worry, ...anger]) {
    assert.ok(rest.some((at) => Math.abs(at.x - point.x) < 1e-6), `x is untouched: ${point.x}`);
  }
});

test('the shared movement moves both brows, the offset moves one (CR-10, CR-19)', () => {
  const state = project();
  const restLeft = brow(state, {}), restRight = brow(state, {}, 'browRight');
  const both = { left: brow(state, { browInner: 1 }), right: brow(state, { browInner: 1 }, 'browRight') };
  const lift = (posed, rest, side) => end(rest, side, 'inner') - end(posed, side, 'inner');
  // Worry with one number: both inner ends, by the same amount. The left brow's
  // inner end is its right-hand end and the right brow's is its left-hand one.
  assert.ok(lift(both.left, restLeft, 'left') > 5);
  assert.ok(Math.abs(lift(both.left, restLeft, 'left') - lift(both.right, restRight, 'right')) < 1e-6, 'symmetrically');

  // And the offset adds to it rather than replacing it, so "both, except this
  // one further" is a pose the rig can reach.
  const uneven = brow(state, { browInner: 1, browInnerLeft: 0.5 });
  assert.ok(lift(uneven, restLeft, 'left') > lift(both.left, restLeft, 'left') + 1);
});

test('the brow ends link like every other pair of sides (CR-10)', () => {
  const state = project();
  const end = (document, id) => resolveRigHandles(document).find((handle) => handle.id === id);
  // Apart by default: an end control exists precisely to move one end.
  assert.equal(end(state, 'browInnerLeft').y.control, 'browInnerLeft');
  assert.equal(end(state, 'browInnerLeft').link, 'brows');
  assert.equal(end(state, 'browInnerLeft').linked, false);

  const linked = { ...state, rigLinks: ['brows'] };
  assert.equal(end(linked, 'browInnerLeft').y.control, 'browInner');
  assert.equal(end(linked, 'browOuterRight').y.control, 'browOuter');
  assert.equal(end(linked, 'browInnerLeft').linked, true);
  // Linked, the control writes the pair's movement, so it is named after the
  // pair rather than after the parameter it happens to be called.
  assert.equal(end(linked, 'browInnerLeft').y.label, 'Eyebrow inner ends');

  // One switch covers the whole brow: raise, tilt and both ends.
  const brows = rigControlGroups(linked, {}).find((group) => group.id === 'brow-rig');
  assert.deepEqual(brows.links.map((link) => [link.id, link.linked, link.controls]),
    [['brows', true, ['browRaise', 'browTilt', 'browInner', 'browOuter']]]);
});

test('the brow cage stays one thing to pose, with the ends a group away (CR-19)', () => {
  const state = project();
  const brows = rigControlGroups(state, {}).find((group) => group.id === 'brow-rig');
  assert.deepEqual(brows.controls.map((row) => row.id), ['eyebrows']);
  assert.deepEqual(brows.detail.map((row) => row.id).sort(),
    ['browInnerLeft', 'browInnerRight', 'browLeft', 'browOuterLeft', 'browOuterRight', 'browRight', 'browTiltLeft', 'browTiltRight']);

  const handles = Object.fromEntries(resolveRigHandles(state).map((handle) => [handle.id, handle]));
  // An end goes one way, so it is a slider; a tilt is a turn, so it is an arc.
  assert.equal(handles.browInnerLeft.widget.controller, 'slider');
  assert.equal(handles.browTiltLeft.widget.controller, 'arc');
  // And each end is grabbed where it is drawn: "inner" is the right-hand end of
  // the left brow and the left-hand end of the right one.
  assert.equal(handles.browInnerLeft.at, 'right');
  assert.equal(handles.browOuterLeft.at, 'left');
  assert.equal(handles.browInnerRight.at, 'left');
  assert.equal(handles.browOuterRight.at, 'right');
});

test('the readout tells worry from anger, because two numbers no longer describe a brow', () => {
  assert.equal(browReadout({}), 'at rest');
  assert.equal(browReadout({ browInner: 1 }), 'worried');
  assert.equal(browReadout({ browInner: -1 }), 'angry');
  assert.match(browReadout({ browInner: 0.3, browInnerLeft: 0.5 }), /^brows apart · inner 0.8 \/ 0.3$/);
  assert.match(browReadout({ browRaise: 0.5 }), /raised 0.5/);
});

test('the rig can be given, taken away and given again without leaving anything behind', () => {
  const boxes = {
    left: { target: 'browLeft', box: { x: 0, y: 0, width: 40, height: 6 } },
    right: { target: 'browRight', box: { x: 60, y: 0, width: 40, height: 6 } }
  };
  const rig = { elements: {}, params: {}, states: { idle: {} }, rigPins: [{ id: 'mine', target: 'browLeft', position: { x: 1, y: 1 } }] };
  enableBrowRig(rig, boxes);
  assert.equal(hasBrowRig(rig), true);
  assert.equal(rig.states.idle.browInner, 0, 'every state starts with the ends where they were drawn');
  const ids = rig.rigPins.map((pin) => pin.id);
  assert.deepEqual(ids, ['mine', 'brow-left-inner', 'brow-left-outer', 'brow-right-inner', 'brow-right-outer']);

  // Enabling twice replaces the rig rather than stacking a second copy of it.
  enableBrowRig(rig, boxes);
  assert.deepEqual(rig.rigPins.map((pin) => pin.id), ids);

  rig.rigPins = normalizeRigPins({ rigPins: withoutBrowRig(rig) });
  assert.deepEqual(rig.rigPins.map((pin) => pin.id), ['mine'], 'and the pin an author placed by hand survives');
  assert.equal(hasBrowRig(rig), false);
  // A brow with no artwork or no size is refused rather than silently pinned.
  assert.deepEqual(generateBrowPins({ target: 'browLeft' }), []);
  assert.throws(() => enableBrowRig({}, {}), /artwork/);
});
