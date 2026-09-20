import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { validateRig } from '../validation/rig-validator.js';
import { PROJECT_TEMPLATES, applyBlankProject, applyTemplateProject } from '../sample/templates/index.js';
import { EYE, FACE_STYLE, HEAD_REST, MOUTH_REST, NOSE_CENTRE, NOSE_REST, NOSE_TURN, mouthGeometry, mouthPath } from '../sample/templates/face-artwork.js';
import { TEMPLATE_ARTBOARD } from '../sample/templates/mascot-artwork.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import { compileRigFrame, parsePath } from '../../../runtime/runtime.js';
import { applyElementTransform } from '../../../runtime/transform-2d.js';
import { handStyleIds, handStyleShapes } from '../hands/hand-style-art.js';
import { artboardBox, handScale } from '../sample/hand-feature.js';

/**
 * Every id the artwork draws that the rigging then wires, in the tree it draws
 * them in: an eye is a group holding its own white, pupil, lids and outline,
 * and the turn reads that nesting (`docs/HEAD_POSE_2_5D.md`).
 */
const eyeChildren = (side) => [`eyeWhite${side}`, `pupil${side}`, `glint${side}`, `spark${side}`, `lidUpper${side}`, `lidLower${side}`, `rim${side}`];
const earChildren = (side) => [`ear${side}Shape`, `ear${side}Fold`];
/** The shading is a folder of its own now, clipped to the head. */
const shadingChildren = ['shadeLeft', 'shadeRight', 'faceLight', 'shadeHair'];
/** And so is the inside of the mouth, clipped to the lips (docs/MOUTH_BUILD.md). */
const mouthChildren = ['tongue', 'teethLower', 'teeth'];
const faceChildren = ['hairBack', 'earLeft', 'earRight', 'head', 'faceShading', ...shadingChildren,
  'mouth', 'mouthInside', ...mouthChildren, 'tongueTip', 'eyeLeft', 'eyeRight', 'eyebrows', 'browLeft', 'browRight', 'nose', 'hairTop', 'hairFront', 'hair'];
/** The children the artwork nests, so a synthetic tree matches the drawn one. */
const nested = { eyeLeft: eyeChildren('Left'), eyeRight: eyeChildren('Right'), faceShading: shadingChildren, mouthInside: mouthChildren };
const topChildren = faceChildren.filter((id) => !shadingChildren.includes(id) && !mouthChildren.includes(id));
const ids = ['faceRoot', ...faceChildren, ...eyeChildren('Left'), ...eyeChildren('Right'), ...earChildren('Left'), ...earChildren('Right')];
const paths = new Set(['head', 'mouth', 'teeth', 'teethLower', 'tongue', 'tongueTip', 'lidUpperLeft', 'lidLowerLeft', 'lidUpperRight', 'lidLowerRight', 'browLeft', 'browRight', 'nose', 'hair', 'hairTop', 'hairBack', 'shadeLeft', 'shadeRight', 'faceLight', 'shadeHair']);
const element = (id) => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, constraints: { translate: true, rotate: true, scale: true }, bindings: {}, meta: { nodeType: paths.has(id) ? 'path' : 'circle' } });
const loaded = () => {
  const state = createCleanProjectState();
  state.svgMarkup = PROJECT_TEMPLATES.basic.svg;
  state.elements = Object.fromEntries(ids.map((id) => [id, element(id)]));
  const leaf = (id) => ({ id, type: state.elements[id].meta.nodeType, name: id, children: [] });
  state.layers = [{ id: 'faceRoot', type: 'g', name: 'faceRoot', children: topChildren.map((id) => (nested[id]
    ? { id, type: 'g', name: id, children: nested[id].map(leaf) }
    : leaf(id))) }];
  return state;
};

test('there is one face template, and it is a whole face', () => {
  assert.deepEqual(Object.keys(PROJECT_TEMPLATES), ['basic', 'blank'], 'three starter faces became one complete one, plus an empty canvas');
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

test('the blank canvas is the same working area with nothing on it, and no rig', () => {
  const blank = PROJECT_TEMPLATES.blank;
  assert.equal(blank.kind, 'blank');
  assert.match(blank.svg, /<svg[^>]*viewBox="0 0 240 240"[^>]*><\/svg>/, 'an empty artboard the size of the square the face is drawn in');
  // The face template's artboard is bigger than the blank one at both ends: it
  // ships a pair of hands, and a floating hand needs room below the mascot to
  // hang in; and it keeps headroom above the face for what a head wears, which
  // is why its viewBox starts above the origin (`face-artwork.js`).
  const frame = /viewBox="([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+)"/.exec(PROJECT_TEMPLATES.basic.svg).slice(1).map(Number);
  assert.deepEqual(frame, [TEMPLATE_ARTBOARD.x, TEMPLATE_ARTBOARD.y, TEMPLATE_ARTBOARD.width, TEMPLATE_ARTBOARD.height], 'the artboard the template says it has');
  assert.ok(frame[1] <= 22 - 78, `a top hat standing 78 over a head whose top is at 22 is cut in half by a page that starts at ${frame[1]}`);
  assert.ok(frame[1] + frame[3] > 300, 'and the hands still hang below the face');
  assert.doesNotMatch(blank.svg, /<(?:path|g|rect|circle|ellipse)\b/);
  // Its rig is the least that validates: one resting state, nothing bound.
  const state = createCleanProjectState();
  state.svgMarkup = blank.svg;
  applyBlankProject(state);
  assert.deepEqual(validateRig(state), []);
  assert.equal(state.activeState, 'idle');
  assert.deepEqual(state.semanticParts, {});
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
  // lids close over it, opaquely.
  for (const id of ['pupilLeft', 'pupilRight']) assert.equal(state.elements[id].bindings.opacity, undefined);
  // And the socket an author could not see is a socket an author can: the cut
  // is `<use href="#eyeWhiteLeft">`, so the shape that cuts is the shape in the
  // layer tree -- move it or resize it and the cut goes with it
  // (docs/EYE_BUILDS.md).
  assert.match(state.svgMarkup, /<clipPath id="eyeSocketLeft"><use href="#eyeWhiteLeft" \/><\/clipPath>/);
  assert.match(state.svgMarkup, /<g id="eyeInnerLeft" data-name="Left eye, inside" clip-path="url\(#eyeSocketLeft\)">/);
  assert.equal(/<clipPath id="eyeSocketLeft"><ellipse/.test(state.svgMarkup), false, 'and never a second copy of it');

  const open = compileRigFrame(state.elements, { eyeOpen: 1 }), shut = compileRigFrame(state.elements, { eyeOpen: 0 });
  assert.equal(open.pupilLeft.opacity, 1);
  assert.equal(shut.pupilLeft.opacity, 1, 'the pupil is covered, never faded');
  // Open: each lid is exactly as drawn, a sliver on its own rim -- so opening the
  // eyes is the identity and closing them is the movement. Closed: they grow to
  // meet on the seam.
  assert.equal(open.lidUpperLeft.transform.scaleY, 1);
  assert.equal(open.lidLowerLeft.transform.scaleY, 1);
  assert.equal(open.lidUpperLeft.transform.y, 0, 'and nothing slides: the movement is a scale');
  // Each lid grows until its leading edge lands on the seam, which is the eye's
  // own half-height away from the rim it swings from. Measured off the drawing
  // rather than off a constant, because the drawing is what has to arrive there:
  // the lid's leading edge, grown about its pivot.
  const reach = (id) => {
    const drawn = Math.max(...parsePath(state.elements[id].restPath).values.filter((_, index) => index % 2 === 1)
      .map((y) => Math.abs(y - state.elements[id].baseTransform.pivotY)));
    return drawn * shut[id].transform.scaleY;
  };
  assert.ok(reach('lidUpperLeft') > EYE.ry * 0.95 && reach('lidUpperLeft') < EYE.ry * 1.1, `the upper lid reaches ${reach('lidUpperLeft')}`);
  assert.ok(reach('lidLowerLeft') > EYE.ry * 0.9 && reach('lidLowerLeft') < EYE.ry * 1.05, `the lower lid reaches ${reach('lidLowerLeft')}`);
  assert.ok(shut.eyeLeft.transform.scaleY < open.eyeLeft.transform.scaleY, 'and the eye still squashes a little');
  assert.ok(shut.eyeLeft.transform.scaleY > 0.5, 'gently: the lids inside it have to keep meeting on the seam');
});

test('the whole eye turns as one assembly, and the socket turns with it', () => {
  const state = loaded();
  applyTemplateProject(state);
  // The clip used to be on the eye group itself, so a turn carried it: pinned
  // to the face instead, the white and the pupil slid out from under it and a
  // turned head came apart. It is on the *lids* now and made of the white, so
  // it cannot come adrift from either -- the white travels with the eye, and
  // the cut is the white (docs/EYE_BUILDS.md).
  assert.match(state.svgMarkup, /<g id="eyeLeft" data-name="Left eye">/);
  assert.equal(/<g id="eyeLeft"[^>]*clip-path/.test(state.svgMarkup), false, 'the eye itself is not cut');
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
  // The far eye is foreshortened -- less than everything else on the face is,
  // because a round eye is the character and a third of squash makes an oval
  // of it. The head's own narrowing is on top of this and shared by everything.
  assert.ok(turned.eyeRight.transform.scaleX < turned.eyeLeft.transform.scaleX - .1, 'the far side is foreshortened');
  assert.ok(turned.eyeRight.transform.scaleX > .8, 'and stays an eye while it is');
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
    [// The lids: narrowed and curved, per lid, on each side's own sentence
      // (docs/FACE_SVG_STATES.md).
      'lidUpperLeft-eyeSquint', 'lidUpperLeft-eyeCurve', 'lidLowerLeft-eyeSquint', 'lidLowerLeft-eyeCurve',
      'lidUpperRight-eyeSquint', 'lidUpperRight-eyeCurve', 'lidLowerRight-eyeSquint', 'lidLowerRight-eyeCurve',
      // The lips: open, smile, frown, pucker, lean, and the bow a head that
      // looks down puts across them.
      'mouth-open', 'mouth-smile', 'mouth-frown', 'mouth-round', 'mouth-skew',
      // And the same bow for everything drawn from them.
      'mouth-skull', 'teeth-skull', 'teethLower-skull', 'tongue-skull', 'tongueTip-skull',
      // Each inside follows the lip it hangs off: the smile, the pucker, the lean.
      'teeth-follow', 'teeth-round', 'teeth-skew',
      'teethLower-follow', 'teethLower-round', 'teethLower-skew',
      'tongue-follow', 'tongue-round', 'tongue-skew',
      'tongueTip-follow', 'tongueTip-round', 'tongueTip-skew',
      // Travelling with the jaw, and showing: two questions, two keys.
      'teeth-open', 'teeth-show', 'teethLower-open', 'teethLower-show', 'tongue-open', 'tongue-show',
      // The tip follows the jaw on a key of its own, because what brings it out
      // is `tongueOut` rather than the mouth opening (docs/MOUTH_BUILD.md).
      'tongueTip-open', 'tongueTip-out', 'tongue-out', 'tongueTip-curl',
      'head-jaw']);
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

test('the nose is a small hook, and the turn rotates it rather than reshaping it', () => {
  const state = loaded();
  applyTemplateProject(state);
  // One curve, and the artwork draws exactly what the rig turns.
  assert.equal(NOSE_REST, 'M114.3 143.4 Q113.6 152 119.6 152.6 Q125 152.2 127 145.7',
    'a small asymmetric hook: the left wing short, the right one carrying on');
  assert.match(state.svgMarkup, new RegExp(`id="nose"[^>]*d="${NOSE_REST}"`));
  assert.equal(state.elements.nose.restPath, undefined, 'nothing morphs it, so it needs no rest shape');
  assert.deepEqual(state.shapeKeys.filter((key) => key.target === 'nose'), []);

  // It is drawn lighter than everything above it. V1's nose was a half circle
  // as wide as a third of the mouth in the same weight as the eye rims, on the
  // middle line above the mouth -- which is a second mouth, not a nose.
  const numbers = [...NOSE_REST.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
  const xs = numbers.filter((_, index) => index % 2 === 0);
  assert.ok(Math.max(...xs) - Math.min(...xs) < (mouthGeometry().right.x - mouthGeometry().left.x) / 4, 'and small');
  assert.ok(FACE_STYLE.noseOutline < FACE_STYLE.eyeOutline && FACE_STYLE.noseOutline < FACE_STYLE.mouthOutline);
  assert.match(state.svgMarkup, new RegExp(`id="nose"[^>]*stroke-width="${FACE_STYLE.noseOutline}"`));

  // `headX` turns it about the middle of its own curve, which is where the
  // pivot has to be or a rotation walks the nose across the face.
  const binding = state.elements.nose.bindings.rotation;
  assert.equal(binding.expression, 'headX');
  assert.equal(binding.amplitude, NOSE_TURN);
  assert.deepEqual([state.elements.nose.baseTransform.pivotX, state.elements.nose.baseTransform.pivotY], [NOSE_CENTRE.x, NOSE_CENTRE.y]);

  const at = (headX) => compileRigFrame(state.elements, { ...state.params, headX: { type: 'number', min: -1, max: 1, default: 0, value: headX } }, {})
    .nose.transform;
  assert.equal(at(0).rotation, 0, 'the front view is the drawing itself');
  assert.equal(at(1).rotation, NOSE_TURN);
  assert.equal(at(-1).rotation, -NOSE_TURN, 'and the two directions are mirrors');
  // A rotation has no midpoint where the curve is flat, which is the whole
  // reason it is a rotation: every angle of it is the same curve.
  assert.equal(at(0.5).rotation, NOSE_TURN / 2);
  assert.equal(state.elements.nose.baseTransform.rotation, 0, 'the binding drives it; nothing is baked in');
});

test('an open mouth has teeth and a tongue in it, and a closed one has neither', () => {
  const state = loaded();
  applyTemplateProject(state);
  const part = Object.values(state.semanticParts).find((item) => item.type === 'mouth');
  assert.deepEqual(part.roles, { mouth: 'mouth', teeth: 'teeth', teethLower: 'teethLower', tongue: 'tongue', tongueTip: 'tongueTip' });
  assert.equal(part.controlDrivers.teeth.method, 'shapeKey');

  const at = (values) => compileRigFrame(state.elements, { ...state.params, ...Object.fromEntries(Object.entries(values).map(([name, value]) => [name, { type: 'number', min: -1, max: 1, default: 0, value }])) }, {}, {}, { shapeKeys: state.shapeKeys });
  /**
   * The area the path actually paints, which is the question.
   *
   * The curves are flattened before the shoelace rather than shoelaced over the
   * `d` string's numbers: a scalloped row of teeth is several segments where a
   * plain band was two, its control polygon is not degenerate even when the
   * shape it draws is empty, and the cheap version read 13 square units of ink
   * on a shut mouth that paints none (docs/MOUTH_BUILD.md).
   */
  const area = (d) => {
    const tokens = String(d).match(/[MQCZ]|-?\d+(?:\.\d+)?/g) || [];
    const points = [];
    let index = 0, current = null, first = null;
    const number = () => Number(tokens[index++]);
    const push = (p) => { points.push(p); return p; };
    while (index < tokens.length) {
      const command = tokens[index++];
      if (command === 'M') { current = first = push({ x: number(), y: number() }); continue; }
      if (command === 'Z') { current = first; continue; }
      const controls = command === 'Q' ? 1 : 2;
      const between = Array.from({ length: controls }, () => ({ x: number(), y: number() }));
      const end = { x: number(), y: number() };
      const all = [current, ...between, end];
      for (let step = 1; step <= 24; step += 1) {
        const t = step / 24;
        const run = all.map((p) => ({ ...p }));
        for (let order = all.length - 1; order > 0; order -= 1) {
          for (let k = 0; k < order; k += 1) { run[k].x += (run[k + 1].x - run[k].x) * t; run[k].y += (run[k + 1].y - run[k].y) * t; }
        }
        push(run[0]);
      }
      current = end;
    }
    let total = 0;
    for (let k = 0; k < points.length; k += 1) { const next = points[(k + 1) % points.length]; total += points[k].x * next.y - next.x * points[k].y; }
    return Math.abs(total) / 2;
  };
  // Turned all the way up, but with the lips closed: nothing shows.
  //
  // Not exactly nothing. The paths are rounded to a hundredth of a unit, a row
  // of teeth is five segments each rounded on its own, and the rig adds a
  // rounded delta to a rounded rest -- so an edge that retraces its partner
  // exactly in arithmetic retraces it to within a hundredth on the page. One
  // square unit is the bound that holds across every pose, against the 340 a
  // shown row paints: a band 37 units long and a seventieth of a unit thick,
  // which is a third of one per cent of the ink and no ink at all.
  const NOTHING = 1;
  assert.ok(area(at({ teeth: 1, tongue: 1 }).teeth.path) < NOTHING);
  assert.ok(area(at({ teeth: 1, tongue: 1 }).teethLower.path) < NOTHING);
  assert.ok(area(at({ teeth: 1, tongue: 1 }).tongue.path) < NOTHING);
  assert.ok(area(at({ tongue: 1 }).tongueTip.path) < NOTHING, 'and the tip is in until it is asked out');
  // Open, with the controls down: still nothing, because it is a product.
  assert.ok(area(at({ mouthOpen: 1 }).teeth.path) < NOTHING);
  assert.ok(area(at({ mouthOpen: 1 }).teethLower.path) < NOTHING);
  assert.ok(area(at({ mouthOpen: 1 }).tongue.path) < NOTHING);
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
  assert.deepEqual(controls.mouth, ['mouthOpen', 'smile', 'mouthWidth', 'mouthRound', 'mouthSkew', 'teeth', 'tongue']);
  assert.deepEqual(controls.tongue, ['tongueX', 'tongueY', 'tongueOut', 'tongueCurl']);

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

/**
 * The head, as a polygon: the outline is cubics, and "is this point inside it"
 * is only honest against the curve rather than against its bounding box.
 */
function headPolygon(steps = 24) {
  const { commands, values } = parsePath(HEAD_REST);
  const points = [];
  let at = { x: 0, y: 0 }, cursor = 0;
  for (const command of commands) {
    if (command === 'M') { at = { x: values[cursor], y: values[cursor + 1] }; points.push(at); cursor += 2; continue; }
    if (command === 'Z') continue;
    const c1 = { x: values[cursor], y: values[cursor + 1] };
    const c2 = { x: values[cursor + 2], y: values[cursor + 3] };
    const to = { x: values[cursor + 4], y: values[cursor + 5] };
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps, u = 1 - t;
      points.push({
        x: u * u * u * at.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * to.x,
        y: u * u * u * at.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * to.y
      });
    }
    at = to;
    cursor += 6;
  }
  return points;
}

const inside = (polygon, point) => polygon.reduce((within, b, index) => {
  const a = polygon[(index + polygon.length - 1) % polygon.length];
  const crosses = (a.y > point.y) !== (b.y > point.y)
    && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
  return crosses ? !within : within;
}, false);

test('the hands rest out of sight, the whole drawing inside the head', () => {
  // A hand big enough to read beside the face is bigger than the gap between
  // its hiding place and the outline, so the pair used to rest with its
  // fingertips outside the silhouette. Every point of both gloves, at
  // `handShow` 0, is now inside the head that hides them.
  const state = createTemplateProjectState();
  const head = headPolygon();
  for (const side of ['left', 'right']) {
    const element = state.hands[side].element;
    const base = state.elements[element].baseTransform;
    const hidden = (channel) => {
      const grid = state.keyforms.find((item) => item.id === `${element}-show-${channel}`);
      assert.ok(grid, `${element} has no ${channel} to hide by`);
      return grid.keyforms.find((key) => key.at[0] === 0).value;
    };
    const transform = { ...base, x: hidden('x'), y: hidden('y'), scaleX: base.scaleX * hidden('scaleX'), scaleY: base.scaleY * hidden('scaleY') };
    // Every drawing, not only the one showing: a hand may be asked for another
    // one while it is away, and the swap must not push a fingertip out of the
    // head that is hiding it.
    const library = state.hands[side].styles.library;
    assert.equal(library.length, handStyleIds().length, 'the whole library the pair is given');
    const at = { x: base.pivotX, y: base.pivotY };
    for (const style of library) {
      for (const shape of handStyleShapes(style.id, { at, scale: handScale(artboardBox(state)), flip: style.mirrored })) {
        const { values } = parsePath(shape.d);
        for (let index = 0; index + 1 < values.length; index += 2) {
          const point = applyElementTransform(transform, { x: values[index], y: values[index + 1] });
          assert.ok(inside(head, point), `${style.id} ${shape.part} shows at (${point.x.toFixed(1)}, ${point.y.toFixed(1)})`);
        }
      }
    }
  }
});
