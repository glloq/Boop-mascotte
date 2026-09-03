import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAxisValues, createAxis, isAxisValid, locateAxis } from '../keyforms/axis.js';
import { interpolate1D } from '../keyforms/interpolate-1d.js';

test('normalizeAxisValues sorts, dedupes and drops non-finite entries', () => {
  assert.deepEqual(normalizeAxisValues([1, -1, 0, 1, NaN, 'x', 0.5]), [-1, 0, 0.5, 1]);
  assert.deepEqual(normalizeAxisValues(null), []);
});

test('createAxis keeps the parameter name and an axis without values is invalid', () => {
  assert.deepEqual(createAxis('headX', [0, -1, 1]), { parameter: 'headX', values: [-1, 0, 1] });
  assert.equal(isAxisValid(createAxis('headX', [])), false);
  assert.equal(isAxisValid(createAxis('', [0])), false);
});

test('locateAxis returns the surrounding samples and a blend factor', () => {
  assert.deepEqual(locateAxis([-1, 0, 1], -0.5), { lower: 0, upper: 1, t: 0.5 });
  // An exact axis value lands at the start of the next segment with t = 0.
  assert.deepEqual(locateAxis([-1, 0, 1], 0), { lower: 1, upper: 2, t: 0 });
  assert.equal(locateAxis([], 0), null);
  assert.deepEqual(locateAxis([0.25], 9), { lower: 0, upper: 0, t: 0 });
});

test('locateAxis clamps outside the axis and can extrapolate linearly', () => {
  assert.deepEqual(locateAxis([-1, 0, 1], -4), { lower: 0, upper: 0, t: 0 });
  assert.deepEqual(locateAxis([-1, 0, 1], 4), { lower: 2, upper: 2, t: 0 });
  assert.deepEqual(locateAxis([-1, 0, 1], 3, 'linear'), { lower: 1, upper: 2, t: 3 });
  assert.deepEqual(locateAxis([-1, 0, 1], -3, 'linear'), { lower: 0, upper: 1, t: -2 });
});

test('interpolate1D returns exact samples at exact axis values', () => {
  const values = [-1, 0, 1];
  const samples = [-8, 0, 8];
  assert.equal(interpolate1D(values, samples, -1), -8);
  assert.equal(interpolate1D(values, samples, 0), 0);
  assert.equal(interpolate1D(values, samples, 1), 8);
});

test('interpolate1D blends linearly between two samples', () => {
  assert.equal(interpolate1D([-1, 0, 1], [-8, 0, 8], 0.5), 4);
  assert.equal(interpolate1D([-1, 0, 1], [-8, 0, 8], -0.25), -2);
});

test('interpolate1D clamps below the minimum and above the maximum', () => {
  assert.equal(interpolate1D([-1, 0, 1], [-8, 0, 8], -50), -8);
  assert.equal(interpolate1D([-1, 0, 1], [-8, 0, 8], 50), 8);
});

test('interpolate1D handles an irregular axis', () => {
  const values = [-1, -0.4, 0, 0.7, 1];
  const samples = [0, 10, 20, 30, 40];
  assert.ok(Math.abs(interpolate1D(values, samples, -0.7) - 5) < 1e-9);
  assert.ok(Math.abs(interpolate1D(values, samples, 0.35) - 25) < 1e-9);
  assert.equal(interpolate1D(values, samples, 0.7), 30);
});

test('interpolate1D is not restricted to [-1, 0, 1]', () => {
  assert.equal(interpolate1D([0, 10, 100], [0, 1, 2], 55), 1.5);
  assert.equal(interpolate1D([-90, 90], [-1, 1], 0), 0);
});

test('a single keyform holds for the whole axis', () => {
  assert.equal(interpolate1D([-1, 0, 1], [null, 7, null], -1), 7);
  assert.equal(interpolate1D([-1, 0, 1], [null, 7, null], 1), 7);
});

test('missing samples are skipped, not treated as zero', () => {
  assert.equal(interpolate1D([-1, 0, 1], [0, null, 10], 0), 5);
  assert.equal(interpolate1D([-1, 0, 1], [0, undefined, 10], 0.5), 7.5);
});

test('interpolate1D falls back when nothing is captured or input is invalid', () => {
  assert.equal(interpolate1D([-1, 0, 1], [null, null, null], 0, { fallback: -3 }), -3);
  assert.equal(interpolate1D([], [], 0, { fallback: 2 }), 2);
  // A non-finite parameter reads as the neutral 0 rather than throwing.
  assert.equal(interpolate1D([-1, 0, 1], [-8, 0, 8], NaN), 0);
  assert.equal(interpolate1D([-1, 0, 1], [-8, 0, 8], undefined), 0);
});

test('linear extrapolation extends the outermost segment', () => {
  assert.equal(interpolate1D([-1, 0, 1], [-8, 0, 8], 2, { extrapolation: 'linear' }), 16);
  assert.equal(interpolate1D([-1, 0, 1], [-8, 0, 8], 2), 8);
});
