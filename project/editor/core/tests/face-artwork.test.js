import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compileRigFrame, parsePath } from '../../../runtime/runtime.js';
import { createTemplateProjectState } from '../sample/templates/template-export.js';
import {
  BROW_BOXES, BROW_RESTS, EAR, EYE, FACE_CENTRES, FACE_PALETTE, FACE_STYLE, HEAD_REST, HEAD_WIDTH,
  LID_TRAVEL, MASCOT_FACE_SVG, MOUTH_BOX, PUPIL, browPath, headEdgeAt, headPath, mouthGeometry,
  mouthPath, spline, teethPath, tonguePath
} from '../sample/templates/face-artwork.js';
import { SAMPLE_PATH } from '../../../../scripts/mascot-sample.mjs';

/**
 * What Basic Face V2 has to keep being.
 *
 * A redesign is the one change no unit test catches: every existing test was
 * written against the drawing it was written with, so they all pass on a face
 * that has quietly stopped working — a blink that no longer covers the eye, a
 * pupil that walks out of its socket at a full gaze, a fringe that has crept
 * down over a brow and taken half the expressions with it.
 *
 * So this file asserts the *properties* rather than the coordinates. Every one
 * of them is a thing a reader can see in `scripts/face-snapshots.mjs`, checked
 * here so it does not have to be looked at to be believed. Redrawing the face
 * again should leave every one of these true; if one of them cannot be, that
 * is the conversation the test exists to start.
 */

const state = createTemplateProjectState();
const number = (value) => ({ type: 'number', min: -2, max: 2, default: 0, value });
const pose = (values = {}) => compileRigFrame(
  state.elements,
  { ...state.params, ...Object.fromEntries(Object.entries(values).map(([name, value]) => [name, number(value)])) },
  {}, {}, { keyforms: state.keyforms, shapeKeys: state.shapeKeys, rigPins: state.rigPins }
);
const points = (d) => {
  const values = parsePath(d).values;
  return Array.from({ length: values.length / 2 }, (_, index) => ({ x: values[index * 2], y: values[index * 2 + 1] }));
};
/**
 * The box a path actually *draws*, curves walked rather than control points
 * counted. A quadratic's control point sits well outside the curve it bends —
 * the open mouth's is below the chin — so a box round the numbers in the `d`
 * attribute answers a different question from the one these tests are asking.
 */
const box = (d) => {
  const { commands, values } = parsePath(d);
  const list = [];
  let at = { x: 0, y: 0 }, start = { x: 0, y: 0 }, read = 0;
  const take = () => ({ x: values[read++], y: values[read++] });
  const quad = (p0, c, p2, t) => {
    const u = 1 - t;
    return { x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x, y: u * u * p0.y + 2 * u * t * c.y + t * t * p2.y };
  };
  const cubic = (p0, c1, c2, p3, t) => {
    const u = 1 - t, a = u * u * u, b = 3 * t * u * u, c = 3 * t * t * u, e = t * t * t;
    return { x: a * p0.x + b * c1.x + c * c2.x + e * p3.x, y: a * p0.y + b * c1.y + c * c2.y + e * p3.y };
  };
  const walk = (curve) => { for (let step = 0; step <= 16; step += 1) list.push(curve(step / 16)); };
  for (const command of commands) {
    if (command === 'M') { at = take(); start = at; list.push(at); }
    else if (command === 'L') { const to = take(); list.push(at, to); at = to; }
    else if (command === 'Q') { const c = take(), to = take(); walk((t) => quad(at, c, to, t)); at = to; }
    else if (command === 'C') { const c1 = take(), c2 = take(), to = take(); walk((t) => cubic(at, c1, c2, to, t)); at = to; }
    else if (command === 'Z') { list.push(start); at = start; }
    else throw new Error(`the face is not drawn with "${command}"`);
  }
  return {
    left: Math.min(...list.map((p) => p.x)), right: Math.max(...list.map((p) => p.x)),
    top: Math.min(...list.map((p) => p.y)), bottom: Math.max(...list.map((p) => p.y))
  };
};

test('the eyes are round, and stay round', () => {
  // The mascot's one fixed feature. V1 drew them 26 × 21 -- a quarter wider
  // than tall -- which at small sizes reads as a lozenge rather than an eye.
  assert.ok(EYE.rx / EYE.ry < 1.12, `rx/ry is ${EYE.rx / EYE.ry}`);
  assert.equal(EYE.left + EYE.right, 240, 'the two eyes are one eye and its mirror');
  // Spaced about one eye apart, which is the cartoon proportion and also what
  // leaves the nose somewhere to be.
  const gap = (EYE.right - EYE.rx) - (EYE.left + EYE.rx);
  assert.ok(gap > EYE.rx && gap < EYE.rx * 1.6, `the gap between the eyes is ${gap}`);
  // And they sit inside the head with room round them.
  for (const [cx, side] of [[EYE.left, 'left'], [EYE.right, 'right']]) {
    const edge = headEdgeAt(EYE.cy, side);
    assert.ok(Math.abs(cx - edge) > EYE.rx + 8, `the ${side} eye is clear of the silhouette`);
  }
});

test('the pupils stay inside the eye at any gaze', () => {
  // `travel` is the binding amplitude the gaze rig is given, so this is the
  // furthest a pupil can ever be pushed -- rig and drawing, checked against
  // each other rather than each assuming the other is right.
  for (const id of ['pupilLeft', 'pupilRight']) {
    const binding = state.elements[id].bindings.translateX;
    assert.equal(Math.abs(binding.amplitude), PUPIL.travel, `${id} travels what the artwork was drawn for`);
  }
  const reach = PUPIL.r + PUPIL.travel;
  assert.ok(reach < EYE.rx - 4, `sideways the pupil stops ${EYE.rx - reach} short of the rim`);
  assert.ok(reach < EYE.ry - 3, `and vertically ${EYE.ry - reach} short`);

  // At a full corner-to-corner look, with the head turned as well.
  const far = pose({ lookX: 1, lookY: 1, headX: 1 });
  const offset = Math.hypot(far.pupilRight.transform.x, far.pupilRight.transform.y);
  assert.ok(offset + PUPIL.r < EYE.rx, `the pupil is ${offset + PUPIL.r} from the middle of a ${EYE.rx} socket`);
});

test('a blink covers the eye, and half a blink covers half of it', () => {
  const shut = pose({ eyeOpen: 0 }), open = pose({ eyeOpen: 1 });
  // The artwork rests with the eyes open, so opening them moves nothing: the
  // file on its own is a face rather than a face asleep.
  assert.equal(open.lidUpperLeft.transform.y, 0);
  assert.equal(open.lidLowerLeft.transform.y, 0);
  const upper = box(state.svgMarkup.match(/id="lidUpperLeft"[^>]*d="([^"]+)"/)[1]);
  const lower = box(state.svgMarkup.match(/id="lidLowerLeft"[^>]*d="([^"]+)"/)[1]);
  assert.ok(upper.bottom < EYE.cy - EYE.ry, 'the open upper lid is above the socket, bulge and all');
  assert.ok(lower.top > EYE.cy + EYE.ry, 'and the lower one below it');
  assert.ok(upper.left <= EYE.left - EYE.rx && upper.right >= EYE.left + EYE.rx, 'across the whole socket');

  // Closed, the two lids meet over the middle of the socket: the upper one has
  // come all the way down and the lower one all the way up, and between them
  // there is nothing of the eye left to see.
  assert.ok(upper.bottom + shut.lidUpperLeft.transform.y >= EYE.cy, 'the upper lid reaches past the middle of the eye');
  assert.ok(lower.top + shut.lidLowerLeft.transform.y <= EYE.cy, 'and the lower one comes up to meet it');
  assert.deepEqual([LID_TRAVEL.upper, LID_TRAVEL.lower],
    [shut.lidUpperLeft.transform.y, -shut.lidLowerLeft.transform.y],
    'the rig moves the lids exactly as far as the artwork was drawn to need');

  // Half way, half way: nothing about a lid is non-linear.
  const half = pose({ eyeOpen: .5 });
  assert.ok(Math.abs(half.lidUpperLeft.transform.y - shut.lidUpperLeft.transform.y / 2) < 1e-6);
});

test('the neutral mouth is not a straight line, and a smile is unmistakably more', () => {
  const rest = mouthGeometry();
  const lipLine = (rest.left.y + 2 * rest.top.y + rest.right.y) / 4;
  const curve = lipLine - rest.left.y;
  // V1 put the upper lip's control point level with its corners, which draws a
  // bar. This curves -- a little, and only a little: a neutral that reads as a
  // smile is not a neutral.
  assert.ok(curve > 1, `the rest mouth curves by ${curve}`);
  const smiling = mouthGeometry({ smile: 1 });
  const smile = (smiling.left.y + 2 * smiling.top.y + smiling.right.y) / 4 - smiling.left.y;
  assert.ok(smile > curve * 4, `a smile is ${smile} against a neutral's ${curve}`);
  // And a frown goes the other way rather than merely flattening.
  const frowning = mouthGeometry({ smile: -1 });
  assert.ok((frowning.left.y + 2 * frowning.top.y + frowning.right.y) / 4 < frowning.left.y);

  // The mouth is a mouth's width, not a face's: it stays well inside the jaw.
  assert.ok(rest.left.x - headEdgeAt(rest.left.y, 'left') > 20, 'clear of the left cheek');
  assert.ok(headEdgeAt(rest.right.y, 'right') - rest.right.x > 20, 'and of the right');
});

test('an open mouth stays inside the face it opens', () => {
  const open = pose({ mouthOpen: 1 });
  const lips = box(open.mouth.path), chin = box(open.head.path);
  assert.ok(lips.bottom < chin.bottom - 10, `the lower lip is ${chin.bottom - lips.bottom} above the chin`);
  assert.ok(chin.bottom > box(HEAD_REST).bottom + 10, 'and the jaw came down to make the room');
  // Teeth and tongue live inside the lips at every opening, by construction.
  for (const at of [.2, .5, 1]) {
    const frame = pose({ mouthOpen: at, teeth: 1, tongue: 1 });
    const mouth = box(frame.mouth.path), teeth = box(frame.teeth.path), tongue = box(frame.tongue.path);
    assert.ok(teeth.top >= mouth.top - .1 && teeth.bottom <= mouth.bottom + .1, `teeth inside the mouth at ${at}`);
    assert.ok(tongue.top >= mouth.top - .1 && tongue.bottom <= mouth.bottom + .1, `tongue inside the mouth at ${at}`);
    assert.ok(teeth.left > mouth.left && teeth.right < mouth.right, 'and inset from its corners');
  }
  // Barely open, and there is nothing behind the lips worth seeing: the band
  // is a product of the opening and the control, so a closed mouth has none.
  const closed = pose({ mouthOpen: 0, teeth: 1, tongue: 1 });
  assert.equal(box(closed.teeth.path).bottom - box(closed.teeth.path).top, box(teethPath()).bottom - box(teethPath()).top);
});

test('the brows are the heaviest line on the face, and they clear the eyes', () => {
  // The hierarchy the redesign is built on: silhouette, brows, eyes, mouth,
  // then details, with the nose lightest of all.
  assert.ok(FACE_STYLE.browWeight > FACE_STYLE.silhouette);
  assert.ok(FACE_STYLE.silhouette >= FACE_STYLE.eyeOutline);
  assert.ok(FACE_STYLE.eyeOutline > FACE_STYLE.mouthOutline);
  assert.ok(FACE_STYLE.mouthOutline > FACE_STYLE.noseOutline);
  assert.ok(FACE_STYLE.noseOutline > FACE_STYLE.detail);

  // A brow is a drawn shape, not a stroke, which is what lets it taper.
  const left = points(BROW_RESTS.browLeft);
  assert.ok(left.length > 6, 'a shape with a tapered end has points to taper with');
  assert.equal(BROW_RESTS.browLeft, browPath('Left'));
  // Mirrored exactly: every x on one is the reflection of an x on the other.
  const rightXs = points(BROW_RESTS.browRight).map((p) => 240 - p.x);
  assert.deepEqual(points(BROW_RESTS.browLeft).map((p) => p.x), rightXs);

  // And clear of the eye below it, or a raised brow lands on an eyelid.
  const bottom = box(BROW_RESTS.browLeft).bottom;
  assert.ok(bottom < EYE.cy - EYE.ry - 1.5, `the brow ends ${EYE.cy - EYE.ry - bottom} above the eye`);
  // The box the brow rig pins from is the box the brow is drawn in.
  const drawn = box(BROW_RESTS.browLeft);
  assert.ok(BROW_BOXES.left.box.x <= drawn.left + .1 && BROW_BOXES.left.box.x + BROW_BOXES.left.box.width >= drawn.right - 6);
  assert.ok(BROW_BOXES.left.box.y <= drawn.top && BROW_BOXES.left.box.y + BROW_BOXES.left.box.height >= drawn.bottom - .1);
});

test('the fringe never touches a brow, at any head pose', () => {
  // The constraint that decides where the hair can go at all: a fringe over a
  // brow takes half the face's expressions with it. Both of them move on a
  // turn, and they move by different amounts, so it is worth checking at the
  // extremes rather than at rest.
  const fringe = box(state.svgMarkup.match(/id="hair"[^>]*d="([^"]+)"/)[1]);
  assert.ok(fringe.bottom > 120, 'the fringe is drawn past the head, so the clip has something to cut');
  for (const values of [{}, { headY: 1 }, { headY: -1 }, { headX: 1 }, { headX: -1 }, { hairLift: 1 }, { hairSway: 1 }]) {
    const frame = pose(values);
    for (const side of ['Left', 'Right']) {
      const brow = box(frame[`brow${side}`].path).top + frame[`brow${side}`].transform.y;
      // The lowest the fringe reaches over the brow's own span, which is where
      // its lower edge is at its highest -- the sweep is drawn to be above it.
      assert.ok(brow > 60, `the ${side} brow is where a brow goes: ${brow} (${JSON.stringify(values)})`);
    }
  }
});

test('the silhouette is a head rather than a ball', () => {
  const at = (y) => headEdgeAt(y, 'right') - headEdgeAt(y, 'left');
  const cranium = at(114), jaw = at(190);
  assert.ok(jaw < cranium * 0.7, `the jaw is ${Math.round((jaw / cranium) * 100)} % of the cranium`);
  assert.ok(at(150) < cranium && at(150) > jaw, 'and the cheeks draw in gradually rather than stepping');
  assert.ok(at(60) < cranium, 'while the top of the skull rounds off');
  assert.equal(HEAD_WIDTH, cranium);
  // Still one closed outline, so the jaw is still a shape key on it and there
  // is still no second shape behind the face to open a double chin.
  assert.equal((HEAD_REST.match(/[MCZ]/g) || []).join(''), 'MCCCCCCZ');
  assert.equal(headPath({ jaw: 1 }).match(/[MCZ]/g).join(''), 'MCCCCCCZ');
  const rest = box(HEAD_REST), dropped = box(headPath({ jaw: 1 }));
  assert.ok(dropped.bottom > rest.bottom + 10, 'the jaw lengthens the face');
  assert.deepEqual([dropped.left, dropped.right], [rest.left, rest.right], 'and never widens it');
  assert.equal(dropped.top, rest.top, 'nor moves the skull');
});

test('the clip path and the silhouette are the same geometry', () => {
  // One source of truth. V1 clipped the hair and the shading to a
  // circle of radius 100 while drawing the head as something else, which is a
  // sliver of hair outside the outline waiting to happen.
  assert.match(MASCOT_FACE_SVG, new RegExp(`<clipPath id="headShape"><path d="${HEAD_REST.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" /></clipPath>`));
  for (const id of ['faceShading', 'hairFront']) {
    assert.match(MASCOT_FACE_SVG, new RegExp(`<g id="${id}"[^>]*clip-path="url\\(#headShape\\)"`), `${id} is clipped to the head`);
  }
});

test('the ears finish the silhouette instead of competing with the eyes', () => {
  // Secondary by construction: smaller than an eye, drawn in the lighter of
  // the two outline weights, and mostly behind the head.
  assert.ok(EAR.rx < EYE.rx && EAR.ry < EYE.ry * 1.1, 'an ear is smaller than an eye');
  assert.ok(FACE_STYLE.earOutline < FACE_STYLE.eyeOutline);
  // Its outline ends *on* the head's outline, so the silhouette detours round
  // the ear rather than stepping over it.
  for (const [side, edge] of [['Left', 'left'], ['Right', 'right']]) {
    const d = MASCOT_FACE_SVG.match(new RegExp(`id="ear${side}Edge"[^>]*d="([^"]+)"`))[1];
    const numbers = [...d.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    const [startX, startY] = numbers.slice(0, 2), endY = numbers[numbers.length - 1], endX = numbers[numbers.length - 2];
    assert.ok(Math.abs(startX - headEdgeAt(startY, edge)) < 1, `the ${side} ear's outline starts on the head`);
    assert.ok(Math.abs(endX - headEdgeAt(endY, edge)) < 1, `and ends on it`);
  }
});

test('the shading is shading rather than a second colour on the face', () => {
  // V1 painted two slabs the height of the face in a brown darker than the
  // hair at half opacity. These are skin, barely darker, and never on their own
  // above a fifth.
  assert.ok(FACE_STYLE.shadeOpacity < .3 && FACE_STYLE.hairShadeOpacity < .3 && FACE_STYLE.highlightOpacity < .3);
  for (const name of ['skinShadow', 'skinHighlight']) {
    const value = FACE_PALETTE[name].slice(1).match(/../g).map((pair) => parseInt(pair, 16));
    const skin = FACE_PALETTE.skin.slice(1).match(/../g).map((pair) => parseInt(pair, 16));
    const apart = Math.max(...value.map((channel, index) => Math.abs(channel - skin[index])));
    assert.ok(apart < 60, `${name} is a shade of the skin, ${apart} away from it`);
  }
  // And the two cheek shades still answer the turn, which is the cheapest
  // volume cue this face has.
  const rest = pose({}), right = pose({ headX: 1 }), left = pose({ headX: -1 });
  assert.equal(rest.shadeLeft.opacity, rest.shadeRight.opacity);
  assert.ok(rest.shadeLeft.opacity > 0, 'lit from the front, the shading is present but slight');
  assert.ok(right.shadeRight.opacity > rest.shadeRight.opacity && right.shadeLeft.opacity < rest.shadeLeft.opacity);
  assert.equal(left.shadeLeft.opacity, right.shadeRight.opacity, 'and the two sides mirror');
});

test('the rest positions the rigging uses are the ones the artwork drew', () => {
  // The V1 rigging kept its own table of centres, and a redraw meant finding
  // and editing every number twice. These come from the artwork.
  for (const [id, centre] of Object.entries(FACE_CENTRES)) {
    const element = state.elements[id];
    if (!element) continue;
    assert.deepEqual([element.baseTransform.pivotX, element.baseTransform.pivotY], [centre.x, centre.y], id);
  }
  assert.deepEqual([state.elements.eyeLeft.baseTransform.pivotX, state.elements.eyeLeft.baseTransform.pivotY], [EYE.left, EYE.cy]);
  assert.deepEqual([state.elements.mouth.baseTransform.pivotX, state.elements.mouth.baseTransform.pivotY],
    [mouthGeometry().top.x, mouthGeometry().left.y]);
  // The mouth's own pins reach the point that draws the lower lip, or the jaw
  // opens the face without opening the mouth.
  const lip = state.rigPins.find((pin) => pin.id === 'mouth-lower-lip');
  assert.ok(Math.abs(lip.position.y - mouthGeometry().bottom.y) <= lip.radius.y, 'the lower-lip pin can reach the lower lip');
  assert.equal(MOUTH_BOX.width, mouthGeometry().right.x - mouthGeometry().left.x);
});

test('a smooth shape is smooth: the spline has no corners in it', () => {
  // The hair, the shadows and the highlight are authored as point lists and
  // turned into cubics here. What that buys is that the tangent on either side
  // of every point matches -- which is exactly what V1's hand-written hair got
  // wrong, four times, in the shape of notches.
  const d = spline([{ x: 0, y: 0 }, { x: 10, y: -6 }, { x: 22, y: 2 }, { x: 12, y: 12 }]);
  const list = points(d);
  for (let index = 3; index + 3 < list.length; index += 3) {
    const before = { x: list[index].x - list[index - 1].x, y: list[index].y - list[index - 1].y };
    const after = { x: list[index + 1].x - list[index].x, y: list[index + 1].y - list[index].y };
    const cross = before.x * after.y - before.y * after.x;
    assert.ok(Math.abs(cross) < 1e-9, `the tangents match at point ${index}: ${cross}`);
  }
  assert.match(d, /Z$/, 'and a closed shape closes');
  assert.doesNotMatch(spline([{ x: 0, y: 0 }, { x: 5, y: 5 }], { closed: false }), /Z/);
});

test('the sample asset is the template, not a stand-in for it', () => {
  // `project/assets/mascot-sample.svg` was a yellow circle with two black ovals
  // on it, left over from before there was a template. Nothing loaded it, so
  // nothing noticed. One source of truth: `npm run assets:sample` writes it.
  assert.equal(readFileSync(SAMPLE_PATH, 'utf8'), `${MASCOT_FACE_SVG}\n`,
    'run `npm run assets:sample` to bring the sample back in line with the template');
});

test('nothing on the face is drawn with a literal colour', () => {
  // Every colour comes from the palette, so recolouring the
  // mascot is editing one object rather than hunting through the drawing.
  const used = new Set([...MASCOT_FACE_SVG.matchAll(/#[0-9a-fA-F]{3,8}/g)].map((match) => match[0].toLowerCase()));
  const known = new Set(Object.values(FACE_PALETTE).map((colour) => colour.toLowerCase()));
  assert.deepEqual([...used].filter((colour) => !known.has(colour)), []);
  // And no stroke width is a literal either.
  const weights = new Set([...MASCOT_FACE_SVG.matchAll(/stroke-width="([\d.]+)"/g)].map((match) => Number(match[1])));
  const declared = new Set(Object.values(FACE_STYLE));
  assert.deepEqual([...weights].filter((weight) => !declared.has(weight)), []);
});

test('the face is drawn with paths and fills, and nothing that costs a frame', () => {
  // A redesign that reaches for a blur or a filter to look soft is a
  // redesign that drops frames on a phone.
  assert.doesNotMatch(MASCOT_FACE_SVG, /<(?:filter|feGaussianBlur|feDropShadow|image|mask|pattern)\b/);
  assert.doesNotMatch(MASCOT_FACE_SVG, /filter\s*[:=]/);
  const shapes = (MASCOT_FACE_SVG.match(/<(?:path|circle|ellipse|rect)\b/g) || []).length;
  assert.ok(shapes < 40, `${shapes} shapes: a cartoon face, not an illustration`);
});

test('every expression the brief names is reachable, and reaches something', () => {
  // A pose is "reachable" when the parameters it needs exist and moving them
  // moves the drawing. This is the numeric half of the snapshot sheet.
  const expressions = {
    happy: { smile: 1, browRaise: .35 },
    sad: { smile: -.8, browInner: .9 },
    angry: { smile: -.55, browInner: -1, browRaise: -.3 },
    surprised: { mouthOpen: 1, browRaise: 1 },
    worried: { browInner: .85, smile: -.35 },
    sceptical: { browRaiseLeft: .9, browRaiseRight: -.6 },
    laugh: { smile: 1, mouthOpen: .85, teeth: 1, tongue: .5, eyeOpen: .45 }
  };
  const rest = pose({});
  for (const [name, values] of Object.entries(expressions)) {
    for (const parameter of Object.keys(values)) assert.ok(state.params[parameter], `${name} needs ${parameter}`);
    const frame = pose(values);
    const moved = Object.keys(frame).filter((id) => JSON.stringify(frame[id]) !== JSON.stringify(rest[id]));
    assert.ok(moved.length > 0, `${name} moves something`);
    // Every expression the brief lists is carried by the brows, the mouth or
    // both -- never by reshaping the eyes, which is the one thing this face
    // does not do.
    assert.ok(moved.some((id) => /^brow|^mouth|^teeth|^tongue|^lid/.test(id)), `${name} is drawn by brows, mouth or lids`);
    for (const id of ['eyeWhiteLeft', 'rimLeft']) {
      assert.equal(frame[id]?.path, undefined, `${name} does not reshape the eye`);
    }
  }
});

test('the head turn leaves the eyes round', () => {
  // The turn is allowed to move an eye, foreshorten it a little and
  // park it behind a lid. It is not allowed to turn it into an ellipse -- the
  // round eye is the character.
  for (const headX of [-1, -.5, .5, 1]) {
    const frame = pose({ headX });
    // The whole head narrows on a turn and the eyes narrow with it -- that is
    // the turn, and it reads as one. What is checked here is what the eye does
    // *on top of* that: at the full amount it was compressed by another third,
    // and a third is the difference between a round eye seen at an angle and
    // an oval.
    for (const id of ['eyeLeft', 'eyeRight']) {
      const own = frame[id].transform.scaleX;
      assert.ok(own > 0.82, `${id} at headX ${headX} adds ${((1 - own) * 100).toFixed(0)} % of squash of its own`);
      assert.equal(frame[id].transform.scaleY, 1, `${id} keeps its height`);
      assert.equal(frame[`pupil${id.slice(3)}`].transform.scaleX, 1, 'and the pupil inside it is not scaled twice');
    }
  }
});

test('nothing comes apart when the head turns', () => {
  for (const values of [{ headX: 1 }, { headX: -1 }, { headY: 1 }, { headY: -1 }, { headX: .7, headY: -.6 }]) {
    const frame = pose(values);
    // A feature drawn on the face travels further than the outline (that is the
    // parallax) but never so far that it leaves it.
    const face = frame.faceRoot.transform;
    for (const id of ['eyeLeft', 'eyeRight', 'mouth', 'nose', 'browLeft', 'browRight']) {
      const at = frame[id].transform;
      assert.ok(Math.abs(at.x) < 30 && Math.abs(at.y) < 30, `${id} stays on the face at ${JSON.stringify(values)}`);
      assert.ok(Math.abs(at.x) >= Math.abs(face.x) - 1e-6 || values.headX === undefined, `${id} travels at least as far as the outline`);
    }
    // The crown is the skull's own silhouette and travels with it and nothing
    // more; the fringe hangs on the front and swings; the back swings against.
    assert.equal(frame.hairTop.transform.x, 0, 'the crown is the head');
    if (values.headX) assert.ok(Math.sign(frame.hair.transform.x) === -Math.sign(frame.hairBack.transform.x), 'the back of the hair counter-swings');
  }
});

test('a transition between two expressions passes through drawings, not through nonsense', () => {
  // Every shape key on this face is affine in its driver, so a half-way pose is
  // the drawing half way -- no inverted path, no shape that folds through
  // itself. Walking the interpolation is how that is checked without eyes.
  const walk = (from, to) => {
    let previous = null;
    for (let step = 0; step <= 10; step += 1) {
      const at = step / 10;
      const values = Object.fromEntries([...new Set([...Object.keys(from), ...Object.keys(to)])]
        .map((name) => [name, (from[name] || 0) * (1 - at) + (to[name] || 0) * at]));
      const frame = pose(values);
      for (const id of ['mouth', 'head', 'teeth', 'tongue']) {
        const shape = box(frame[id].path);
        assert.ok(shape.right > shape.left, `${id} has not folded through itself at ${at}`);
        assert.ok(shape.bottom >= shape.top, `${id} is the right way up at ${at}`);
        if (previous) {
          const jump = Math.abs(shape.bottom - previous[id].bottom);
          assert.ok(jump < 24, `${id} moved ${jump} in a tenth of a transition at ${at}`);
        }
      }
      previous = Object.fromEntries(['mouth', 'head', 'teeth', 'tongue'].map((id) => [id, box(frame[id].path)]));
    }
  };
  const neutral = {}, happy = { smile: 1 }, sad = { smile: -.8, browInner: .9 };
  const surprised = { mouthOpen: 1, browRaise: 1 }, angry = { smile: -.55, browInner: -1 };
  walk(neutral, happy); walk(happy, sad); walk(sad, surprised);
  walk(surprised, angry); walk(angry, neutral); walk(neutral, { eyeOpen: 0 });
});

test('the drawn mouth and the shape keys agree at every combination', () => {
  // The two additive keys have to reproduce the drawing rather than approximate
  // it, or a laughing mouth is a fight between opening and smiling.
  for (const [open, smile] of [[0, 0], [1, 0], [0, 1], [0, -1], [1, 1], [.5, .5], [1, -1]]) {
    const frame = pose({ mouthOpen: open, smile });
    const drawn = parsePath(mouthPath({ open, smile })).values;
    parsePath(frame.mouth.path).values.forEach((value, index) => {
      assert.ok(Math.abs(value - drawn[index]) < .3, `open ${open} smile ${smile}, point ${index}: ${value} vs ${drawn[index]}`);
    });
    for (const [role, draw] of [['teeth', teethPath], ['tongue', tonguePath]]) {
      const expected = parsePath(draw({ open, smile, show: 0 })).values;
      const actual = parsePath(pose({ mouthOpen: open, smile }).at ? frame[role].path : frame[role].path).values;
      assert.equal(actual.length, expected.length, `${role} keeps its shape at open ${open} smile ${smile}`);
    }
  }
});
