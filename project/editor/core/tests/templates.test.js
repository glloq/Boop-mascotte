import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { validateRig } from '../validation/rig-validator.js';
import { PROJECT_TEMPLATES, applyTemplateProject } from '../sample/templates/index.js';
import { compileRigFrame } from '../../../runtime/runtime.js';

/**
 * Every id the artwork draws that the rigging then wires, in the tree it draws
 * them in: an eye is a group holding its own white, pupil, lids and outline,
 * and the turn reads that nesting (`docs/HEAD_POSE_2_5D.md`).
 */
const eyeChildren = (side) => [`eyeWhite${side}`, `pupil${side}`, `glint${side}`, `lidUpper${side}`, `lidLower${side}`, `rim${side}`];
const faceChildren = ['hairBack', 'earLeft', 'earRight', 'chin', 'head', 'shadeLeft', 'shadeRight', 'browShade',
  'blushLeft', 'blushRight', 'mouthInner', 'mouth', 'eyeLeft', 'eyeRight', 'eyebrows', 'browLeft', 'browRight', 'nose', 'hair'];
const ids = ['faceRoot', ...faceChildren, ...eyeChildren('Left'), ...eyeChildren('Right')];
const paths = new Set(['mouth', 'mouthInner', 'lidUpperLeft', 'lidLowerLeft', 'lidUpperRight', 'lidLowerRight', 'browLeft', 'browRight', 'nose', 'hair', 'hairBack', 'shadeLeft', 'shadeRight', 'browShade']);
const element = (id) => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: paths.has(id) ? 'path' : 'circle' } });
const loaded = () => {
  const state = createCleanProjectState();
  state.svgMarkup = PROJECT_TEMPLATES.basic.svg;
  state.elements = Object.fromEntries(ids.map((id) => [id, element(id)]));
  const leaf = (id) => ({ id, type: state.elements[id].meta.nodeType, name: id, children: [] });
  state.layers = [{ id: 'faceRoot', type: 'g', name: 'faceRoot', children: faceChildren.map((id) => (id === 'eyeLeft' || id === 'eyeRight'
    ? { id, type: 'g', name: id, children: eyeChildren(id === 'eyeLeft' ? 'Left' : 'Right').map(leaf) }
    : leaf(id))) }];
  return state;
};

test('there is one template, and it is a whole face', () => {
  assert.deepEqual(Object.keys(PROJECT_TEMPLATES), ['basic'], 'three starter faces became one complete one');
  const svg = PROJECT_TEMPLATES.basic.svg;
  for (const id of ids) assert.match(svg, new RegExp(`id="${id}"`), `the artwork should draw ${id}`);
  assert.doesNotMatch(svg, /<rect[^>]+fill="(?:#000(?:000)?|black)"/i);

  const state = loaded();
  applyTemplateProject(state);
  assert.deepEqual(validateRig(state), []);
  assert.ok(state.animationClips.length);
  for (const part of Object.values(state.semanticParts)) for (const id of Object.values(part.roles)) assert.ok(state.elements[id], `${part.id} points at missing ${id}`);
  assert.deepEqual(Object.keys(state.semanticParts).sort(), ['ears', 'eyebrows', 'eyelids', 'eyes', 'gaze', 'hair', 'head', 'mouth', 'nose']);
});

test('applying the template twice leaves no trace of the first pass', () => {
  const once = loaded(); applyTemplateProject(once);
  const twice = loaded(); applyTemplateProject(twice); applyTemplateProject(twice);
  assert.deepEqual(Object.keys(twice.semanticParts), Object.keys(once.semanticParts));
  assert.deepEqual(twice.animationClips.map((clip) => clip.id), once.animationClips.map((clip) => clip.id));
  assert.deepEqual(twice.keyforms.length, once.keyforms.length);
  assert.equal(twice.params.eyeOpen.value, 1);
});

test('the pupil sits behind the eyelid instead of fading out', () => {
  const state = loaded();
  applyTemplateProject(state);
  // The old rig faded the pupil away with `opacity <- eyeOpen`, which is why it
  // vanished rather than being covered. Nothing drives pupil opacity now: the
  // lids close over it, and the socket clip hides whatever leaves the eye.
  for (const id of ['pupilLeft', 'pupilRight']) assert.equal(state.elements[id].bindings.opacity, undefined);
  assert.match(state.svgMarkup, /clipPath id="eyeSocketLeft"/);
  assert.match(state.svgMarkup, /clip-path="url\(#eyeSocketLeft\)"/);

  const open = compileRigFrame(state.elements, { eyeOpen: 1 }), shut = compileRigFrame(state.elements, { eyeOpen: 0 });
  assert.equal(open.pupilLeft.opacity, 1);
  assert.equal(shut.pupilLeft.opacity, 1, 'the pupil is covered, never faded');
  // Open: the lids are parked outside the socket. Closed: they meet over it.
  assert.ok(open.lidUpperLeft.transform.y < -30 && shut.lidUpperLeft.transform.y === 0);
  assert.ok(open.lidLowerLeft.transform.y > 30 && shut.lidLowerLeft.transform.y === 0);
  assert.ok(shut.eyeLeft.transform.scaleY < open.eyeLeft.transform.scaleY, 'and the eye still squashes a little');
  assert.ok(shut.eyeLeft.transform.scaleY > 0.5, 'gently: the lids inside it have to keep covering the socket');
});

test('the whole eye turns as one assembly, socket included', () => {
  const state = loaded();
  applyTemplateProject(state);
  // The clip is on the eye itself, so it travels with it. When it sat on a
  // wrapper inside the eye, the white and the pupil slid out from under a
  // socket pinned to the face, and a turned head came apart.
  assert.match(state.svgMarkup, /<g id="eyeLeft"[^>]*clip-path="url\(#eyeSocketLeft\)"/);
  const turned = compileRigFrame(state.elements, { headX: 1 }, {}, {}, { keyforms: state.keyforms });
  // Everything drawn in the eye rides it: the lids add nothing of their own,
  // and the pupil only the little it is deeper.
  assert.ok(turned.eyeLeft.transform.x > 10);
  assert.equal(turned.lidUpperLeft.transform.x, 0);
  assert.ok(turned.pupilLeft.transform.x > 0 && turned.pupilLeft.transform.x < turned.eyeLeft.transform.x / 4);
  // And it foreshortens once, on the assembly, not again on each part inside.
  assert.equal(turned.pupilLeft.transform.scaleX, 1);
  assert.ok(turned.eyeRight.transform.scaleX < .8);
});

test('the mouth cavity travels with the lip line', () => {
  const state = loaded();
  applyTemplateProject(state);
  const mouth = Object.values(state.semanticParts).find((part) => part.type === 'mouth');
  assert.equal(mouth.roles.cavity, 'mouthInner', 'the dark inside is the mouth part, not loose artwork');
  const turned = compileRigFrame(state.elements, { headX: 1, mouthOpen: 1 }, {}, {}, { keyforms: state.keyforms });
  assert.ok(Math.abs(turned.mouthInner.transform.x - turned.mouth.transform.x) < 0.01,
    'or an open mouth comes apart as the head turns');
});

test('opening the mouth drops the chin, so the lower face lengthens', () => {
  const state = loaded();
  applyTemplateProject(state);
  const shut = compileRigFrame(state.elements, { mouthOpen: 0 }), open = compileRigFrame(state.elements, { mouthOpen: 1 });
  assert.equal(shut.chin.transform.y, 0);
  assert.ok(open.chin.transform.y > 10, 'the chin drops below the head outline');
  assert.equal(shut.mouthInner.transform.scaleY, 0, 'and the cavity is flat until the mouth opens');
  assert.equal(open.mouthInner.transform.scaleY, 1);
});

test('the side turning away is shaded, and both sides are the mirror of each other', () => {
  const state = loaded();
  applyTemplateProject(state);
  const rest = compileRigFrame(state.elements, { headX: 0 });
  const right = compileRigFrame(state.elements, { headX: 1 }), left = compileRigFrame(state.elements, { headX: -1 });
  assert.equal(rest.shadeLeft.opacity, rest.shadeRight.opacity, 'at rest the face is lit evenly');
  assert.ok(right.shadeRight.opacity > rest.shadeRight.opacity, 'turning right darkens the side going away');
  assert.equal(right.shadeLeft.opacity, 0, 'and lights the side coming towards the viewer');
  assert.equal(left.shadeLeft.opacity, right.shadeRight.opacity);
  assert.equal(left.shadeRight.opacity, right.shadeLeft.opacity);
});

test('the turn is generated already, so headX turns the head from the first frame', () => {
  const state = loaded();
  applyTemplateProject(state);
  assert.ok(state.keyforms.length > 0, 'no first press needed');
  assert.ok(state.keyforms.every((keyform) => keyform.id.startsWith('headPose:')));
  // The head's own translate binding is off: it drove a slide that swamped the turn.
  assert.equal(state.elements.faceRoot.bindings.translateX.enabled, false);
  assert.equal(state.elements.faceRoot.bindings.translateY.enabled, false);

  const rest = compileRigFrame(state.elements, { headX: 0 }, {}, {}, { keyforms: state.keyforms });
  const turned = compileRigFrame(state.elements, { headX: 1 }, {}, {}, { keyforms: state.keyforms });
  assert.equal(rest.mouth.transform.x, 0);
  assert.ok(turned.mouth.transform.x > turned.faceRoot.transform.x * 3, 'the features travel far further than the outline');
  assert.ok(turned.faceRoot.transform.scaleX < .95, 'and the outline narrows');
  assert.ok(turned.eyeLeft.transform.scaleX > turned.eyeRight.transform.scaleX, 'the far side is foreshortened');
});

test('gaze compiles visible, reversible movement for both pupils', () => {
  const state = loaded();
  applyTemplateProject(state);
  const zero = compileRigFrame(state.elements, { lookX: 0 }), right = compileRigFrame(state.elements, { lookX: .8 }), left = compileRigFrame(state.elements, { lookX: -.8 });
  for (const id of ['pupilLeft', 'pupilRight']) {
    assert.equal(zero[id].transform.x, 0);
    assert.notEqual(right[id].transform.x, 0);
    assert.equal(Math.sign(right[id].transform.x), -Math.sign(left[id].transform.x));
  }
});
