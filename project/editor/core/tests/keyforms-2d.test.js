import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolate2D, keyformWeights, buildKeyformLayout, resolveKeyformWeights } from '../keyforms/interpolate-2d.js';
import { evaluateKeyform, compileKeyform, normalizeKeyform } from '../keyforms/keyform-evaluator.js';

const X = [-1, 0, 1];
const Y = [-1, 0, 1];
// grid[j][i] — j indexes headY, i indexes headX.
const GRID = [[0, 1, 2], [3, 4, 5], [6, 7, 8]];

const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} ${actual} != ${expected}`);

test('interpolate2D returns exact grid cells', () => {
  assert.equal(interpolate2D(X, Y, GRID, -1, -1), 0);
  assert.equal(interpolate2D(X, Y, GRID, 1, 1), 8);
  assert.equal(interpolate2D(X, Y, GRID, 0, 0), 4);
});

test('interpolate2D blends bilinearly between four cells', () => {
  near(interpolate2D(X, Y, GRID, 0.5, 0.5), 6);
  near(interpolate2D(X, Y, GRID, -0.5, 0), 3.5);
  near(interpolate2D(X, Y, GRID, 0, -0.5), 2.5);
});

test('interpolate2D handles X and Y independently', () => {
  near(interpolate2D(X, Y, GRID, 0.25, -0.75), 2);
  near(interpolate2D(X, Y, GRID, -0.75, 0.25), 4);
});

test('interpolate2D supports irregular axes on both sides', () => {
  const x = [-1, -0.5, 0, 0.8, 1];
  const y = [-1, 0, 0.6, 1];
  const grid = [
    [0, 1, 2, 3, 4],
    [10, 11, 12, 13, 14],
    [20, 21, 22, 23, 24],
    [30, 31, 32, 33, 34]
  ];
  assert.equal(interpolate2D(x, y, grid, 0.8, 0.6), 23);
  near(interpolate2D(x, y, grid, -0.75, 0.3), 15.5);
  near(interpolate2D(x, y, grid, 0.4, -1), 2.5);
});

test('interpolate2D clamps outside the grid on both axes', () => {
  assert.equal(interpolate2D(X, Y, GRID, -9, -9), 0);
  assert.equal(interpolate2D(X, Y, GRID, 9, 9), 8);
  assert.equal(interpolate2D(X, Y, GRID, 9, -9), 2);
  assert.equal(interpolate2D(X, Y, GRID, 0, 9), 7);
});

test('a sparse grid interpolates across missing cells and rows', () => {
  const sparse = [[0, null, 2], [null, null, null], [6, 7, 8]];
  assert.equal(interpolate2D(X, Y, sparse, 0, -1), 1);
  assert.equal(interpolate2D(X, Y, sparse, 0, 0), 4);
  assert.equal(interpolate2D(X, Y, sparse, 0, 1), 7);
});

test('an entirely empty grid falls back', () => {
  assert.equal(interpolate2D(X, Y, [[null]], 0, 0, { fallback: 42 }), 42);
  assert.equal(interpolate2D(X, Y, [], 0, 0, { fallback: 42 }), 42);
});

test('keyform weights always sum to one when anything is captured', () => {
  const axes = [{ parameter: 'headX', values: X }, { parameter: 'headY', values: Y }];
  for (const [x, y] of [[0, 0], [0.3, -0.7], [-1, 1], [5, -5], [0.5, 0.5]]) {
    const weights = keyformWeights(axes, { headX: x, headY: y });
    near(weights.reduce((sum, cell) => sum + cell.weight, 0), 1, `weights at ${x},${y}`);
  }
});

test('a prebuilt layout resolves identically to the direct call', () => {
  const axes = [{ parameter: 'headX', values: X }, { parameter: 'headY', values: Y }];
  const has = (i, j) => !(i === 1 && j === 1);
  const layout = buildKeyformLayout(axes, has);
  const values = { headX: 0.2, headY: -0.4 };
  assert.deepEqual(resolveKeyformWeights(layout, values), keyformWeights(axes, values, has));
});

test('a 2D record evaluates through the shared compiler', () => {
  const record = {
    id: 'head-face-x',
    target: { kind: 'element', id: 'face' },
    channel: 'translateX',
    axes: [{ parameter: 'headX', values: X }, { parameter: 'headY', values: Y }],
    keyforms: [{ at: [0, 1], value: -6 }, { at: [1, 1], value: 0 }, { at: [2, 1], value: 6 }]
  };
  assert.equal(evaluateKeyform(record, { headX: -1, headY: 0 }), -6);
  assert.equal(evaluateKeyform(record, { headX: 0.5, headY: 0 }), 3);
  assert.equal(evaluateKeyform(record, { headX: 5, headY: 5 }), 6);
});

test('an uncaptured record resolves to the channel neutral', () => {
  const base = { id: 'k', target: { kind: 'element', id: 'face' }, axes: [{ parameter: 'headX', values: X }], keyforms: [] };
  assert.equal(evaluateKeyform({ ...base, channel: 'translateX' }, { headX: 0 }), 0);
  assert.equal(evaluateKeyform({ ...base, channel: 'scaleX' }, { headX: 0 }), 1);
  assert.equal(evaluateKeyform({ ...base, channel: 'opacity' }, { headX: 0 }), 1);
});

test('normalizeKeyform drops out-of-range and non-numeric cells', () => {
  const record = normalizeKeyform({
    id: 'k', target: { kind: 'element', id: 'face' }, channel: 'rotation',
    axes: [{ parameter: 'headX', values: [-1, 0, 1] }],
    keyforms: [
      { at: [0], value: 5 }, { at: [7], value: 1 }, { at: [-1], value: 1 },
      { at: [1], value: 'nope' }, { at: [1.5], value: 1 }, { at: [2], value: 3 }
    ]
  });
  assert.deepEqual(record.keyforms, [{ at: [0], value: 5 }, { at: [2], value: 3 }]);
});

test('compileKeyform precomputes a dense buffer and a layout', () => {
  const compiled = compileKeyform({
    id: 'k', target: { kind: 'element', id: 'face' }, channel: 'translateY',
    axes: [{ parameter: 'headX', values: X }, { parameter: 'headY', values: Y }],
    keyforms: [{ at: [1, 0], value: -4 }, { at: [1, 2], value: 4 }]
  });
  assert.equal(compiled.width, 3);
  assert.equal(compiled.height, 3);
  assert.equal(compiled.samples.length, 9);
  assert.deepEqual(compiled.parameters, ['headX', 'headY']);
  assert.deepEqual(compiled.layout.rowIndices, [0, 2]);
  assert.equal(compiled.neutral, 0);
});
