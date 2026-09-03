import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createHeadPoseAxes, headPoseCells, headPoseKeyformId, isHeadPoseKeyform, headPoseKeyforms,
  headPoseCellSamples, headPoseCellState, headPoseSummary, headPoseElements,
  headPoseSamplesFromTransforms, captureHeadPose, resetHeadPoseCell, resetHeadPose,
  copyHeadPoseCell, pasteHeadPoseCell, mirrorHeadPoseHorizontal, setHeadPoseAxes,
  HEAD_POSE_CHANNELS
} from '../head-pose/head-pose-model.js';
import { padValueFromPoint, padPointFromValue, padKeyboardValue, padCenter } from '../head-pose/head-xy-pad.js';
import { compileRigFrame } from '../../../runtime/runtime.js';

const axes = createHeadPoseAxes();
const CENTER = { i: 1, j: 1 };
const RIGHT = { i: 2, j: 1 };
const LEFT = { i: 0, j: 1 };
const UP = { i: 1, j: 2 };

const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1 });
const elements = () => ({ face: element(), nose: element(), earLeft: element(), earRight: element(), mouth: element() });

/** The cartoon turn from the roadmap: face and nose slide, ears trade presence. */
const rightTurn = () => headPoseSamplesFromTransforms(elements(), {
  face: { x: 4 },
  nose: { x: 7 },
  earLeft: { opacity: 0.25, scaleX: 0.8 },
  earRight: { opacity: 1, scaleX: 1.15 },
  mouth: { x: 3, shapeKeys: { smile: 0.2 } }
});

test('the default grid is 3x3 over headX and headY', () => {
  assert.equal(axes.x.parameter, 'headX');
  assert.equal(axes.y.parameter, 'headY');
  const cells = headPoseCells(axes);
  assert.equal(cells.length, 9);
  assert.equal(cells.filter((cell) => cell.center).length, 1);
});

test('capturing writes one keyform per element and channel', () => {
  const keyforms = captureHeadPose([], { axes, cell: RIGHT, samples: headPoseSamplesFromTransforms(elements(), { face: { x: 6 } }) });
  assert.deepEqual(keyforms.map((item) => item.id).sort(), HEAD_POSE_CHANNELS.map((channel) => headPoseKeyformId('face', channel)).sort());
  assert.ok(keyforms.every(isHeadPoseKeyform));
  assert.equal(headPoseKeyforms(keyforms, axes).length, keyforms.length);
});

test('samples record offsets for additive channels and factors for the rest', () => {
  const samples = headPoseSamplesFromTransforms(
    { face: { baseTransform: { x: 10, y: 5, rotation: 4, scaleX: 2, scaleY: 1 }, baseOpacity: 0.8 } },
    { face: { x: 16, y: 5, rotation: 9, scaleX: 3, opacity: 0.4 } }
  );
  assert.deepEqual(samples.face, { translateX: 6, rotation: 5, scaleX: 1.5, opacity: 0.5 });
});

test('a captured cell reproduces exactly the transform that was posed', () => {
  const posed = { face: { x: 6, rotation: 5, scaleX: 1.2, opacity: 0.5 } };
  const keyforms = captureHeadPose([], { axes, cell: RIGHT, samples: headPoseSamplesFromTransforms(elements(), posed) });
  const frame = compileRigFrame(elements(), { headX: 1, headY: 0 }, {}, {}, { keyforms });
  assert.equal(frame.face.transform.x, 6);
  assert.equal(frame.face.transform.rotation, 5);
  assert.equal(frame.face.transform.scaleX, 1.2);
  assert.equal(frame.face.opacity, 0.5);
});

test('the neutral cell stays neutral when the head is centred', () => {
  const keyforms = captureHeadPose(
    captureHeadPose([], { axes, cell: CENTER, samples: headPoseSamplesFromTransforms(elements(), { face: {} }) }),
    { axes, cell: RIGHT, samples: rightTurn() }
  );
  const frame = compileRigFrame(elements(), { headX: 0, headY: 0 }, {}, {}, { keyforms });
  assert.equal(frame.face.transform.x, 0);
  assert.equal(frame.face.transform.rotation, 0);
  assert.equal(frame.face.opacity, 1);
});

test('headX left and right produce opposite poses', () => {
  let keyforms = captureHeadPose([], { axes, cell: CENTER, samples: headPoseSamplesFromTransforms(elements(), { face: {} }) });
  keyforms = captureHeadPose(keyforms, { axes, cell: RIGHT, samples: rightTurn() });
  keyforms = mirrorHeadPoseHorizontal(keyforms, axes, { earLeft: 'earRight' });
  const right = compileRigFrame(elements(), { headX: 1, headY: 0 }, {}, {}, { keyforms });
  const left = compileRigFrame(elements(), { headX: -1, headY: 0 }, {}, {}, { keyforms });
  assert.equal(right.face.transform.x, -left.face.transform.x);
  assert.equal(right.earLeft.opacity, left.earRight.opacity);
});

test('headY up and down are captured independently of headX', () => {
  let keyforms = captureHeadPose([], { axes, cell: CENTER, samples: headPoseSamplesFromTransforms(elements(), { face: {} }) });
  keyforms = captureHeadPose(keyforms, { axes, cell: UP, samples: headPoseSamplesFromTransforms(elements(), { face: { y: -5 } }) });
  assert.equal(compileRigFrame(elements(), { headX: 0, headY: 1 }, {}, {}, { keyforms }).face.transform.y, -5);
  assert.equal(compileRigFrame(elements(), { headX: 0, headY: 0 }, {}, {}, { keyforms }).face.transform.y, 0);
});

test('a diagonal interpolates between the captured corners', () => {
  let keyforms = captureHeadPose([], { axes, cell: CENTER, samples: headPoseSamplesFromTransforms(elements(), { face: {} }) });
  keyforms = captureHeadPose(keyforms, { axes, cell: RIGHT, samples: headPoseSamplesFromTransforms(elements(), { face: { x: 8 } }) });
  keyforms = captureHeadPose(keyforms, { axes, cell: UP, samples: headPoseSamplesFromTransforms(elements(), { face: { y: -8 } }) });
  const frame = compileRigFrame(elements(), { headX: 0.5, headY: 0.5 }, {}, {}, { keyforms });
  assert.ok(frame.face.transform.x > 0 && frame.face.transform.x < 8);
  assert.ok(frame.face.transform.y < 0 && frame.face.transform.y > -8);
});

test('an exact grid cell resolves to its captured value, between cells it blends', () => {
  let keyforms = captureHeadPose([], { axes, cell: CENTER, samples: headPoseSamplesFromTransforms(elements(), { face: {} }) });
  keyforms = captureHeadPose(keyforms, { axes, cell: RIGHT, samples: headPoseSamplesFromTransforms(elements(), { face: { x: 8 } }) });
  assert.equal(compileRigFrame(elements(), { headX: 1, headY: 0 }, {}, {}, { keyforms }).face.transform.x, 8);
  assert.equal(compileRigFrame(elements(), { headX: 0.5, headY: 0 }, {}, {}, { keyforms }).face.transform.x, 4);
});

test('values outside the grid clamp to the outermost pose', () => {
  let keyforms = captureHeadPose([], { axes, cell: CENTER, samples: headPoseSamplesFromTransforms(elements(), { face: {} }) });
  keyforms = captureHeadPose(keyforms, { axes, cell: RIGHT, samples: headPoseSamplesFromTransforms(elements(), { face: { x: 8 } }) });
  assert.equal(compileRigFrame(elements(), { headX: 12, headY: -12 }, {}, {}, { keyforms }).face.transform.x, 8);
});

test('a cell captures many parts at once', () => {
  const keyforms = captureHeadPose([], { axes, cell: RIGHT, samples: rightTurn() });
  assert.deepEqual(headPoseElements(keyforms, axes), ['earLeft', 'earRight', 'face', 'mouth', 'nose']);
  const samples = headPoseCellSamples(keyforms, axes, RIGHT);
  assert.equal(samples.nose.translateX, 7);
  assert.equal(samples.earLeft.opacity, 0.25);
  assert.equal(samples['mouth']['shape:smile'], 0.2);
});

test('a shape-key capture drives the mouth shape through the pose grid', () => {
  const keyforms = captureHeadPose([], { axes, cell: RIGHT, samples: rightTurn() });
  const shape = keyforms.find((item) => item.channel === 'pathShape');
  assert.equal(shape.shapeKey, 'smile');
  assert.equal(compileRigFrame(elements(), { headX: 1, headY: 0 }, {}, {}, { keyforms }).mouth.shapeWeights.smile, 0.2);
});

test('cell state distinguishes empty, neutral and captured', () => {
  let keyforms = captureHeadPose([], { axes, cell: CENTER, samples: headPoseSamplesFromTransforms(elements(), { face: {} }) });
  keyforms = captureHeadPose(keyforms, { axes, cell: RIGHT, samples: rightTurn() });
  assert.equal(headPoseCellState(keyforms, axes, CENTER), 'neutral');
  assert.equal(headPoseCellState(keyforms, axes, RIGHT), 'captured');
  assert.equal(headPoseCellState(keyforms, axes, LEFT), 'empty');
  const summary = headPoseSummary(keyforms, axes);
  assert.equal(summary.length, 9);
  assert.equal(summary.find((cell) => cell.i === 2 && cell.j === 1).elements, 5);
});

test('capture is transactional: cancelling leaves the previous list untouched', () => {
  const before = captureHeadPose([], { axes, cell: CENTER, samples: headPoseSamplesFromTransforms(elements(), { face: {} }) });
  const snapshot = structuredClone(before);
  const after = captureHeadPose(before, { axes, cell: RIGHT, samples: rightTurn() });
  assert.notEqual(after, before);
  assert.deepEqual(before, snapshot);
  assert.equal(headPoseCellState(before, axes, RIGHT), 'empty');
});

test('reset clears one cell, and removes keyforms that end up empty', () => {
  let keyforms = captureHeadPose([], { axes, cell: RIGHT, samples: rightTurn() });
  keyforms = resetHeadPoseCell(keyforms, axes, RIGHT);
  assert.deepEqual(keyforms, []);
});

test('reset keeps the cells it was not asked to clear', () => {
  let keyforms = captureHeadPose([], { axes, cell: CENTER, samples: headPoseSamplesFromTransforms(elements(), { face: {} }) });
  keyforms = captureHeadPose(keyforms, { axes, cell: RIGHT, samples: headPoseSamplesFromTransforms(elements(), { face: { x: 8 } }) });
  const cleared = resetHeadPoseCell(keyforms, axes, RIGHT);
  assert.equal(headPoseCellState(cleared, axes, RIGHT), 'empty');
  assert.equal(headPoseCellState(cleared, axes, CENTER), 'neutral');
});

test('resetting the whole grid leaves other keyforms alone', () => {
  const other = { id: 'ear-wiggle', target: { kind: 'element', id: 'earLeft' }, channel: 'rotation', axes: [{ parameter: 'earWiggle', values: [-1, 0, 1] }], keyforms: [{ at: [0], value: -5 }] };
  const keyforms = captureHeadPose([other], { axes, cell: RIGHT, samples: rightTurn() });
  assert.deepEqual(resetHeadPose(keyforms, axes), [other]);
});

test('copy and paste move a whole cell, including several elements', () => {
  const keyforms = captureHeadPose([], { axes, cell: RIGHT, samples: rightTurn() });
  const clipboard = copyHeadPoseCell(keyforms, axes, RIGHT);
  assert.equal(Object.keys(clipboard.samples).length, 5);
  const pasted = pasteHeadPoseCell(keyforms, axes, LEFT, clipboard);
  assert.deepEqual(headPoseCellSamples(pasted, axes, LEFT), headPoseCellSamples(keyforms, axes, RIGHT));
  assert.equal(copyHeadPoseCell(keyforms, axes, UP), null);
  assert.equal(pasteHeadPoseCell(keyforms, axes, UP, null), keyforms);
});

test('mirroring swaps columns, flips direction and trades paired elements', () => {
  const keyforms = captureHeadPose([], { axes, cell: RIGHT, samples: rightTurn() });
  const mirrored = mirrorHeadPoseHorizontal(keyforms, axes, { earLeft: 'earRight' });
  const samples = headPoseCellSamples(mirrored, axes, LEFT);
  assert.equal(samples.face.translateX, -4);
  assert.equal(samples.nose.translateX, -7);
  assert.equal(samples.earRight.opacity, 0.25);
  assert.equal(samples.earLeft.opacity, 1);
  // 'onto' keeps the side that was posed and fills in the other one.
  assert.equal(headPoseCellState(mirrored, axes, RIGHT), 'captured');
  assert.equal(headPoseCellSamples(mirrored, axes, RIGHT).face.translateX, 4);
});

test('replace mode flips the whole grid instead of filling in the other side', () => {
  const keyforms = captureHeadPose([], { axes, cell: RIGHT, samples: rightTurn() });
  const flipped = mirrorHeadPoseHorizontal(keyforms, axes, { earLeft: 'earRight' }, { mode: 'replace' });
  assert.equal(headPoseCellState(flipped, axes, RIGHT), 'empty');
  assert.equal(headPoseCellSamples(flipped, axes, LEFT).face.translateX, -4);
});

test('mirroring twice returns the original grid', () => {
  const keyforms = captureHeadPose([], { axes, cell: RIGHT, samples: rightTurn() });
  const twice = mirrorHeadPoseHorizontal(mirrorHeadPoseHorizontal(keyforms, axes, { earLeft: 'earRight' }), axes, { earLeft: 'earRight' });
  assert.deepEqual(headPoseCellSamples(twice, axes, RIGHT), headPoseCellSamples(keyforms, axes, RIGHT));
});

test('retuning the axes keeps the captures that still fit', () => {
  const keyforms = captureHeadPose([], { axes, cell: RIGHT, samples: headPoseSamplesFromTransforms(elements(), { face: { x: 8 } }) });
  const wide = createHeadPoseAxes({ x: { parameter: 'headX', values: [-1, -0.5, 0, 0.5, 1] }, y: { parameter: 'headY', values: [-1, 0, 1] } });
  const retuned = setHeadPoseAxes(keyforms, axes, wide);
  assert.deepEqual(retuned[0].axes[0].values, [-1, -0.5, 0, 0.5, 1]);
  assert.equal(headPoseCellSamples(retuned, wide, RIGHT).face.translateX, 8);
});

/* Head XY pad */

test('the pad maps a pointer position to parameters, with y pointing up', () => {
  const size = { width: 200, height: 200 };
  assert.deepEqual(padValueFromPoint({ x: 100, y: 100, ...size }, axes), { headX: 0, headY: 0 });
  assert.deepEqual(padValueFromPoint({ x: 200, y: 0, ...size }, axes), { headX: 1, headY: 1 });
  assert.deepEqual(padValueFromPoint({ x: 0, y: 200, ...size }, axes), { headX: -1, headY: -1 });
});

test('the pad clamps a pointer dragged outside its box', () => {
  const size = { width: 200, height: 200 };
  assert.deepEqual(padValueFromPoint({ x: -500, y: 900, ...size }, axes), { headX: -1, headY: -1 });
  assert.deepEqual(padValueFromPoint({ x: 900, y: -500, ...size }, axes), { headX: 1, headY: 1 });
});

test('the pad handle position round-trips through the value', () => {
  const size = { width: 200, height: 120 };
  for (const point of [{ x: 0, y: 0 }, { x: 200, y: 120 }, { x: 50, y: 90 }]) {
    const value = padValueFromPoint({ ...point, ...size }, axes);
    const back = padPointFromValue(value, size, axes);
    assert.ok(Math.abs(back.x - point.x) < 1e-9 && Math.abs(back.y - point.y) < 1e-9);
  }
});

test('the keyboard nudges, holds inside the axes and resets to centre', () => {
  const start = { headX: 0, headY: 0 };
  assert.deepEqual(padKeyboardValue(start, 'ArrowRight', { axes }), { headX: 0.1, headY: 0 });
  assert.deepEqual(padKeyboardValue(start, 'ArrowUp', { axes }), { headX: 0, headY: 0.1 });
  assert.deepEqual(padKeyboardValue(start, 'ArrowRight', { axes, coarse: true }), { headX: 0.5, headY: 0 });
  assert.deepEqual(padKeyboardValue({ headX: 1, headY: 1 }, 'ArrowRight', { axes }), { headX: 1, headY: 1 });
  assert.deepEqual(padKeyboardValue({ headX: 0.7, headY: -0.4 }, 'Home', { axes }), { headX: 0, headY: 0 });
  assert.equal(padKeyboardValue(start, 'Tab', { axes }), null);
});

test('the pad centre is the axis position nearest rest', () => {
  assert.deepEqual(padCenter(axes), { headX: 0, headY: 0 });
  const offset = createHeadPoseAxes({ x: { parameter: 'headX', values: [-1, -0.2, 0.6] }, y: { parameter: 'headY', values: [0, 1] } });
  assert.deepEqual(padCenter(offset), { headX: -0.2, headY: 0 });
});
