import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HEAD_TURN_LAYERS, HEAD_TURN_STRENGTHS, DEFAULT_HEAD_TURN_UNIT,
  generateHeadTurn, headTurnBindings, headTurnCellSamples, headTurnElements, headTurnKeyforms, headTurnTravel, headTurnUnit
} from '../head-pose/head-pose-turn.js';
import { createHeadPoseAxes, headPoseCellSamples, headPoseCellState } from '../head-pose/head-pose-model.js';
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
  assert.deepEqual(centre.samples.nose, { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1 });
  assert.deepEqual(centre.samples.face, { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1 });
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

test('strength scales the whole effect and stays inside what a transform can mean', () => {
  const document = measured();
  const at = (strength) => generateHeadTurn(document, { headWidth: 200, strength, centers: CENTERS }).cells.find((cell) => cell.x === 1 && cell.y === 0).samples;
  const subtle = at(HEAD_TURN_STRENGTHS.subtle), normal = at(HEAD_TURN_STRENGTHS.normal), strong = at(HEAD_TURN_STRENGTHS.strong);
  assert.ok(subtle.nose.translateX < normal.nose.translateX);
  assert.ok(strong.nose.translateX > normal.nose.translateX);
  assert.ok(strong.eyeR.scaleX < normal.eyeR.scaleX);
  assert.deepEqual(at(0).nose, { translateX: 0, translateY: 0, scaleX: 1, scaleY: 1 }, 'no strength, no turn');

  // Nothing can invert or vanish, whatever a caller asks for.
  const absurd = headTurnCellSamples(headTurnElements(document, { centers: CENTERS }), { x: 1, unit: 10, strength: 99 });
  for (const sample of Object.values(absurd)) {
    if ('scaleX' in sample) assert.ok(sample.scaleX >= 0.2 && sample.scaleX <= 3, JSON.stringify(sample));
    if ('opacity' in sample) assert.ok(sample.opacity >= 0 && sample.opacity <= 1);
  }
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
  assert.equal(eye.scaleX, 1.12);
  assert.equal(eye.translateX, 5.5, 'the parallax, undisturbed');

  // A pivot the author placed somewhere else is respected, and *there* the
  // correction is needed: pivot + s·(c − pivot) + t = c keeps the part still.
  const chosen = withHeadBinding(project());
  Object.assign(chosen.elements.eyeL.baseTransform, { pivotX: 40, pivotY: 100 });
  const held = generateHeadTurn(chosen, { unit: 10, centers: CENTERS }).cells.find((cell) => cell.x === 1 && cell.y === 0).samples.eyeL;
  const parallax = 10 * 0.55;
  assert.equal(held.translateX, Number((parallax + (1 - 1.12) * (82 - 40)).toFixed(4)));
  const centre = 40 + held.scaleX * (82 - 40) + (held.translateX - parallax);
  assert.ok(Math.abs(centre - 82) < 1e-6, `expected the centre to hold, got ${centre}`);
});

test('the scale correction is unnecessary once the pivot is the part centre', () => {
  const document = withPivots(withHeadBinding(project()));
  const eye = generateHeadTurn(document, { unit: 10, centers: CENTERS }).cells.find((cell) => cell.x === 1 && cell.y === 0).samples.eyeL;
  assert.equal(eye.scaleX, 1.12);
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
  assert.equal(eye.scaleX, 1.12);
  assert.deepEqual(generateHeadTurn(withPivots(bare), { unit: 10, centers: CENTERS }).cells.find((cell) => cell.x === 1 && cell.y === 0).samples.eyeL, eye,
    'and the same once they are');

  // Unmeasured artwork has no centre to aim at, so no pivot is invented.
  assert.deepEqual(headTurnPivots(bare), {});
});
