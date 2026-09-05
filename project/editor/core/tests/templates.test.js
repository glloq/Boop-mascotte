import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { validateRig } from '../validation/rig-validator.js';
import { PROJECT_TEMPLATES, applyTemplateProject } from '../sample/templates/index.js';
import { HEAD_REST, MOUTH_REST, mouthPath } from '../sample/templates/face-artwork.js';
import { compileRigFrame } from '../../../runtime/runtime.js';

/**
 * Every id the artwork draws that the rigging then wires, in the tree it draws
 * them in: an eye is a group holding its own white, pupil, lids and outline,
 * and the turn reads that nesting (`docs/HEAD_POSE_2_5D.md`).
 */
const eyeChildren = (side) => [`eyeWhite${side}`, `pupil${side}`, `glint${side}`, `lidUpper${side}`, `lidLower${side}`, `rim${side}`];
const earChildren = (side) => [`ear${side}Shape`, `ear${side}Fold`];
const faceChildren = ['hairBack', 'earLeft', 'earRight', 'head', 'shadeLeft', 'shadeRight',
  'mouth', 'tongue', 'teeth', 'eyeLeft', 'eyeRight', 'eyebrows', 'browLeft', 'browRight', 'nose', 'hairTop', 'hairFront', 'hair'];
const ids = ['faceRoot', ...faceChildren, ...eyeChildren('Left'), ...eyeChildren('Right'), ...earChildren('Left'), ...earChildren('Right')];
const paths = new Set(['head', 'mouth', 'teeth', 'tongue', 'lidUpperLeft', 'lidLowerLeft', 'lidUpperRight', 'lidLowerRight', 'browLeft', 'browRight', 'nose', 'hair', 'hairTop', 'hairBack', 'shadeLeft', 'shadeRight']);
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
  assert.deepEqual(Object.keys(state.semanticParts).sort(), ['ears', 'eyebrows', 'eyelids', 'eyes', 'gaze', 'hair', 'head', 'jaw', 'mouth', 'nose', 'tongue']);
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
  // Every parameter the rig has, then the one being posed: the pupils scale
  // now, and a scale left out of the bag reads as 0 rather than as "unchanged".
  const turned = compileRigFrame(state.elements, { ...state.params, headX: 1 }, {}, {}, { keyforms: state.keyforms });
  // Everything drawn in the eye rides it: the lids add nothing of their own,
  // and the pupil only the little it is deeper.
  assert.ok(turned.eyeLeft.transform.x > 10);
  assert.equal(turned.lidUpperLeft.transform.x, 0);
  assert.ok(turned.pupilLeft.transform.x > 0 && turned.pupilLeft.transform.x < turned.eyeLeft.transform.x / 4);
  // And it foreshortens once, on the assembly, not again on each part inside.
  assert.equal(turned.pupilLeft.transform.scaleX, 1);
  assert.ok(turned.eyeRight.transform.scaleX < .8);
});

test('the mouth is one shape that opens and smiles at the same time', () => {
  const state = loaded();
  applyTemplateProject(state);
  // One closed path: the fill is the inside of the mouth and the stroke is the
  // lips. Two shapes under two systems could not agree -- a smile put the lip
  // corners outside the cavity, and half-open the lip lay across the hole.
  assert.equal(state.elements.mouthInner, undefined, 'the cavity is the mouth now');
  assert.equal(state.elements.mouth.morph?.enabled, undefined, 'and it is shaped by shape keys, not the one-per-element morph');
  assert.equal(state.elements.mouth.restPath, MOUTH_REST);
  assert.deepEqual(state.shapeKeys.map((key) => key.id),
    ['mouth-open', 'mouth-smile', 'mouth-frown', 'teeth-show', 'teeth-follow', 'tongue-show', 'tongue-follow', 'head-jaw']);
  const part = Object.values(state.semanticParts).find((item) => item.type === 'mouth');
  assert.equal(part.controlDrivers.mouthOpen.method, 'shapeKey');
  assert.equal(part.controlDrivers.smile.method, 'shapeKey');
  assert.equal(part.controlDrivers.mouthWidth.method, 'transform', 'width is still an honest scale');

  const at = (values) => compileRigFrame(state.elements, { ...state.params, ...Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { type: 'number', min: -1, max: 1, default: 0, value }])) }, {}, {}, { shapeKeys: state.shapeKeys }).mouth.path;
  const numbers = (d) => [...String(d).matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  const rest = numbers(at({}));
  assert.deepEqual(rest, numbers(MOUTH_REST));
  const open = numbers(at({ mouthOpen: 1 })), smile = numbers(at({ smile: 1 })), frown = numbers(at({ smile: -1 }));
  // M86 y0 Q120 y1 154 y2 Q120 y3 86 y4 Z: y0 is a corner, y3 the lower lip.
  assert.ok(open[7] > rest[7] + 40, 'opening drops the lower lip a long way');
  assert.ok(smile[1] < rest[1], 'a smile lifts the corners');
  assert.ok(frown[1] > rest[1], 'and a frown drops them');

  // Both at once, exactly: every control point is affine in open and smile, so
  // the two additive shape keys reproduce the drawn shape rather than
  // approximating it.
  const both = numbers(at({ mouthOpen: 1, smile: 1 }));
  const drawn = numbers(mouthPath({ open: 1, smile: 1 }));
  both.forEach((value, index) => assert.ok(Math.abs(value - drawn[index]) < 0.2, `point ${index}: ${value} vs ${drawn[index]}`));
});

test('an open mouth has teeth and a tongue in it, and a closed one has neither', () => {
  const state = loaded();
  applyTemplateProject(state);
  const part = Object.values(state.semanticParts).find((item) => item.type === 'mouth');
  assert.deepEqual(part.roles, { mouth: 'mouth', teeth: 'teeth', tongue: 'tongue' });
  assert.equal(part.controlDrivers.teeth.method, 'shapeKey');

  const at = (values) => compileRigFrame(state.elements, { ...state.params, ...Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { type: 'number', min: -1, max: 1, default: 0, value }])) }, {}, {}, { shapeKeys: state.shapeKeys });
  const area = (d) => {
    // The shoelace area of the path's points: a flat band has none, which is
    // how a closed mouth hides what is behind it without an opacity trick.
    const numbers = [...String(d).matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    let total = 0;
    for (let index = 0; index < numbers.length; index += 2) {
      const nextIndex = (index + 2) % numbers.length;
      total += numbers[index] * numbers[nextIndex + 1] - numbers[nextIndex] * numbers[index + 1];
    }
    return Math.abs(total) / 2;
  };
  // Turned all the way up, but with the lips closed: nothing shows.
  assert.equal(area(at({ teeth: 1, tongue: 1 }).teeth.path), 0);
  assert.equal(area(at({ teeth: 1, tongue: 1 }).tongue.path), 0);
  // Open, with the controls down: still nothing, because it is a product.
  assert.equal(area(at({ mouthOpen: 1 }).teeth.path), 0);
  assert.equal(area(at({ mouthOpen: 1 }).tongue.path), 0);
  // Open and asked for: both, and both inside the mouth.
  const grinning = at({ mouthOpen: 1, teeth: 1, tongue: 1 });
  assert.ok(area(grinning.teeth.path) > 200);
  assert.ok(area(grinning.tongue.path) > 200);
  const bounds = (d) => { const y = [...String(d).matchAll(/-?\d+(?:\.\d+)? (-?\d+(?:\.\d+)?)/g)].map((match) => Number(match[1])); return { top: Math.min(...y), bottom: Math.max(...y) }; };
  const mouth = bounds(grinning.mouth.path), teeth = bounds(grinning.teeth.path), tongue = bounds(grinning.tongue.path);
  assert.ok(teeth.top >= mouth.top - 0.1 && teeth.bottom <= mouth.bottom, 'the teeth hang off the upper lip');
  assert.ok(tongue.bottom <= mouth.bottom + 0.1, 'and the tongue sits on the lower one');
});

test('every part of the face has a movement, and the jaw is one of them', () => {
  const state = loaded();
  applyTemplateProject(state);
  const controls = Object.fromEntries(Object.values(state.semanticParts).map((part) => [part.type, part.controls]));
  assert.deepEqual(controls.nose, ['noseScrunch']);
  assert.deepEqual(controls.ears, ['earWiggle']);
  assert.deepEqual(controls.jaw, ['jawOpen']);
  assert.deepEqual(controls.hair, ['hairSway', 'hairLift']);
  assert.deepEqual(controls.mouth, ['mouthOpen', 'smile', 'mouthWidth', 'teeth', 'tongue']);

  // One outline that lengthens, rather than a second shape sliding out from
  // behind the first: that is what a double chin was.
  assert.equal(state.elements.chin, undefined);
  assert.equal(state.elements.head.restPath, HEAD_REST);
  const jawKey = state.shapeKeys.find((key) => key.id === 'head-jaw');
  assert.equal(jawKey.driver.expression, 'mouthOpen + jawOpen');
  const bottom = (values) => {
    const path = compileRigFrame(state.elements, { ...state.params, ...values }, {}, {}, { shapeKeys: state.shapeKeys }).head.path;
    return Math.max(...[...String(path).matchAll(/-?\d+(?:\.\d+)? (-?\d+(?:\.\d+)?)/g)].map((match) => Number(match[1])));
  };
  const rest = bottom({});
  assert.ok(bottom({ mouthOpen: 1 }) > rest + 10, 'the mouth takes the face with it');
  assert.equal(bottom({ jawOpen: 1 }), bottom({ mouthOpen: 1 }), 'and the jaw drops on its own');
  assert.ok(bottom({ mouthOpen: 1, jawOpen: 1 }) > bottom({ mouthOpen: 1 }), 'and the two add up');
  // The sides do not move: a jaw opens downwards, it does not inflate the face.
  const width = (values) => {
    const path = compileRigFrame(state.elements, { ...state.params, ...values }, {}, {}, { shapeKeys: state.shapeKeys }).head.path;
    const xs = [...String(path).matchAll(/(-?\d+(?:\.\d+)?) -?\d+(?:\.\d+)?/g)].map((match) => Number(match[1]));
    return Math.max(...xs) - Math.min(...xs);
  };
  assert.equal(width({ jawOpen: 1 }), width({}));
});

test('the face is drawn without blush, and the fringe cannot leave the head', () => {
  const state = loaded();
  applyTemplateProject(state);
  assert.doesNotMatch(state.svgMarkup, /blush/i, 'the blush is gone');
  // Whatever the turn or the hair movement does to the fringe, it is clipped
  // to the head: it used to slide out past the outline on a turn and uncover
  // the hairline on the other side.
  assert.match(state.svgMarkup, /clipPath id="headShape"/);
  assert.match(state.svgMarkup, /<g id="hairFront"[^>]*clip-path="url\(#headShape\)"/);
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
  const at = (lookX) => compileRigFrame(state.elements, { ...state.params, lookX });
  const zero = at(0), right = at(.8), left = at(-.8);
  for (const id of ['pupilLeft', 'pupilRight']) {
    assert.equal(zero[id].transform.x, 0);
    assert.notEqual(right[id].transform.x, 0);
    assert.equal(Math.sign(right[id].transform.x), -Math.sign(left[id].transform.x));
  }
});
