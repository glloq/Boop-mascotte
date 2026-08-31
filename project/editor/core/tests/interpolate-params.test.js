import test from 'node:test';
import assert from 'node:assert/strict';
import { interpolateParams } from '../preview-runtime/interpolate-params.js';

test('interpolateParams blends linearly by default', () => {
  const next = interpolateParams({ headX: -1 }, { headX: 1 }, 0.25);
  assert.equal(next.headX, -0.5);
});

test('interpolateParams applies easeInOut and merges keys', () => {
  const next = interpolateParams({ headX: 0, eyeOpen: 0 }, { headX: 1, mouthOpen: 1 }, 0.5, 'easeInOut');
  assert.equal(next.headX, 0.5);
  assert.equal(next.eyeOpen, 0);
  assert.equal(next.mouthOpen, 0.5);
});
