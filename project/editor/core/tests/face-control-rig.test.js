import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { PROJECT_TEMPLATES, applyTemplateProject } from '../sample/templates/index.js';
import { compileRigFrame } from '../../../runtime/runtime.js';
import { resolveRigHandles } from '../puppet/handle-model.js';
import { puppetDragValues, puppetRestValues } from '../puppet/puppet-handles.js';
import { RIG_CONTROL_GROUPS, RIG_CONTROL_MODES, rigControlGroups, rigControlSummary } from '../puppet/control-groups.js';
import { RIG_CONTROL_LINKS, linkedParameter, normalizeRigLinks, rigLinkModel, toggleRigLink } from '../puppet/control-links.js';
import { RIG_CONTROL_WIDGETS } from '../puppet/handle-record.js';
import { enableGazeSolver } from '../rig/gaze-rig.js';
import { resetSemanticCalibration } from '../../rig-editor/semantic-parts/part-model.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { createControlRig } from '../../../runtime/runtime.js';
import {
  RADIAL_INNER, RADIAL_OUTER, place, radialAxis, radialFraction, radialRadius,
  renderCage, renderRadialControl, renderTargetControl, valueAt
} from '../../ui/rig-controls/index.js';
import { CONTROL_GAP, controlSpot, packControls } from '../puppet/control-packing.js';
import { TEMPLATE_ROLE_BOXES } from '../face-library/face-layout.js';

/**
 * The face control rig, as an animator meets it (docs/FACE_CONTROL_RIG.md).
 *
 * The shape of a control says what it does, controls belong to the part of the
 * face they pose, and a link decides whether the two sides move together. None
 * of that changes the rig underneath, which is the property this file is here
 * to hold on to.
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

const byId = (state) => Object.fromEntries(resolveRigHandles(state).map((handle) => [handle.id, handle]));
const pose = (state, values) => compileRigFrame(state.elements, { ...state.params, ...values });

test('the two eyes can disagree, and the pupils have a size (CR-07, CR-08)', () => {
  const state = project();
  // Convergence: each pupil is aimed on its own, so they can look at the same
  // near point instead of both staring at the same far one.
  const converged = pose(state, { lookX: 0, lookXLeft: 0.5, lookXRight: -0.5 });
  assert.ok(converged.pupilLeft.transform.x > 0, 'the left pupil comes in');
  assert.ok(converged.pupilRight.transform.x < 0, 'and the right one comes the other way');
  // The shared control keeps exactly the meaning it had: both pupils move.
  const together = pose(state, { lookX: 0.8 });
  assert.equal(together.pupilLeft.transform.x, together.pupilRight.transform.x);
  assert.ok(together.pupilLeft.transform.x > 0);

  // A dilating pupil writes both scale axes: one alone would be an oval.
  const rest = pose(state, {});
  assert.equal(rest.pupilLeft.transform.scaleX, 1);
  assert.equal(rest.pupilLeft.transform.scaleY, 1);
  const wide = pose(state, { pupilScale: 1.6 });
  assert.equal(wide.pupilLeft.transform.scaleX, 1.6);
  assert.equal(wide.pupilLeft.transform.scaleY, 1.6, 'a pupil is round at every size');
  // And one pupil can dilate on its own.
  const one = pose(state, { pupilScale: 1, pupilScaleLeft: 0.4 });
  assert.equal(one.pupilLeft.transform.scaleX, 1.4);
  assert.equal(one.pupilRight.transform.scaleX, 1);
});

test('a brow can be raised and turned on its own (CR-18)', () => {
  const state = project();
  const tilted = pose(state, { browTilt: 0, browTiltLeft: 1 });
  assert.notEqual(tilted.browLeft.transform.rotation, 0);
  assert.equal(tilted.browRight.transform.rotation, 0, 'the other brow is untouched');
  const handles = byId(state);
  assert.equal(handles.browTiltLeft.widget.controller, 'arc', 'a turn is an arc');
  assert.equal(handles.browTiltLeft.orbit.control, 'browTiltLeft');
});

test('each control gets the shape its own movement deserves (CR-02)', () => {
  const handles = byId(project());
  assert.equal(handles.gaze.widget.controller, 'target', 'a gaze is a place, not two sliders');
  assert.equal(handles.gazeLeft.widget.controller, 'target');
  assert.equal(handles.pupilScale.widget.controller, 'radial', 'a size is a ring');
  assert.equal(handles.pupilScale.widget.shape, 'ring', 'and it is drawn as one on the mascot too');
  assert.equal(handles.eyes.widget.controller, 'slider');
  assert.equal(handles.eyebrows.widget.controller, 'pad');
  assert.equal(handles.headTilt.widget.controller, 'arc');
  // The whole vocabulary, in one place, including the one that drives nothing.
  assert.ok(RIG_CONTROL_WIDGETS.includes('cage'));
  for (const kind of ['target', 'pad', 'slider', 'radial', 'arc', 'chips', 'locked']) assert.ok(RIG_CONTROL_WIDGETS.includes(kind), kind);
});

test('the controls belong to the part of the face they pose (CR-03, CR-04)', () => {
  const state = project();
  const groups = rigControlGroups(state, {});
  assert.deepEqual(groups.map((group) => group.id), ['head-rig', 'eye-rig', 'brow-rig', 'mouth-rig', 'loose']);

  const eyes = groups.find((group) => group.id === 'eye-rig');
  // Simple is one control per thing you pose: where it is looking, and whether
  // the eyes are open. Everything that refines those is Detailed.
  assert.deepEqual(eyes.controls.map((row) => row.id), ['gaze', 'eyes']);
  assert.deepEqual(eyes.detail.map((row) => row.id).sort(),
    ['eyeLeft', 'eyeRight', 'gazeLeft', 'gazeRight', 'pupilLeft', 'pupilRight', 'pupilScale']);
  assert.equal(eyes.count, 9);
  assert.ok(eyes.controls.every((row) => row.members === undefined), 'a control in a cage carries a count, not a nest');

  // A collapsed cage still says what is inside it.
  assert.equal(rigControlSummary(eyes), 'at rest');
  assert.match(rigControlSummary(rigControlGroups(state, { eyeOpen: 0.3 }).find((group) => group.id === 'eye-rig')), /open \/ close/);

  // Every cage is declared, and Simple/Detailed is a way of looking rather than
  // a property of the rig: nothing about it is stored on the project.
  for (const group of groups) assert.ok(group.id === 'loose' || RIG_CONTROL_GROUPS.some((item) => item.id === group.id), group.id);
  assert.deepEqual(RIG_CONTROL_MODES.map((mode) => mode.id), ['simple', 'detailed', 'rig', 'animate']);
  assert.equal('rigControlGroups' in state, false);
});

test('a link decides which parameter a control writes, and nothing else (CR-10)', () => {
  const state = project();
  // Off by default: a per-side control exists to move one side.
  assert.deepEqual(normalizeRigLinks(state), []);
  assert.equal(byId(state).eyeLeft.y.control, 'eyeOpenLeft');
  assert.equal(byId(state).gazeLeft.x.control, 'lookXLeft');

  const linked = { ...state, rigLinks: toggleRigLink(state, 'eyelids', true) };
  assert.deepEqual(linked.rigLinks, ['eyelids']);
  const handle = byId(linked).eyeLeft;
  assert.equal(handle.y.control, 'eyeOpen', 'the same control now writes the shared movement');
  assert.equal(handle.linked, true);
  assert.equal(handle.link, 'eyelids');
  // The drag, the keyboard and the reset all follow, because the only thing
  // that changed is which parameter the axis names.
  assert.deepEqual(Object.keys(puppetDragValues(handle, { dx: 0, dy: 8 }, { size: 40, start: { eyeOpen: 1 } })), ['eyeOpen']);
  assert.deepEqual(puppetRestValues(handle), { eyeOpen: 1 });

  // Nothing about the rig moved: the parameters, the bindings and the frame a
  // pose compiles to are identical either way.
  assert.deepEqual(Object.keys(state.params).sort(), Object.keys(linked.params).sort());
  assert.deepEqual(pose(linked, { eyeOpen: 0.4 }).eyeLeft, pose(state, { eyeOpen: 0.4 }).eyeLeft);

  // The rule itself, and what a panel draws from it.
  assert.equal(linkedParameter(linked, 'eyeOpen', 'eyeOpenLeft'), 'eyeOpen');
  assert.equal(linkedParameter(state, 'eyeOpen', 'eyeOpenLeft'), 'eyeOpenLeft');
  const model = rigLinkModel(linked);
  assert.deepEqual(model.map((link) => [link.id, link.linked]),
    [['eyelids', true], ['eyeTargets', false], ['pupils', false], ['brows', false], ['mouthCorners', false]]);
  // A link whose movements the project has not got is not offered.
  assert.deepEqual(rigLinkModel({ params: { eyeOpen: {} } }).map((link) => link.id), ['eyelids']);
  // And rubbish never becomes one.
  assert.deepEqual(normalizeRigLinks({ rigLinks: ['eyelids', 'eyelids', 'wheels', 7] }), ['eyelids']);
  assert.deepEqual(toggleRigLink(linked, 'eyelids', false), []);
  for (const link of RIG_CONTROL_LINKS) assert.ok(link.controls.length > 0, link.id);
});

test('the common target drives the solver when there is one, and the eyes when there is not (CR-06, CR-53)', () => {
  // The template ships the solver on (V3-12), so the *un*-solved case is the
  // one that has to be built: a project whose author turned it off, or one
  // drawn before it existed. The target is then the eyes' own control, exactly
  // as it always was.
  const state = project();
  const plain = structuredClone(state);
  plain.gazeSolver = null;
  assert.deepEqual([byId(plain).gaze.x.control, byId(plain).gaze.y.control], ['lookX', 'lookY']);

  const solving = structuredClone(state);
  enableGazeSolver(solving);
  assert.deepEqual([byId(solving).gaze.x.control, byId(solving).gaze.y.control], ['gazeX', 'gazeY']);
  assert.deepEqual([byId(state).gaze.x.control, byId(state).gaze.y.control], ['gazeX', 'gazeY'], 'and the shipped mascot is already solving');
  // The eyes' own control is still there to correct with — the solver adds to
  // it, so an author who keyed `lookX` has not lost anything.
  assert.ok(solving.params.lookX);
  assert.equal(byId(solving).gazeLeft.x.control, 'lookXLeft');
});

test('a ring reads outwards, never upwards', () => {
  const axis = { min: 0.4, max: 1.6, rest: 1, value: 1.6, invert: true, snap: 0, key: 'y', control: 'pupilScale', label: 'Pupil size' };
  // The pupil handles are inverted so a vertical drag *up* dilates. A ring has
  // no up, so the flag is dropped: the widest pupil draws the widest ring.
  assert.equal(place(axis), 0, 'inverted, the raw placement reads backwards');
  assert.equal(place(radialAxis(axis)), 1);
  assert.ok(radialRadius(radialAxis(axis)) > radialRadius(radialAxis({ ...axis, value: 0.4 })));
  // The hole in the middle is real: a ring dragged to nothing collapses the
  // artwork it scales and leaves nowhere to grab it again.
  assert.ok(RADIAL_INNER > 0 && RADIAL_OUTER > RADIAL_INNER);
  const box = { left: 0, top: 0, width: 100, height: 100 };
  assert.equal(radialFraction(box, { clientX: 50, clientY: 50 }), 0, 'the middle is the smallest it goes');
  assert.equal(radialFraction(box, { clientX: 100, clientY: 50 }), 1, 'and the edge is the largest');
  assert.equal(valueAt(radialAxis(axis), radialFraction(box, { clientX: 50, clientY: 50 })), 0.4);
});

test('every shape draws itself, and says how it is operated', () => {
  const x = { min: -1, max: 1, rest: 0, value: 0.5, invert: false, snap: 0, key: 'x', control: 'gazeX', label: 'Look at · left / right' };
  const y = { ...x, key: 'y', control: 'gazeY', label: 'Look at · up / down', value: -0.5 };
  const target = renderTargetControl({ id: 'gaze', axes: [x, y] }, x, y, { live: true, describe: () => ' tabindex="0"' });
  assert.match(target, /data-handle-drag="target"/);
  assert.match(target, /class="target-dot"/);
  assert.match(target, /--x:75%/, 'the dot sits where the value is');
  assert.match(target, /--y:25%/);

  const ring = renderRadialControl({ id: 'pupilScale', axes: [] }, { min: 0.4, max: 1.6, rest: 1, value: 1, invert: false, snap: 0, key: 'y', control: 'pupilScale', label: 'Pupil size' }, { live: true });
  assert.match(ring, /data-handle-drag="radial"/);
  assert.match(ring, /role="slider"/, 'and a keyboard can still reach it');

  const cage = renderCage({ id: 'eye-rig', label: 'Eyes', hint: 'What it is looking at.', detail: [{ id: 'gazeLeft' }], links: [{ id: 'eyelids', label: 'Eyelids', linked: false }] },
    { summary: 'at rest', collapsed: true, body: '<i>controls</i>', detail: '<i>detail</i>' });
  assert.match(cage, /data-rig-cage="eye-rig"/);
  assert.match(cage, /data-rig-detail="simple"/);
  assert.match(cage, /data-rig-expand="eye-rig"/);
  assert.match(cage, /data-rig-link="eyelids"/);
  assert.doesNotMatch(cage, /<i>detail<\/i>/, 'a collapsed cage is not a detailed one with the lid on');
  assert.match(renderCage({ id: 'eye-rig', label: 'Eyes', detail: [{}], links: [] }, { collapsed: false, detail: '<i>detail</i>' }), /<i>detail<\/i>/);
});

test('no two controls sit on the same point while both are on screen', () => {
  // The failure this catches is invisible in a screenshot and total in use: two
  // handles on one point means the one painted on top takes every drag, and the
  // other simply cannot be reached. It is how the tongue's target ended up
  // swallowing the mouth's own control.
  const handles = resolveRigHandles(project());
  const spot = (handle) => `${[...(handle.elements || [])].sort().join('+')}@${handle.at}`;
  const places = new Map();
  for (const handle of handles) {
    // A member is folded away until its own group is opened, so it can only
    // collide with something that is open at the same time it is.
    const key = `${spot(handle)}|${handle.group || ''}`;
    if (!places.has(key)) places.set(key, []);
    places.get(key).push(handle.id);
  }
  const clashes = [...places].filter(([, ids]) => ids.length > 1).map(([key, ids]) => `${ids.join(' and ')} both sit at ${key.split('|')[0]}`);
  assert.deepEqual(clashes, []);
  // And Simple really is simple: eleven controls on the face, not twenty-eight.
  assert.equal(handles.filter((handle) => !handle.group).length, 11);
  assert.ok(handles.length > 25, 'with the rest a group away');
});

/**
 * The template's artwork as the browser measures it on the canvas.
 *
 * The layout's own table for the parts it covers -- these are measurements,
 * not guesses (`core/face-library/face-layout.js`) -- with the pieces drawn
 * *inside* those parts measured beside it, the way the fake canvas does it.
 * A mouth is sixty-six units across and five and a half tall, and the teeth
 * and the tongue live inside that: there is no room in it for nine controls,
 * which is the whole of the problem.
 */
const FACE_BOXES = Object.freeze({
  faceRoot: { x: 0.65, y: 0, width: 238.8, height: 210 },
  head: TEMPLATE_ROLE_BOXES.head,
  eyeLeft: TEMPLATE_ROLE_BOXES.leftEye, eyeRight: TEMPLATE_ROLE_BOXES.rightEye,
  pupilLeft: { x: 72.5, y: 102.5, width: 21, height: 21 }, pupilRight: { x: 146.5, y: 102.5, width: 21, height: 21 },
  browLeft: TEMPLATE_ROLE_BOXES.leftBrow, browRight: TEMPLATE_ROLE_BOXES.rightBrow,
  nose: TEMPLATE_ROLE_BOXES.nose, mouth: TEMPLATE_ROLE_BOXES.mouth,
  teeth: { x: 96, y: 172.5, width: 48, height: 5 }, tongue: { x: 99, y: 173, width: 42, height: 5 },
  earLeft: TEMPLATE_ROLE_BOXES.leftEar, hair: TEMPLATE_ROLE_BOXES.hair
});

/**
 * The three widths the stylesheet gives a control, which are pixels whatever
 * the zoom — and a control is a *box* of that size, which is exactly what the
 * browser suite measures with `getBoundingClientRect`.
 */
const HIT = Object.freeze({ small: 19, normal: 26, large: 32 });
const room = (size) => ({ width: HIT[size] || HIT.normal, height: HIT[size] || HIT.normal });

/** Where every control on screen would like to be, at a given zoom. */
function wantedControls(handles, zoom) {
  return handles.map((handle) => {
    const boxes = handle.elements.map((id) => FACE_BOXES[id]).filter(Boolean);
    if (!boxes.length) return null;
    const left = Math.min(...boxes.map((box) => box.x)), top = Math.min(...boxes.map((box) => box.y));
    const rect = {
      x: left * zoom, y: top * zoom,
      width: (Math.max(...boxes.map((box) => box.x + box.width)) - left) * zoom,
      height: (Math.max(...boxes.map((box) => box.y + box.height)) - top) * zoom
    };
    return { id: handle.id, ...controlSpot(rect, handle.at, handle.offset), ...room(handle.widget.size) };
  }).filter(Boolean);
}

/** Every pair of controls whose boxes meet, which is every pair that cannot both be used. */
function covering(placed, wanted, gap = CONTROL_GAP) {
  const box = new Map(wanted.map((item) => [item.id, item]));
  const clashes = [];
  for (const [index, one] of placed.entries()) {
    for (const other of placed.slice(index + 1)) {
      const across = (box.get(one.id).width + box.get(other.id).width) / 2 + gap;
      const down = (box.get(one.id).height + box.get(other.id).height) / 2 + gap;
      if (Math.abs(one.x - other.x) + 1e-6 < across && Math.abs(one.y - other.y) + 1e-6 < down) clashes.push(`${one.id} over ${other.id}`);
    }
  }
  return clashes;
}

test('no control on the face can cover another, at any zoom (V3-14)', () => {
  // The test above catches two controls that were *authored* onto one spot.
  // This one catches the failure that authoring cannot see: a control is a
  // button of a fixed size in pixels and its position scales with the mascot,
  // so "beside the mouth" and "the middle of the mouth" are the same place on
  // a small enough drawing -- and then the one painted on top takes every drag
  // and the other cannot be reached at all.
  const handles = resolveRigHandles(project());
  for (const zoom of [1, 2.5]) {
    const wanted = wantedControls(handles, zoom);
    assert.equal(wanted.length, handles.length, 'every control is on artwork this test can measure');
    // Placing each control on its own spot and stopping there really does pile
    // them up: this is what the canvas did, and what it must not do again.
    assert.ok(covering(wanted, wanted).length > 0, `at ${zoom}x, spots alone leave controls on top of each other`);

    const placed = packControls(wanted);
    assert.deepEqual(covering(placed, wanted), [], `at ${zoom}x`);
    // The boxes miss with the air between them taken away too, which is the
    // property the browser suite measures with `getBoundingClientRect`.
    assert.deepEqual(covering(placed, wanted, 0), [], `at ${zoom}x, as the browser measures them`);
    // And a control that had to move is still on the part it moves: it steps
    // aside, it does not leave.
    for (const [index, item] of placed.entries()) {
      const away = Math.hypot(item.x - wanted[index].x, item.y - wanted[index].y);
      assert.ok(away <= 4 * (room('large').width + CONTROL_GAP), `${item.id} was pushed ${Math.round(away)}px from its own artwork`);
    }
  }
});

test('the controls a face carries before any group is opened never meet either', () => {
  // Simple mode draws the cages' own controls and folds the rest away, so that
  // is a set of its own and it has to hold on its own.
  const simple = resolveRigHandles(project()).filter((handle) => !handle.group);
  const wanted = wantedControls(simple, 1);
  assert.deepEqual(covering(packControls(wanted), wanted), []);
});

test('a project that authored nothing still stores nothing (CR-52)', () => {
  // The invariant is that *reading* the rig never writes defaults into it. A
  // blank project is where "authored nothing" is literally true, and it has no
  // solver: `enableGazeSolver` is what puts one there. The template is not a
  // blank project -- it ships a head turn, followers, hands and clips on
  // purpose, and since V3-12 a gaze solver among them.
  assert.equal(createCleanProjectState().gazeSolver, null, 'no solver until one is asked for');

  const state = project();
  assert.deepEqual(state.rigHandles, []);
  assert.deepEqual(state.rigLinks, []);
  assert.equal(state.gazeSolver?.enabled, true, 'the shipped mascot looks with its head (V3-12)');
  const before = structuredClone(state);
  resolveRigHandles(state);
  rigControlGroups(state, {});
  rigLinkModel(state);
  assert.deepEqual(state, before, 'reading the rig never writes to it');
});

/**
 * A lid is the one movement in the registry that rests at its **maximum**:
 * `eyeOpen` sits at 1 and closing counts down to 0. Every other control rests
 * at 0 and moves either way from there, which is why the generic `translate`
 * default -- amplitude `+8`, offset `0` -- was wrong for exactly this one and
 * nothing else.
 *
 * Pressing Reset on the movement was the way to meet it: the rebuild goes back
 * to the registry's own numbers, so a lid came away hanging 8px over the open
 * eye and retracting to nothing as it shut. A blink played backwards, and next
 * to a lower lid that still closed properly, a mess.
 */
test('Reset on a lid gives back a lid that shuts downwards, not one that retracts', () => {
  const state = createTemplateProjectState();
  const lids = Object.values(state.semanticParts).find((part) => part.type === 'eyelids');
  const upper = () => state.elements.lidUpperLeft.bindings.translateY;
  const at = (binding, eyeOpen) => binding.amplitude * eyeOpen + binding.offset;

  assert.equal(at(upper(), 1), 0, 'as shipped: the drawing sits where it was drawn with the eye open');
  assert.ok(at(upper(), 0) > 0, 'and comes down to shut it');

  resetSemanticCalibration(state, lids.id, 'eyeOpen');

  assert.equal(at(upper(), 1), 0, 'reset keeps the lid where the drawing has it when the eye is open');
  assert.ok(at(upper(), 0) > 0, 'and it still travels downwards to shut -- the sign is the whole bug');
  assert.ok(upper().amplitude < 0, 'which for a control resting at its maximum means a negative amplitude');
});

/**
 * The eyes carry the head (V3-12).
 *
 * Looking at something is one movement of the whole character. An author who
 * has to key the eyes and then remember to key the head is being asked to do
 * the solver's arithmetic by hand, and a mascot whose head never follows its
 * eyes reads as a doll with loose eyes rather than a character paying
 * attention.
 *
 * The important half is that it is a **sum**: the solved head angle is added
 * to `headX`, so the independent head control is not taken away by switching
 * this on. That is what makes the default safe.
 */
test('the template looks with its whole head, and a head angle of one\'s own still wins', () => {
  const state = createTemplateProjectState();
  assert.equal(state.gazeSolver?.enabled, true, 'the mascot ships looking with its head');
  assert.deepEqual([state.params.gazeX?.default, state.params.gazeY?.default], [0, 0], 'and at rest, so nothing moves until the target does');

  const rig = createControlRig(state);
  const base = Object.fromEntries(Object.entries(state.params).map(([name, parameter]) => [name, parameter.default ?? 0]));
  // Two seconds is past `headLag` and `headSettle`, so the head has arrived.
  const settled = (over) => { let out = null; for (let frame = 0; frame < 120; frame += 1) out = rig.step({ ...base, ...over }, 1 / 60); return out.values ?? out; };
  const round = (value) => Math.round(Number(value) * 1000) / 1000;

  assert.deepEqual([round(settled({}).lookX), round(settled({}).headX)], [0, 0], 'at rest the mascot is exactly as it was');

  // A glance is the eyes alone: that is what the dead zone buys.
  const glance = settled({ gazeX: 0.1 });
  assert.ok(glance.lookX > 0, 'the eyes go');
  assert.equal(round(glance.headX), 0, 'and the head does not, for a gaze this small');

  // A look is both.
  const look = settled({ gazeX: 1 });
  assert.ok(look.lookX > 0.5 && look.headX > 0.25, 'a full look turns the eyes and the head');

  // And the head angle an author writes is added to the solver's, not replaced
  // by it -- the whole reason turning this on by default is safe.
  const corrected = settled({ gazeX: 1, headX: -0.5 });
  assert.equal(round(corrected.headX), round(look.headX - 0.5), 'a head angle of one\'s own is added, never overridden');
  assert.equal(round(settled({ headX: 0.5 }).headX), 0.5, 'and with no gaze at all it is the only thing moving the head');
});
