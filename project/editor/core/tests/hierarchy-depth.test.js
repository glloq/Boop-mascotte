import test from 'node:test';
import assert from 'node:assert/strict';
import { compileRigFrame } from '../../../runtime/runtime.js';
import { normalizeDeformers, compileDeformerMatrices, deformerIssues } from '../../../runtime/deformers.js';
import { transformToMatrix, multiplyMatrix, applyMatrix, matrixToString, isIdentityMatrix, IDENTITY_MATRIX, applyElementTransform } from '../../../runtime/transform-2d.js';
import { normalizeParallax, parallaxOffset, depthBand, depthBands, depthOrder, clampDepth, DEFAULT_PARALLAX } from '../../../runtime/depth.js';
import { normalizeRig } from '../rig/normalize-rig.js';
import { createExportRig } from '../export/export-rig.js';
import { validateProject } from '../validation/validate-project.js';
import { createSampleProject } from '../state/store.js';

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} ${actual} != ${expected}`);
const nearPoint = (actual, expected, message) => { near(actual.x, expected.x, `${message} x`); near(actual.y, expected.y, `${message} y`); };
const transform = (over = {}) => ({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0, ...over });

/* Matrices */

test('a transform and its matrix map every point the same way', () => {
  for (const t of [transform(), transform({ x: 3, y: -4, rotation: 33, scaleX: 1.6, scaleY: 0.7, pivotX: 12, pivotY: -5 })]) {
    for (const point of [{ x: 0, y: 0 }, { x: 20, y: 9 }, { x: -7, y: 14 }]) {
      nearPoint(applyMatrix(transformToMatrix(t), point), applyElementTransform(t, point), 'matrix vs transform');
    }
  }
});

test('multiplying applies the inner transform first', () => {
  const outer = transformToMatrix(transform({ x: 10 }));
  const inner = transformToMatrix(transform({ rotation: 90 }));
  nearPoint(applyMatrix(multiplyMatrix(outer, inner), { x: 1, y: 0 }), { x: 10, y: 1 }, 'rotate then translate');
});

test('matrices serialize and identity is recognised', () => {
  assert.equal(matrixToString([1, 0, 0, 1, 0, 0]), 'matrix(1 0 0 1 0 0)');
  assert.equal(matrixToString([1, -0, 0, 1, 0.1234567, 0]), 'matrix(1 0 0 1 0.123457 0)');
  assert.equal(isIdentityMatrix(IDENTITY_MATRIX), true);
  assert.equal(isIdentityMatrix(transformToMatrix(transform({ x: 1 }))), false);
});

/* Hierarchy */

const hierarchy = () => normalizeDeformers({
  deformers: [
    { id: 'body', y: 10 },
    { id: 'head', parent: 'body', rotation: 90 },
    { id: 'leftHandAnchor', parent: 'body', x: -30 }
  ]
});

test('a child inherits its parent transform, in the right order', () => {
  const matrices = compileDeformerMatrices(hierarchy(), {});
  nearPoint(applyMatrix(matrices.get('body'), { x: 10, y: 0 }), { x: 10, y: 10 }, 'body');
  nearPoint(applyMatrix(matrices.get('head'), { x: 10, y: 0 }), { x: 0, y: 20 }, 'rotate locally, then inherit');
  nearPoint(applyMatrix(matrices.get('leftHandAnchor'), { x: 0, y: 0 }), { x: -30, y: 10 }, 'anchor');
});

test('deformer channels can be driven by bindings', () => {
  const deformers = normalizeDeformers({ deformers: [{ id: 'body', bindings: { translateY: { expression: 'bounce', amplitude: 12 } } }] });
  const evaluate = (binding, values) => Number(values[binding.expression] ?? 0) * Number(binding.amplitude ?? 1);
  const matrices = compileDeformerMatrices(deformers, { bounce: 0.5 }, evaluate);
  nearPoint(applyMatrix(matrices.get('body'), { x: 0, y: 0 }), { x: 0, y: 6 }, 'driven');
});

test('a cycle is reported and never followed', () => {
  const deformers = normalizeDeformers({ deformers: [{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }, { id: 'c', parent: 'ghost' }] });
  const issues = deformerIssues(deformers);
  assert.deepEqual(issues.cycles.sort(), ['a', 'b']);
  assert.deepEqual(issues.missing, ['c']);
  // Resolving still terminates and still produces a matrix for everything.
  const matrices = compileDeformerMatrices(deformers, {});
  assert.equal(matrices.size, 3);
});

test('duplicate deformer ids are dropped rather than shadowing each other', () => {
  const deformers = normalizeDeformers({ deformers: [{ id: 'body', x: 1 }, { id: 'body', x: 99 }, { id: '' }] });
  assert.deepEqual(deformers.map((item) => item.id), ['body']);
  assert.equal(deformers[0].x, 1);
});

test('an element in the hierarchy compiles to one composed matrix', () => {
  const elements = { face: { baseTransform: transform({ x: 5 }), deformer: 'head' }, loose: { baseTransform: transform({ x: 5 }) } };
  const frame = compileRigFrame(elements, {}, {}, {}, { deformers: hierarchy() });
  assert.equal(frame.face.deformer, 'head');
  assert.ok(frame.face.matrix, 'a parented element carries a matrix');
  assert.equal(frame.loose.matrix, undefined, 'a flat element keeps its channels');
  nearPoint(applyMatrix(frame.face.matrix, { x: 0, y: 0 }), { x: 0, y: 15 }, 'local then parent');
});

test('an identity hierarchy leaves the frame exactly as it was', () => {
  const elements = { face: { baseTransform: transform({ x: 5 }), deformer: 'idle' } };
  const deformers = normalizeDeformers({ deformers: [{ id: 'idle' }] });
  assert.deepEqual(compileRigFrame(elements, {}, {}, {}, { deformers }), compileRigFrame(elements, {}, {}, {}));
});

test('the hierarchy survives normalization and export', () => {
  const rig = normalizeRig({ params: {}, states: {}, elements: { face: { baseTransform: {}, deformer: 'head' } }, deformers: [{ id: 'head' }] });
  assert.deepEqual(rig.deformers.map((item) => item.id), ['head']);
  assert.equal(rig.elements.face.deformer, 'head');
  assert.deepEqual(normalizeRig({ params: {}, states: {}, elements: {} }).deformers, []);
  assert.deepEqual(createExportRig({ ...createSampleProject(), deformers: [{ id: 'head' }] }).deformers.map((item) => item.id), ['head']);
});

test('a broken hierarchy is reported to the author, not silently ignored', () => {
  const state = { ...createSampleProject(), svgMarkup: '<svg><g id="face"/></svg>', deformers: [{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }, { id: 'c', parent: 'ghost' }] };
  const issues = validateProject(state).filter((issue) => issue.domain === 'hierarchy');
  assert.ok(issues.some((issue) => /forms a loop/.test(issue.message)));
  assert.ok(issues.some((issue) => /"ghost", which does not exist/.test(issue.message)));
});

/* Depth and parallax */

test('parallax offsets an element by its depth times the head pose', () => {
  const parallax = normalizeParallax({ amount: 10 });
  assert.deepEqual(parallaxOffset(0.5, { headX: 1, headY: 0 }, parallax), { x: 5, y: 0 });
  assert.deepEqual(parallaxOffset(-0.5, { headX: 1, headY: -1 }, parallax), { x: -5, y: 5 });
  assert.deepEqual(parallaxOffset(0.5, { headX: 0, headY: 0 }, parallax), { x: 0, y: 0 });
  assert.deepEqual(parallaxOffset(0.5, { headX: 1 }, normalizeParallax({ amount: 10, enabled: false })), { x: 0, y: 0 });
});

test('a nearer element slides further than a distant one', () => {
  const elements = {
    nose: { baseTransform: transform(), depth: 0.6 },
    face: { baseTransform: transform(), depth: 0 },
    hairBack: { baseTransform: transform(), depth: -0.8 }
  };
  const frame = compileRigFrame(elements, { headX: 1, headY: 0 }, {}, {}, { parallax: { amount: 10 } });
  assert.equal(frame.nose.transform.x, 6);
  assert.equal(frame.face.transform.x, 0);
  assert.equal(frame.hairBack.transform.x, -8);
});

test('depth without a parallax setting changes nothing', () => {
  const elements = { nose: { baseTransform: transform(), depth: 0.6 } };
  assert.equal(compileRigFrame(elements, { headX: 1 }, {}, {}).nose.transform.x, 0);
});

test('depth is reported on the frame and clamped to the usable range', () => {
  const frame = compileRigFrame({ nose: { baseTransform: transform(), depth: 5 } }, {}, {}, {}, { parallax: {} });
  assert.equal(frame.nose.depth, 1);
  assert.equal(clampDepth(-9), -1);
  assert.equal(clampDepth('nope'), 0);
});

test('depth falls into behind, normal and front bands', () => {
  const parallax = normalizeParallax({ bands: [-0.35, 0.35] });
  assert.equal(depthBand(-0.8, parallax), 'behind');
  assert.equal(depthBand(0, parallax), 'normal');
  assert.equal(depthBand(0.8, parallax), 'front');
  assert.deepEqual(depthBands({ hair: 0.8, face: 0, ear: -0.9 }, parallax), { hair: 'front', face: 'normal', ear: 'behind' });
});

test('hysteresis stops a depth on a boundary from flickering between bands', () => {
  const parallax = normalizeParallax({ bands: [-0.35, 0.35], hysteresis: 0.1 });
  // Freshly at the boundary: front.
  assert.equal(depthBand(0.35, parallax), 'front');
  // Already at the front, a small dip below the boundary keeps it there.
  assert.equal(depthBand(0.3, parallax, 'front'), 'front');
  // Past the margin it finally drops back.
  assert.equal(depthBand(0.2, parallax, 'front'), 'normal');
  // The same, symmetrically, at the back.
  assert.equal(depthBand(-0.3, parallax, 'behind'), 'behind');
  assert.equal(depthBand(-0.2, parallax, 'behind'), 'normal');
});

test('draw order sorts back to front and is stable for equal depths', () => {
  assert.deepEqual(depthOrder({ nose: 0.6, face: 0, hairBack: -0.8, ear: 0 }), ['hairBack', 'ear', 'face', 'nose']);
});

test('parallax settings normalize with sensible defaults', () => {
  const parallax = normalizeParallax();
  assert.equal(parallax.amount, DEFAULT_PARALLAX.amount);
  assert.deepEqual(parallax.parameterX, 'headX');
  assert.deepEqual(normalizeParallax({ bands: [0.4, -0.4] }).bands, [-0.4, 0.4], 'bands are ordered');
  assert.deepEqual(normalizeParallax({ bands: [1] }).bands, [...DEFAULT_PARALLAX.bands], 'a malformed pair falls back');
  assert.equal(normalizeParallax({ hysteresis: -3 }).hysteresis, 0);
});
