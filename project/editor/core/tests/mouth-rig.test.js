import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRigFrame, normalizeRigPins, parsePath } from '../../../runtime/runtime.js';
import { createCleanProjectState } from '../state/store.js';
import { PROJECT_TEMPLATES, applyTemplateProject } from '../sample/templates/index.js';
import { MOUTH_RIG_PARAMETERS, enableMouthRig, generateMouthPins, hasMouthRig, mouthReadout, withoutMouthRig } from '../rig/mouth-rig.js';
import { resolveRigHandles } from '../puppet/handle-model.js';
import { rigControlGroups } from '../puppet/control-groups.js';
import { SEMANTIC_PART_REGISTRY } from '../../rig-editor/semantic-parts/part-registry.js';

/**
 * The mouth and the tongue (docs/FACE_CONTROL_RIG.md, CR-27 … CR-34).
 *
 * `smile` is one number, and a face that can only smile symmetrically has one
 * expression where it should have a dozen. Every smirk, grimace and lip pulled
 * by a word is the two corners disagreeing.
 */
const paths = new Set(['head', 'mouth', 'teeth', 'tongue', 'lidUpperLeft', 'lidLowerLeft', 'lidUpperRight', 'lidLowerRight', 'browLeft', 'browRight', 'nose', 'hair', 'hairTop', 'hairBack', 'shadeLeft', 'shadeRight']);
const eyeChildren = (side) => [`eyeWhite${side}`, `pupil${side}`, `glint${side}`, `lidUpper${side}`, `lidLower${side}`, `rim${side}`];
const earChildren = (side) => [`ear${side}Shape`, `ear${side}Fold`];
const faceChildren = ['hairBack', 'earLeft', 'earRight', 'head', 'shadeLeft', 'shadeRight',
  'mouth', 'tongue', 'teeth', 'eyeLeft', 'eyeRight', 'eyebrows', 'browLeft', 'browRight', 'nose', 'hairTop', 'hairFront', 'hair'];
const ids = ['faceRoot', ...faceChildren, ...eyeChildren('Left'), ...eyeChildren('Right'), ...earChildren('Left'), ...earChildren('Right')];
const element = (id) => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: paths.has(id) ? 'path' : 'circle' } });

function project() {
  const state = createCleanProjectState();
  state.svgMarkup = PROJECT_TEMPLATES.basic.svg;
  state.elements = Object.fromEntries(ids.map((id) => [id, element(id)]));
  const leaf = (id) => ({ id, type: state.elements[id].meta.nodeType, name: id, children: [] });
  state.layers = [{ id: 'faceRoot', type: 'g', name: 'faceRoot', children: faceChildren.map((id) => (id === 'eyeLeft' || id === 'eyeRight'
    ? { id, type: 'g', name: id, children: eyeChildren(id === 'eyeLeft' ? 'Left' : 'Right').map(leaf) }
    : leaf(id))) }];
  applyTemplateProject(state);
  return state;
}

/** The four control points of the lip line, in order: left, top, right, bottom. */
const lips = (state, values) => {
  const path = compileRigFrame(state.elements, { ...state.params, ...values }, {}, {},
    { shapeKeys: state.shapeKeys, rigPins: state.rigPins }).mouth.path;
  const parsed = parsePath(path);
  return Array.from({ length: parsed.values.length / 2 }, (_, index) => ({ x: parsed.values[index * 2], y: parsed.values[index * 2 + 1] }));
};

test('the mouth has two corners that can disagree (CR-28, CR-29)', () => {
  const state = project();
  assert.equal(hasMouthRig(state), true, 'the template ships with the rig');
  for (const name of Object.keys(MOUTH_RIG_PARAMETERS)) assert.ok(state.params[name], name);

  // At rest it is the mouth that was drawn: every offset is 0.
  const rest = lips(state, {});
  const symmetric = lips(state, { smile: 1 });
  assert.ok(symmetric[0].y < rest[0].y, 'the shared smile lifts the left corner');
  assert.ok(Math.abs((symmetric[0].y - rest[0].y) - (symmetric[2].y - rest[2].y)) < 1e-6, 'and lifts both by the same amount');

  // A smirk: one corner further than the other, which is not reachable by
  // turning a single slider harder.
  const smirk = lips(state, { smile: 0.3, smileRight: 0.5 });
  const left = smirk[0].y - rest[0].y, right = smirk[2].y - rest[2].y;
  assert.ok(right < left, `the right corner is higher: left ${left}, right ${right}`);
  assert.ok(Math.abs(left - right) > 1, 'and the difference is visible, not a rounding error');

  // Each corner also widens on its own.
  const wide = lips(state, { mouthWidthLeft: 1 });
  assert.ok(wide[0].x < rest[0].x, 'the left corner moved outwards');
  assert.ok(Math.abs(wide[2].x - rest[2].x) < 1e-6, 'and the right one did not move at all');
});

test('mouth lock is how hard the lips refuse to follow the jaw (CR-30, CR-31)', () => {
  const state = project();
  const rest = lips(state, {});
  const dropped = lips(state, { jawOpen: 1 });
  assert.ok(dropped[3].y > rest[3].y, 'the jaw pulls the lower lip down');

  const locked = lips(state, { jawOpen: 1, mouthLock: 1 });
  assert.ok(Math.abs(locked[3].y - rest[3].y) < 1e-6, 'locked, the lips stay together however far the jaw drops');

  const half = lips(state, { jawOpen: 1, mouthLock: 0.5 });
  assert.ok(Math.abs((half[3].y - rest[3].y) - (dropped[3].y - rest[3].y) / 2) < 1e-6, 'and half a lock is half the drop');

  // The upper lip is not dragged down with it: a pin holds the artwork near it
  // and lets go, which is the whole reason a corner is a pin and not a
  // transform.
  assert.ok(Math.abs(dropped[1].y - rest[1].y) < Math.abs(dropped[3].y - rest[3].y) / 2, 'the top of the mouth barely moves');
});

test('the tongue is aimed, stuck out and curled (CR-32 … CR-34)', () => {
  const state = project();
  assert.ok(state.semanticParts.tongue, 'the tongue is a part of its own');
  assert.deepEqual(SEMANTIC_PART_REGISTRY.tongue.controls, ['tongueX', 'tongueY', 'tongueOut', 'tongueCurl']);
  const at = (values) => compileRigFrame(state.elements, { ...state.params, ...values }, {}, {}, { shapeKeys: state.shapeKeys }).tongue.transform;

  assert.equal(at({}).x, 0);
  assert.ok(at({ tongueX: 1 }).x > 0 && at({ tongueX: -1 }).x < 0, 'it aims left and right');
  assert.ok(at({ tongueY: 1 }).y > 0, 'and up and down');
  assert.ok(at({ tongueOut: 1 }).scaleY > at({}).scaleY, 'it comes out');
  assert.ok(at({ tongueCurl: 1 }).rotation !== 0, 'and it curls');
  // The mouth still decides whether the tongue *shows* at all: two questions,
  // two controls, and they do not fight because they write different properties.
  assert.ok(state.semanticParts.mouth.controls.includes('tongue'));
});

test('the mouth cage is one thing to pose, opening into the ones that refine it (CR-27)', () => {
  const state = project();
  const mouth = rigControlGroups(state, {}).find((group) => group.id === 'mouth-rig');
  assert.deepEqual(mouth.controls.map((row) => row.id), ['mouth', 'mouthWidth', 'jaw']);
  // The tongue is inside the mouth's own group: it is drawn there, and a tongue
  // target at the middle of the mouth would sit on top of the mouth's control.
  assert.deepEqual(mouth.detail.map((row) => row.id).sort(),
    ['mouthCornerLeft', 'mouthCornerRight', 'mouthLock', 'tongue', 'tongueCurl', 'tongueOut']);

  const handles = Object.fromEntries(resolveRigHandles(state).map((handle) => [handle.id, handle]));
  // A corner is a place, so it gets a target; a curl is a turn, so it gets an arc.
  assert.equal(handles.mouthCornerLeft.widget.controller, 'target');
  assert.equal(handles.tongue.widget.controller, 'target');
  assert.equal(handles.tongueCurl.widget.controller, 'arc');
  assert.equal(handles.mouthLock.widget.controller, 'slider');
  assert.deepEqual([handles.mouthCornerLeft.x.control, handles.mouthCornerLeft.y.control], ['mouthWidthLeft', 'smileLeft']);
});

test('the two corners can be linked, like every other pair of sides (CR-10, CR-28)', () => {
  const state = project();
  const corner = (document) => resolveRigHandles(document).find((handle) => handle.id === 'mouthCornerLeft');
  // Apart by default: a corner control exists precisely to move one corner.
  assert.deepEqual([corner(state).x.control, corner(state).y.control], ['mouthWidthLeft', 'smileLeft']);
  assert.equal(corner(state).link, 'mouthCorners');

  const linked = { ...state, rigLinks: ['mouthCorners'] };
  assert.deepEqual([corner(linked).x.control, corner(linked).y.control], ['mouthWidth', 'smile']);
  assert.equal(corner(linked).linked, true);
  // And dragging it now moves both, because it is writing the shared movement.
  const both = lips(linked, { smile: 1 });
  assert.ok(Math.abs((both[0].y - lips(linked, {})[0].y) - (both[2].y - lips(linked, {})[2].y)) < 1e-6);

  // The link is offered on the cage the corners belong to.
  const mouth = rigControlGroups(linked, {}).find((group) => group.id === 'mouth-rig');
  assert.deepEqual(mouth.links.map((link) => [link.id, link.linked]), [['mouthCorners', true]]);
});

test('the readout says the two corners disagree, because one number no longer describes the mouth', () => {
  assert.equal(mouthReadout({}), 'neutral');
  assert.equal(mouthReadout({ smile: 1 }), 'smiling');
  assert.equal(mouthReadout({ smile: -1 }), 'frowning');
  assert.match(mouthReadout({ smile: 0.3, smileRight: 0.5 }), /^right corner higher · 0.3 \/ 0.8$/);
  assert.match(mouthReadout({ smile: 0.5, mouthLock: 0.5 }), /lips 50% locked/);
});

test('the rig can be given, taken away and given again without leaving anything behind', () => {
  const rig = { elements: { mouth: { restPath: 'M 0 0 L 10 0 Z' } }, params: {}, states: { idle: {} }, rigPins: [{ id: 'mine', target: 'mouth', position: { x: 1, y: 1 } }] };
  enableMouthRig(rig, { target: 'mouth', box: { x: 0, y: 0, width: 40, height: 8 } });
  assert.equal(hasMouthRig(rig), true);
  assert.equal(rig.states.idle.mouthLock, 0, 'every state starts with the lips unlocked');
  const ids = rig.rigPins.map((pin) => pin.id);
  assert.deepEqual(ids, ['mine', 'mouth-corner-left', 'mouth-corner-right', 'mouth-lower-lip']);

  // Enabling twice replaces the rig rather than stacking a second copy of it.
  enableMouthRig(rig, { target: 'mouth', box: { x: 0, y: 0, width: 60, height: 8 } });
  assert.deepEqual(rig.rigPins.map((pin) => pin.id), ids);

  rig.rigPins = normalizeRigPins({ rigPins: withoutMouthRig(rig) });
  assert.deepEqual(rig.rigPins.map((pin) => pin.id), ['mine'], 'and the pin an author placed by hand survives');
  assert.equal(hasMouthRig(rig), false);
  // A mouth with no artwork or no size is refused rather than silently pinned.
  assert.deepEqual(generateMouthPins({ target: 'mouth' }), []);
  assert.throws(() => enableMouthRig({}, { target: null }), /artwork/);
});
