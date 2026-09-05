import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEAD_TURN_LAYERS, HEAD_TURN_STRENGTHS, DEFAULT_HEAD_TURN_UNIT,
  generateHeadTurn, headTurnBindings, headTurnCellSamples, headTurnElements, headTurnKeyforms, headTurnTravel, headTurnUnit
} from '../head-pose/head-pose-turn.js';
import { captureHeadPose, createHeadPoseAxes, headPoseCellSamples, headPoseCellState } from '../head-pose/head-pose-model.js';
import { compileRigFrame } from '../../../runtime/runtime.js';

const axes = createHeadPoseAxes();
const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1, bindings: {}, constraints: {} });
const headBinding = (property, expression, amplitude) => ({ enabled: true, mode: 'simple', expression, curve: 'linear', amplitude, offset: 0 });

/** A rigged head: the outline is a group, the features are drawn inside it. */
function project({ nested = true } = {}) {
  const ids = ['face', 'eyeL', 'eyeR', 'pupilL', 'pupilR', 'browL', 'browR', 'nose', 'mouth', 'earL', 'earR'];
  const leaf = (id) => ({ id, name: id, type: 'path', visible: true, children: [] });
  const features = ids.slice(1);
  return {
    svgMarkup: '<svg/>',
    elements: Object.fromEntries(ids.map((id) => [id, element()])),
    layers: nested ? [{ id: 'face', name: 'face', type: 'g', visible: true, children: features.map(leaf) }] : ids.map(leaf),
    semanticParts: {
      head: { id: 'head', type: 'head', roles: { head: 'face' }, controls: ['headX', 'headY'], controlDrivers: { headX: { property: 'translateX' }, headY: { property: 'translateY' } } },
      eyes: { id: 'eyes', type: 'eyes', roles: { leftEye: 'eyeL', rightEye: 'eyeR' } },
      gaze: { id: 'gaze', type: 'gaze', roles: { leftPupil: 'pupilL', rightPupil: 'pupilR' } },
      eyebrows: { id: 'eyebrows', type: 'eyebrows', roles: { leftBrow: 'browL', rightBrow: 'browR' } },
      nose: { id: 'nose', type: 'nose', roles: { nose: 'nose' } },
      mouth: { id: 'mouth', type: 'mouth', roles: { mouth: 'mouth' } },
      ears: { id: 'ears', type: 'ears', roles: { leftEar: 'earL', rightEar: 'earR' } },
      hand: { id: 'hand', type: 'leftHand', roles: { hand: 'handL' } }
    },
    params: { headX: { type: 'number', min: -1, max: 1, default: 0, value: 0 }, headY: { type: 'number', min: -1, max: 1, default: 0, value: 0 } },
    keyforms: []
  };
}
const withHeadBinding = (document, amplitude = 8) => {
  document.elements.face.bindings = { translateX: headBinding('translateX', 'headX', amplitude), translateY: headBinding('translateY', 'headY', amplitude) };
  return document;
};

/** Where each part sits, the way the editor measures it on the canvas. */
const CENTERS = Object.freeze({
  face: { x: 120, y: 120 }, eyeL: { x: 82, y: 104 }, eyeR: { x: 158, y: 104 },
  pupilL: { x: 82, y: 104 }, pupilR: { x: 158, y: 104 }, browL: { x: 82, y: 80 }, browR: { x: 158, y: 80 },
  nose: { x: 120, y: 130 }, mouth: { x: 120, y: 160 }, earL: { x: 30, y: 110 }, earR: { x: 210, y: 110 }
});
/** Artwork whose pivots were already set to each part's own centre. */
const withPivots = (document) => {
  for (const [id, centre] of Object.entries(CENTERS)) Object.assign(document.elements[id].baseTransform, { pivotX: centre.x, pivotY: centre.y });
  return document;
};
const measured = ({ nested = true } = {}) => withPivots(withHeadBinding(project({ nested })));

test('a turn is built from the face parts, and only the ones that belong to a head', () => {
  const layers = headTurnElements(measured(), { centers: CENTERS });
  const byElement = Object.fromEntries(layers.map((layer) => [layer.elementId, layer]));
  assert.deepEqual(Object.keys(byElement).sort(), ['browL', 'browR', 'earL', 'earR', 'eyeL', 'eyeR', 'face', 'mouth', 'nose', 'pupilL', 'pupilR']);
  assert.equal('handL' in byElement, false, 'a hand is not part of the head');
  // The nose is the closest thing to the viewer, the ears sit on the axis.
  assert.ok(byElement.nose.depth > byElement.pupilL.depth);
  assert.ok(byElement.pupilL.depth > byElement.eyeL.depth);
  assert.ok(byElement.eyeL.depth > byElement.earL.depth);
  // The outline makes a small bodily shift of its own -- less than any feature,
  // which is what parallax means. It used to be 0 because the head's translateX
  // binding carried that shift, and `headX` then drove a slide and a turn at
  // once: the slide won, and the turn was invisible.
  assert.ok(byElement.face.depth > 0 && byElement.face.depth < byElement.eyeL.depth, 'the outline moves, but far less than the features on it');
  assert.deepEqual([byElement.eyeL.side, byElement.eyeR.side, byElement.nose.side], ['left', 'right', null]);
  assert.equal(headTurnElements({}).length, 0);
  assert.equal(HEAD_TURN_LAYERS.hand, undefined);
});

test('the turn is measured from the head, and falls back to what the movement travels', () => {
  const document = withHeadBinding(project(), 12);
  // 5% of the head width moved the deepest feature four pixels on a hundred-pixel
  // head, which no eye reads as a turn. The parallax has to be a real fraction.
  assert.equal(headTurnUnit(document, { headWidth: 200 }), 28, 'about 14% of the head width');
  assert.equal(headTurnUnit(document), 12, 'otherwise the head movement amplitude');
  assert.equal(headTurnUnit({}), DEFAULT_HEAD_TURN_UNIT, 'and a sane default with no rig at all');
  assert.equal(headTurnUnit(document, { headWidth: 4000 }), 90, 'clamped, so a huge canvas cannot fling the features');
  assert.equal(headTurnUnit(document, { headWidth: 20 }), 3);
  assert.deepEqual(headTurnTravel(document), { x: 12, y: 12 });
  assert.deepEqual(headTurnTravel(project()), { x: 0, y: 0 }, 'no binding, nothing to carry');
});

test('turning right moves the features right, widens the near side and hides the far ear', () => {
  const turn = generateHeadTurn(measured(), { headWidth: 200, centers: CENTERS });
  const right = turn.cells.find((cell) => cell.x === 1 && cell.y === 0).samples;

  // Everything travels the same way, the deeper the further.
  assert.ok(right.nose.translateX > right.pupilL.translateX);
  assert.ok(right.pupilL.translateX > right.eyeL.translateX);
  assert.ok(right.eyeL.translateX > 0);
  // The turn owns the whole movement, outline included, so the two are
  // proportioned against each other instead of one being a separate binding.
  assert.ok(right.face.translateX > 0);
  assert.ok(right.eyeL.translateX > right.face.translateX * 2, 'the features travel far further than the outline');
  assert.ok(right.face.scaleX < 0.95, 'and a turned head is visibly narrower');
  assert.ok(right.mouth.scaleX < 0.95, 'a feature on the middle line is foreshortened, not just displaced');

  // Turning right brings the left side of the face towards the viewer.
  assert.ok(right.eyeL.scaleX > 1 && right.eyeR.scaleX < 1);
  assert.ok(right.browL.scaleX > 1 && right.browR.scaleX < 1);
  assert.equal(right.earL.opacity, 1);
  assert.ok(right.earR.opacity < 1 && right.earR.opacity > 0, 'the far ear goes behind the head');
  assert.ok(right.earR.scaleX < right.earL.scaleX);

  // The other side is the mirror of it.
  const left = turn.cells.find((cell) => cell.x === -1 && cell.y === 0).samples;
  assert.equal(left.nose.translateX, -right.nose.translateX);
  assert.equal(left.eyeR.scaleX, right.eyeL.scaleX);
  assert.equal(left.earL.opacity, right.earR.opacity);
});

test('looking up and down moves the features with the head and compresses it', () => {
  const turn = generateHeadTurn(measured(), { headWidth: 200, centers: CENTERS });
  const up = turn.cells.find((cell) => cell.x === 0 && cell.y === -1).samples;
  const down = turn.cells.find((cell) => cell.x === 0 && cell.y === 1).samples;
  assert.ok(up.nose.translateY < 0, 'up is a negative headY, and the nose goes up');
  assert.equal(down.nose.translateY, -up.nose.translateY);
  assert.ok(up.nose.scaleY < 1, 'a centre feature is foreshortened looking up, like the outline');
  assert.equal(up.eyeL.scaleY, undefined, 'a paired feature is not: it has a near and far half instead');
  const right = turn.cells.find((cell) => cell.x === 1 && cell.y === 0).samples;
  assert.ok(Math.abs(up.nose.translateY) < Math.abs(right.nose.translateX), 'a nod travels less than a turn');
  assert.ok(up.face.scaleY < 1 && down.face.scaleY < 1);
  assert.equal(up.eyeL.scaleX, undefined, 'a vertical turn has no near and far side');
});

test('the centre is deliberately neutral, so rest holds instead of drifting', () => {
  const turn = generateHeadTurn(measured(), { headWidth: 200, centers: CENTERS });
  const centre = turn.cells.find((cell) => cell.x === 0 && cell.y === 0);
  // Every channel the turn writes anywhere is written here too, at its neutral
  // value: a lone sample holds across the whole axis, so a depth captured only
  // at the edges would push the part back at rest as well.
  assert.deepEqual(centre.samples.nose, { translateX: 0, translateY: 0, depth: 0, scaleX: 1, scaleY: 1 });
  assert.deepEqual(centre.samples.face, { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1 },
    'the outline is the surface the depths are measured against, so it has none of its own');
  const keyforms = headTurnKeyforms([], measured(), { headWidth: 200, centers: CENTERS });
  assert.equal(headPoseCellState(keyforms, axes, { i: 1, j: 1 }), 'neutral');
  assert.equal(headPoseCellState(keyforms, axes, { i: 2, j: 1 }), 'captured');
});

test('a feature that is not inside the head carries the head movement itself', () => {
  const nestedTurn = generateHeadTurn(withHeadBinding(project({ nested: true })), { unit: 10 });
  const flatTurn = generateHeadTurn(withHeadBinding(project({ nested: false })), { unit: 10 });
  const nose = (turn) => turn.cells.find((cell) => cell.x === 1 && cell.y === 0).samples.nose.translateX;
  const outline = (turn) => turn.cells.find((cell) => cell.x === 1 && cell.y === 0).samples.face.translateX;
  assert.equal(nose(nestedTurn), 10, 'drawn inside the head group, it inherits what the outline travels');
  assert.equal(nose(flatTurn), 10 + outline(flatTurn), 'drawn beside it, it has to travel that itself');
  assert.ok(outline(flatTurn) > 0);
  assert.equal(nestedTurn.elements.find((layer) => layer.elementId === 'nose').inherits, true);
  assert.equal(flatTurn.elements.find((layer) => layer.elementId === 'nose').inherits, false);
});

/**
 * The eye assembly the template draws: a group holding the white, the pupil and
 * the lids, clipped to its socket. What is asserted is that nesting is
 * *subtracted* -- the pupil adds the little it is deeper than its eye, and no
 * more, or it crosses the face while the socket around it stays put.
 */
function nestedEyes() {
  const document = withHeadBinding(project());
  const leaf = (id) => ({ id, name: id, type: 'path', visible: true, children: [] });
  document.elements.lidL = { ...element() };
  document.semanticParts.eyelids = { id: 'eyelids', type: 'eyelids', roles: { leftUpper: 'lidL' } };
  document.layers = [{
    id: 'face', name: 'face', type: 'g', visible: true, children: [
      { id: 'eyeL', name: 'eyeL', type: 'g', visible: true, children: [leaf('pupilL'), leaf('lidL')] },
      leaf('eyeR'), leaf('pupilR'), leaf('browL'), leaf('browR'), leaf('nose'), leaf('mouth'), leaf('earL'), leaf('earR')
    ]
  }];
  return document;
}

test('a part drawn inside another part only adds what it is deeper', () => {
  const turn = generateHeadTurn(nestedEyes(), { unit: 10, centers: CENTERS });
  const right = turn.cells.find((cell) => cell.x === 1 && cell.y === 0).samples;
  const layers = Object.fromEntries(turn.elements.map((layer) => [layer.elementId, layer]));

  // The pupil is drawn inside its eye, so it carries the eye and adds the 0.07
  // it is deeper. Its twin outside adds the whole 0.62 itself.
  assert.equal(layers.pupilL.parentId, 'eyeL');
  assert.equal(layers.pupilR.parentId, 'face');
  assert.ok(right.pupilL.translateX < right.eyeL.translateX / 4, 'inside its eye, a pupil barely moves on its own');
  // What the viewer sees is the same either way: the eye plus the difference.
  assert.ok(Math.abs((right.eyeL.translateX + right.pupilL.translateX) - right.pupilR.translateX) < 0.01);

  // An eyelid is exactly as deep as the eye it is drawn in, so it has nothing
  // to add at all -- it simply rides the group.
  assert.equal(right.lidL.translateX, undefined);
  // And it must not foreshorten twice: the eye around it already did.
  assert.equal(layers.lidL.carryScale, true);
  assert.equal(right.lidL.scaleX, undefined);
  assert.ok(right.eyeL.scaleX > 1);
  // The head's own squash is a different cue and still composes with the
  // features' near/far: a feature inside the head keeps its own scale.
  assert.equal(layers.eyeL.carryScale, false);
});

/**
 * The three things the pseudo-projector buys over the linear parallax it
 * replaced (3D-05, docs/PSEUDO_3D_BASELINE.md). Each of them is a case the old
 * `translateX = headX · unit · depth` could not express at all, so each is a
 * behaviour test rather than a tightened number: everything the linear formula
 * did get right is asserted above, unchanged.
 */
test('a diagonal is one turn, not a sideways slide plus an upward one', () => {
  const turn = generateHeadTurn(measured(), { headWidth: 200, centers: CENTERS });
  const at = (x, y) => turn.cells.find((cell) => cell.x === x && cell.y === y).samples;
  const [right, down, corner] = [at(1, 0), at(0, 1), at(1, 1)];

  // Turning right takes the right ear round the back of the head. Once it is
  // there, looking down cannot lift it the way it lifts an ear still out at the
  // side -- it has spent its depth on the turn. Adding two slides misses that
  // by fifteen pixels on a two-hundred-wide face, which is the whole reason
  // this is a rotation now.
  const added = (part) => right[part].translateY + down[part].translateY;
  assert.ok(corner.earR.translateY < 0, 'the far ear rises as the head drops, because it has swung behind');
  assert.ok(Math.abs(corner.earR.translateY - added('earR')) > 10);
  assert.ok(corner.earL.translateY > added('earL') + 10, 'and the near ear drops further than either move alone');
  // Even the nose, which sits on the axis and so goes nowhere sideways, drops
  // less on the diagonal than looking down alone: turning has already spent
  // part of the depth the drop was going to come from.
  assert.ok(corner.nose.translateY > 0 && corner.nose.translateY < added('nose') - 2);
});

test('the near and far halves of a pair no longer travel the same distance', () => {
  // The same face, drawn inside a head group and drawn beside it. Nesting is a
  // drawing decision; what the viewer sees must not depend on it, so the
  // composed screen movement is the one to compare.
  const nested = generateHeadTurn(measured(), { headWidth: 200, centers: CENTERS });
  const flat = generateHeadTurn(measured({ nested: false }), { headWidth: 200, centers: CENTERS });
  const cell = (turn) => turn.cells.find((item) => item.x === 1 && item.y === 0).samples;
  const [inside, beside] = [cell(nested), cell(flat)];
  // Inside the group: what the outline does to this point, plus its own share.
  const screen = (samples, id) => samples.face.translateX
    + (samples.face.scaleX - 1) * (CENTERS[id].x - CENTERS.face.x)
    + samples[id].translateX;

  for (const id of ['eyeL', 'eyeR', 'nose']) {
    assert.ok(Math.abs(screen(inside, id) - beside[id].translateX) < 0.01, `${id} moves the same either way`);
  }
  // And that movement is a swing: the eye coming towards the viewer crosses
  // well over half again what the one going away does. Under the linear
  // formula the two were identical -- same depth, same travel -- and only the
  // widen/narrow said which was which.
  assert.ok(screen(inside, 'eyeL') > screen(inside, 'eyeR') * 1.6);
  assert.ok(screen(inside, 'eyeR') > 0, 'the far eye still travels with the head, it does not stall');
});

test('the outline narrows by the cosine of the turn it is making', () => {
  const turn = generateHeadTurn(measured(), { headWidth: 200, centers: CENTERS });
  const at = (x, y) => turn.cells.find((cell) => cell.x === x && cell.y === y).samples;
  // 30 degrees of yaw, 18 of pitch: the sweep the projector turns a full head
  // pose through. The squash used to be a tuned 0.1, which said the same thing
  // three percent differently -- and three percent of disagreement between the
  // outline and the features drawn on it is the features drifting off the face.
  assert.equal(at(1, 0).face.scaleX, Number(Math.cos(30 * Math.PI / 180).toFixed(4)));
  assert.equal(at(0, 1).face.scaleY, Number(Math.cos(18 * Math.PI / 180).toFixed(4)));
  assert.equal(at(1, 0).face.scaleY, 1, 'a sideways turn does not squash the height');
  assert.equal(at(-1, 0).face.scaleX, at(1, 0).face.scaleX, 'and it narrows the same either way');
});
test('the far ear goes behind the head rather than translucent over the page', () => {
  const turn = generateHeadTurn(measured(), { headWidth: 200, centers: CENTERS });
  const right = turn.cells.find((cell) => cell.x === 1 && cell.y === 0).samples;
  // Turning right, the right ear is the far one: it slides back towards the
  // middle of the face, where the outline covers it.
  assert.ok(right.earR.translateX < 0, 'the far ear moves against the turn, behind the outline');
  assert.ok(right.earL.translateX > 0, 'the near one comes round with it');
  assert.ok(right.earR.opacity < 0.4);
  const left = turn.cells.find((cell) => cell.x === -1 && cell.y === 0).samples;
  assert.equal(left.earL.translateX, -right.earR.translateX, 'and the other way is its mirror');
});

test('strength scales the whole effect and stays inside what a transform can mean', () => {
  const document = measured();
  const at = (strength) => generateHeadTurn(document, { headWidth: 200, strength, centers: CENTERS }).cells.find((cell) => cell.x === 1 && cell.y === 0).samples;
  const subtle = at(HEAD_TURN_STRENGTHS.subtle), normal = at(HEAD_TURN_STRENGTHS.normal), strong = at(HEAD_TURN_STRENGTHS.strong);
  assert.ok(subtle.nose.translateX < normal.nose.translateX);
  assert.ok(strong.nose.translateX > normal.nose.translateX);
  assert.ok(strong.eyeR.scaleX < normal.eyeR.scaleX);
  assert.deepEqual(at(0).nose, { translateX: 0, translateY: 0, depth: 0, scaleX: 1, scaleY: 1 }, 'no strength, no turn');

  // Nothing can invert or vanish, whatever a caller asks for.
  const absurd = headTurnCellSamples(headTurnElements(document, { centers: CENTERS }), { x: 1, unit: 10, strength: 99 });
  for (const sample of Object.values(absurd)) {
    if ('scaleX' in sample) assert.ok(sample.scaleX >= 0.2 && sample.scaleX <= 3, JSON.stringify(sample));
    if ('opacity' in sample) assert.ok(sample.opacity >= 0 && sample.opacity <= 1);
  }
});

test('the turn says how much nearer or further it left each part, and the runtime bands it', () => {
  const turn = generateHeadTurn(measured(), { headWidth: 200, centers: CENTERS });
  const right = turn.cells.find((cell) => cell.x === 1 && cell.y === 0).samples;
  const left = turn.cells.find((cell) => cell.x === -1 && cell.y === 0).samples;

  // Turning right takes the right ear round the back and brings the left one
  // forward. This is the same swing the translate carries, read along the axis
  // that points at the viewer instead of across the screen.
  assert.ok(right.earR.depth < -0.5, 'the far ear is a long way behind where it was drawn');
  assert.ok(right.earL.depth > 0.5, 'and the near one a long way in front');
  assert.equal(left.earL.depth, right.earR.depth, 'the other way round is its mirror');
  assert.ok(right.eyeR.depth < 0 && right.eyeL.depth > 0, 'so are the two halves of a pair, by less');
  assert.ok(Math.abs(right.eyeR.depth) < Math.abs(right.earR.depth), 'an eye is nearer the axis than an ear');
  assert.equal('depth' in right.face, false, 'the outline is what the others are measured against');
  // A nose on the axis has depth to spend rather than a side to swing to: it
  // recedes a little instead of going round.
  assert.ok(right.nose.depth < 0 && right.nose.depth > -0.3);
  // Unmeasured artwork has no centre, so there is no swing to report.
  const blind = generateHeadTurn(withHeadBinding(project()), { unit: 10 }).cells.find((cell) => cell.x === 1 && cell.y === 0).samples;
  assert.equal('depth' in blind.earR, false);
});

test('a depth the turn wrote is what the runtime repaints in front or behind', () => {
  const document = measured();
  document.keyforms = headTurnKeyforms(document.keyforms, document, { headWidth: 200, centers: CENTERS });
  const frame = (values) => compileRigFrame(document.elements, { headX: 0, headY: 0, ...values }, {}, {}, { keyforms: document.keyforms });

  // The artwork authors no depth at all, so at rest every part is in the middle
  // band and `draw-order.js` leaves the drawing exactly as it was drawn.
  const rest = frame({});
  assert.deepEqual([...new Set(Object.values(rest).map((item) => item.depthBand))], ['normal']);

  const turned = frame({ headX: 1 });
  assert.equal(turned.earR.depthBand, 'behind', 'the far ear is repainted behind the head');
  assert.equal(turned.earL.depthBand, 'front');
  assert.equal(turned.face.depthBand, 'normal', 'the outline stays where it is');
  // Coming back comes all the way back, or the mascot keeps a shuffled drawing
  // after one turn. (What stops it flickering on the way is the hysteresis in
  // `depthBand`, which the engine feeds the previous frame's bands for; here
  // each frame is compiled on its own, so this is the band at face value.)
  assert.equal(frame({}).earR.depthBand, 'normal');
  assert.equal(frame({ headX: -1 }).earR.depthBand, 'front', 'and turning the other way brings it round');
});

test('a generated turn is ordinary keyforms: the runtime turns the head with no head-pose code', () => {
  const document = measured();
  document.keyforms = headTurnKeyforms(document.keyforms, document, { headWidth: 200, centers: CENTERS });
  // What the command does alongside writing the grid: `headX` drove the head's
  // own translateX binding *and* the grid, and the slide won. The turn owns the
  // movement now, so the binding is switched off.
  for (const { elementId, property } of headTurnBindings(document)) document.elements[elementId].bindings[property].enabled = false;
  assert.ok(document.keyforms.length > 0);
  assert.ok(document.keyforms.every((keyform) => keyform.id.startsWith('headPose:')));

  const frame = (values) => compileRigFrame(document.elements, { headX: 0, headY: 0, ...values }, {}, {}, { keyforms: document.keyforms });
  const rest = frame({}), turned = frame({ headX: 1 });
  assert.equal(rest.nose.transform.x, 0);
  assert.equal(rest.eyeL.transform.scaleX, 1);
  // The outline travels through the grid now, not through a separate binding,
  // and every feature on it travels further.
  assert.ok(turned.face.transform.x > 0);
  assert.ok(turned.eyeL.transform.x > turned.face.transform.x * 2);
  assert.ok(turned.nose.transform.x > turned.eyeL.transform.x);
  assert.ok(turned.face.transform.scaleX < 0.95, 'and the outline is visibly narrower');
  assert.ok(turned.eyeL.transform.scaleX > 1 && turned.eyeR.transform.scaleX < 1);
  assert.ok(turned.earR.opacity < 1);

  // Halfway is halfway: the grid interpolates like any other keyform.
  const half = frame({ headX: 0.5 });
  assert.ok(half.nose.transform.x > 0 && half.nose.transform.x < turned.nose.transform.x);
});

test('regenerating the turn leaves a hand-captured outline exactly where it was', () => {
  // A generated turn is made of transform channels only, and a shape lives in a
  // `pathShape` keyform of its own -- so pressing Generate again after shaping a
  // cell by hand rewrites the movement and never the outline. That is the same
  // ownership a hand-posed transform relies on, one channel further down.
  const document = measured();
  const shapeKeyId = 'headPose-mouth-2-1';
  document.keyforms = captureHeadPose([], { axes, cell: { i: 2, j: 1 }, samples: { mouth: { [`shape:${shapeKeyId}`]: 1 } }, channels: [] });
  const shape = (list) => list.find((keyform) => keyform.channel === 'pathShape');
  const before = shape(document.keyforms);

  const generated = headTurnKeyforms(document.keyforms, document, { headWidth: 200, centers: CENTERS });
  assert.deepEqual(shape(generated), before, 'the outline survived, samples and all');
  assert.ok(headPoseCellSamples(generated, axes, { i: 2, j: 1 }).mouth.translateX > 0, 'and the movement was regenerated over it');
  // Regenerating a second time is no different: it is the movement it replaces.
  assert.deepEqual(shape(headTurnKeyforms(generated, document, { headWidth: 200, strength: HEAD_TURN_STRENGTHS.strong, centers: CENTERS })), before);
});

test('generating replaces the grid and a hand-posed cell can be captured over it', () => {
  const document = measured();
  document.keyforms = headTurnKeyforms(document.keyforms, document, { headWidth: 200, centers: CENTERS });
  const before = headPoseCellSamples(document.keyforms, axes, { i: 2, j: 1 }).nose.translateX;
  const stronger = headTurnKeyforms(document.keyforms, document, { headWidth: 200, strength: HEAD_TURN_STRENGTHS.strong, centers: CENTERS });
  assert.ok(headPoseCellSamples(stronger, axes, { i: 2, j: 1 }).nose.translateX > before);
  assert.notEqual(stronger, document.keyforms, 'a new list, so the command can undo to the old one');
  assert.equal(headTurnKeyforms(document.keyforms, {}, {}), document.keyforms, 'nothing to generate from, nothing written');
});

test('a scale is only generated where the part was measured, and it holds its centre', () => {
  // Unmeasured: scaling would happen around the stored pivot — (0, 0) for most
  // artwork — and drag the part across the drawing. So it is left out.
  const blind = generateHeadTurn(withHeadBinding(project()), { unit: 10 }).cells.find((cell) => cell.x === 1 && cell.y === 0).samples;
  assert.deepEqual(Object.keys(blind.eyeL).sort(), ['translateX', 'translateY']);
  assert.deepEqual(Object.keys(blind.face).sort(), ['translateX', 'translateY'], 'the outline shifts, but nothing to squash around');
  assert.equal(blind.earR.opacity < 1, true, 'the fading far ear needs no geometry');
  assert.equal('scaleX' in blind.earR, false);

  // Measured, with no pivot yet: generating the turn sets the pivot to the
  // part's middle, so the scale needs no correction and the part travels by
  // its parallax and nothing else.
  const document = withHeadBinding(project());
  const eye = generateHeadTurn(document, { unit: 10, centers: CENTERS }).cells.find((cell) => cell.x === 1 && cell.y === 0).samples.eyeL;
  assert.equal(eye.scaleX, 1.24);
  assert.equal(eye.translateX, 5.5, 'the parallax, undisturbed');

  // A pivot the author placed somewhere else is respected, and *there* the
  // correction is needed: pivot + s·(c − pivot) + t = c keeps the part still.
  const chosen = withHeadBinding(project());
  Object.assign(chosen.elements.eyeL.baseTransform, { pivotX: 40, pivotY: 100 });
  const held = generateHeadTurn(chosen, { unit: 10, centers: CENTERS }).cells.find((cell) => cell.x === 1 && cell.y === 0).samples.eyeL;
  const parallax = 10 * 0.55;
  assert.equal(held.translateX, Number((parallax + (1 - 1.24) * (82 - 40)).toFixed(4)));
  const centre = 40 + held.scaleX * (82 - 40) + (held.translateX - parallax);
  assert.ok(Math.abs(centre - 82) < 1e-6, `expected the centre to hold, got ${centre}`);
});

test('the scale correction is unnecessary once the pivot is the part centre', () => {
  const document = withPivots(withHeadBinding(project()));
  const eye = generateHeadTurn(document, { unit: 10, centers: CENTERS }).cells.find((cell) => cell.x === 1 && cell.y === 0).samples.eyeL;
  assert.equal(eye.scaleX, 1.24);
  assert.equal(eye.translateX, 5.5, 'the parallax travel, and nothing to correct');
});

test('a generated turn sets the pivots it needs, and never one that was chosen', async () => {
  const { headTurnPivots } = await import('../head-pose/head-pose-turn.js');

  // Artwork with no pivot at all: scaling around (0, 0) would throw each part
  // across the face, so the turn puts the pivot in the middle of it.
  const bare = withHeadBinding(project());
  const pivots = headTurnPivots(bare, { centers: CENTERS });
  assert.deepEqual(pivots.face, { pivotX: 120, pivotY: 120 }, 'the outline is squashed, so it gets one');
  assert.deepEqual(pivots.eyeL, { pivotX: 82, pivotY: 104 });
  // A centre feature is foreshortened now, so it is scaled and needs a pivot too.
  assert.deepEqual(pivots.nose, { pivotX: 120, pivotY: 130 });
  assert.deepEqual(pivots.mouth, { pivotX: 120, pivotY: 160 });

  // A pivot the author already placed is left exactly where it is.
  const chosen = withHeadBinding(project());
  Object.assign(chosen.elements.eyeL.baseTransform, { pivotX: 70, pivotY: 90 });
  assert.equal('eyeL' in headTurnPivots(chosen, { centers: CENTERS }), false);

  // The samples are written as if those pivots were already in place, because
  // the command that writes them writes the grid in the same step.
  const eye = generateHeadTurn(bare, { unit: 10, centers: CENTERS }).cells.find((cell) => cell.x === 1 && cell.y === 0).samples.eyeL;
  assert.equal(eye.translateX, 5.5, 'the parallax, with nothing to correct');
  assert.equal(eye.scaleX, 1.24);
  assert.deepEqual(generateHeadTurn(withPivots(bare), { unit: 10, centers: CENTERS }).cells.find((cell) => cell.x === 1 && cell.y === 0).samples.eyeL, eye,
    'and the same once they are');

  // Unmeasured artwork has no centre to aim at, so no pivot is invented.
  assert.deepEqual(headTurnPivots(bare), {});
});
