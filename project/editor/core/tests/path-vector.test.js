import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePath, canParsePath, pathSignature, pathsCompatible, serializePath, mapPathValues, formatNumber, PathParseError } from '../../../runtime/path-vector.js';

test('a path parses into a command list and a numeric vector', () => {
  const parsed = parsePath('M0 0 L10 0 C1 2 3 4 5 6 Z');
  assert.deepEqual(parsed.commands, ['M', 'L', 'C', 'Z']);
  assert.deepEqual(Array.from(parsed.values), [0, 0, 10, 0, 1, 2, 3, 4, 5, 6]);
  assert.equal(parsed.signature, 'M L C Z');
});

test('parsing is cached, so the same string is never scanned twice', () => {
  assert.equal(parsePath('M0 0L1 1'), parsePath('M0 0L1 1'));
});

test('separators, signs and exponents are all accepted', () => {
  assert.deepEqual(Array.from(parsePath('M0,0L-1-2').values), [0, 0, -1, -2]);
  assert.deepEqual(Array.from(parsePath('M.5.5L1.5.5').values), [0.5, 0.5, 1.5, 0.5]);
  assert.deepEqual(Array.from(parsePath('M1e2 1E-2').values), [100, 0.01]);
  assert.deepEqual(Array.from(parsePath('M 0\n0\tL\t1 , 1').values), [0, 0, 1, 1]);
});

test('an implicit repeat after moveto continues as lineto, per the SVG spec', () => {
  const parsed = parsePath('M0 0 10 10 20 20');
  assert.deepEqual(parsed.commands, ['M', 'L', 'L']);
  assert.deepEqual(Array.from(parsed.values), [0, 0, 10, 10, 20, 20]);
  assert.deepEqual(parsePath('m0 0 1 1').commands, ['m', 'l']);
});

test('arc flags are read as flags even without separators', () => {
  const parsed = parsePath('M0 0 a5 5 0 011 1 z');
  assert.deepEqual(parsed.commands, ['M', 'a', 'z']);
  assert.deepEqual(Array.from(parsed.values), [0, 0, 5, 5, 0, 0, 1, 1, 1]);
});

test('serializePath rebuilds an equivalent path', () => {
  for (const d of ['M0 0 L10 0 Z', 'M0 0C1 2 3 4 5 6', 'M0 0 a5 5 0 1 0 1 1 z', 'M0 0 H5 V6 z']) {
    const parsed = parsePath(d);
    const round = parsePath(serializePath(parsed.commands, parsed.values));
    assert.deepEqual(round.commands, parsed.commands, d);
    assert.deepEqual(Array.from(round.values), Array.from(parsed.values), d);
  }
});

test('serialized arc flags stay 0 or 1', () => {
  const parsed = parsePath('M0 0 a5 5 0 1 0 1 1');
  assert.match(serializePath(parsed.commands, parsed.values), /a5 5 0 1 0 1 1/);
});

test('signatures compare command layout, not coordinates', () => {
  assert.equal(pathSignature('M0 0L1 1'), pathSignature('M9 9L4 4'));
  assert.equal(pathsCompatible('M0 0L1 1', 'M2 2L3 3'), true);
  assert.equal(pathsCompatible('M0 0L1 1', 'M0 0C1 1 2 2 3 3'), false);
  assert.equal(pathsCompatible('M0 0L1 1', 'nonsense'), false);
});

test('mapPathValues transforms coordinates and rebuilds the string', () => {
  assert.equal(mapPathValues('M0 0 L10 5', (value) => value * 2), 'M0 0 L20 10');
});

test('a malformed path reports a clear error instead of producing rubbish', () => {
  assert.throws(() => parsePath('X1 2'), PathParseError);
  assert.throws(() => parsePath('1 2 3'), PathParseError);
  assert.throws(() => parsePath(''), PathParseError);
  assert.throws(() => parsePath('M0 0 L'), PathParseError);
  assert.equal(canParsePath('M0 0L1 1'), true);
  assert.equal(canParsePath('M0 0 !'), false);
});

test('numbers are formatted compactly and never as negative zero', () => {
  assert.equal(formatNumber(1.000000001), '1');
  assert.equal(formatNumber(-0), '0');
  assert.equal(formatNumber(0.12345678), '0.1235');
  assert.equal(formatNumber(Number.NaN), '0');
});
