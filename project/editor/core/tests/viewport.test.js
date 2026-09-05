import test from 'node:test';
import assert from 'node:assert/strict';
import { applyMatrix, invertMatrix, multiplyMatrix, parseViewBox, resolveLength, viewBoxTransform } from '../artwork/viewport.js';

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} vs ${expected}`);

test('a nested svg with only a viewBox is scaled to fit its parent and centred (xMidYMid meet)', () => {
  // The measured case: a 240 x 240 viewBox in an 830 x 795 canvas.
  const m = viewBoxTransform({ viewBox: '0 0 240 240' }, { width: 830, height: 795 });
  close(m.a, 795 / 240, 'uniform scale is the smaller ratio');
  close(m.d, 795 / 240, 'and applies to both axes');
  close(m.e, (830 - 240 * (795 / 240)) / 2, 'centred horizontally');
  close(m.f, 0, 'flush vertically');
  const corner = applyMatrix(m, { x: 240, y: 240 });
  close(corner.x, 830 - m.e, 'the far corner mirrors the near one');
  close(corner.y, 795, 'and reaches the bottom');
});

test('viewBox origin, width/height attributes, percentages and alignments are honoured', () => {
  const offset = viewBoxTransform({ viewBox: '10 20 100 50', width: '200', height: '100' }, { width: 900, height: 900 });
  close(offset.a, 2, 'explicit width drives the scale');
  close(offset.e, -20, 'viewBox x is subtracted after scaling');
  close(offset.f, -40, 'and y');
  const percent = viewBoxTransform({ viewBox: '0 0 100 100', width: '50%' }, { width: 400, height: 400 });
  close(percent.a, 2, 'a percentage is of the parent viewport');
  const min = viewBoxTransform({ viewBox: '0 0 100 50', preserveAspectRatio: 'xMinYMin meet' }, { width: 400, height: 400 });
  close(min.e, 0, 'xMin puts it at the left'); close(min.f, 0, 'yMin at the top'); close(min.a, 4, 'meet keeps the whole box');
  const max = viewBoxTransform({ viewBox: '0 0 100 50', preserveAspectRatio: 'xMaxYMax meet' }, { width: 400, height: 400 });
  close(max.f, 400 - 50 * 4, 'yMax puts it at the bottom');
  const slice = viewBoxTransform({ viewBox: '0 0 100 50', preserveAspectRatio: 'xMidYMid slice' }, { width: 400, height: 400 });
  close(slice.a, 8, 'slice fills the viewport with the larger ratio');
  const none = viewBoxTransform({ viewBox: '0 0 100 50', preserveAspectRatio: 'none' }, { width: 400, height: 400 });
  close(none.a, 4, 'none stretches x'); close(none.d, 8, 'and y independently');
  const plain = viewBoxTransform({ x: '5', y: '7' }, { width: 400, height: 400 });
  assert.deepEqual(plain, { a: 1, b: 0, c: 0, d: 1, e: 5, f: 7 }, 'no viewBox is no scaling');
});

test('matrices compose, invert and round-trip a point', () => {
  const zoom = { a: 0.842, b: 0, c: 0, d: 0.842, e: 65.5, f: 95.1 };
  const box = viewBoxTransform({ viewBox: '0 0 240 240' }, { width: 830, height: 795 });
  const total = multiplyMatrix(zoom, box);
  close(total.a, 0.842 * (795 / 240), 'scales multiply');
  const inverse = invertMatrix(total);
  const there = applyMatrix(total, { x: 120, y: 60 });
  const back = applyMatrix(inverse, there);
  close(back.x, 120, 'x round-trips'); close(back.y, 60, 'y round-trips');
  assert.equal(invertMatrix({ a: 0, b: 0, c: 0, d: 0, e: 1, f: 1 }), null, 'a singular matrix has no inverse');
});

test('parseViewBox and resolveLength refuse what they cannot read', () => {
  assert.equal(parseViewBox('0 0 0 10'), null);
  assert.equal(parseViewBox('nope'), null);
  assert.deepEqual(parseViewBox('1,2,3,4'), { x: 1, y: 2, width: 3, height: 4 });
  assert.equal(resolveLength(undefined, 300), 300);
  assert.equal(resolveLength('25%', 200), 50);
  assert.equal(resolveLength('12px', 200), 12);
});
