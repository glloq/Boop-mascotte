import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createKeyform, setKeyformCell, clearKeyformCell, clearKeyformCells, getKeyformCell,
  hasKeyformCell, keyformCellState, keyformCells, keyformSize, copyKeyformCell,
  pasteKeyformCell, mirrorKeyformHorizontal, mirrorAxisIndex, setKeyformAxis
} from '../keyforms/keyform-model.js';
import { evaluateKeyform } from '../keyforms/keyform-evaluator.js';

const grid = () => createKeyform({
  id: 'head-face-x', targetId: 'face', channel: 'translateX',
  axes: [{ parameter: 'headX', values: [-1, 0, 1] }, { parameter: 'headY', values: [-1, 0, 1] }]
});

test('a new pose grid is empty and reports its size', () => {
  const keyform = grid();
  assert.deepEqual(keyformSize(keyform), { width: 3, height: 3 });
  assert.equal(keyform.keyforms.length, 0);
  assert.equal(keyformCells(keyform).length, 9);
  assert.ok(keyformCells(keyform).every((cell) => cell.state === 'empty'));
});

test('capturing a cell does not mutate the previous record', () => {
  const before = grid();
  const after = setKeyformCell(before, 2, 1, 6);
  assert.equal(before.keyforms.length, 0);
  assert.equal(getKeyformCell(after, 2, 1), 6);
  assert.equal(hasKeyformCell(after, 2, 1), true);
  assert.equal(hasKeyformCell(before, 2, 1), false);
});

test('capturing the same cell twice replaces the sample', () => {
  const keyform = setKeyformCell(setKeyformCell(grid(), 1, 1, 3), 1, 1, -3);
  assert.equal(keyform.keyforms.length, 1);
  assert.equal(getKeyformCell(keyform, 1, 1), -3);
});

test('cell state distinguishes empty, neutral and captured', () => {
  let keyform = setKeyformCell(grid(), 1, 1, 0);
  keyform = setKeyformCell(keyform, 2, 1, 6);
  assert.equal(keyformCellState(keyform, 0, 1), 'empty');
  assert.equal(keyformCellState(keyform, 1, 1), 'neutral');
  assert.equal(keyformCellState(keyform, 2, 1), 'captured');
});

test('reset clears one cell or the whole grid', () => {
  let keyform = setKeyformCell(setKeyformCell(grid(), 0, 0, 1), 2, 2, 2);
  keyform = clearKeyformCell(keyform, 0, 0);
  assert.equal(getKeyformCell(keyform, 0, 0), null);
  assert.equal(getKeyformCell(keyform, 2, 2), 2);
  assert.equal(clearKeyformCells(keyform).keyforms.length, 0);
});

test('copy and paste move a captured value to another cell', () => {
  const keyform = setKeyformCell(grid(), 0, 1, -6);
  const clipboard = copyKeyformCell(keyform, 0, 1);
  assert.deepEqual(clipboard, { channel: 'translateX', value: -6 });
  assert.equal(getKeyformCell(pasteKeyformCell(keyform, 2, 1, clipboard), 2, 1), -6);
  assert.equal(copyKeyformCell(keyform, 2, 2), null);
  assert.equal(pasteKeyformCell(keyform, 2, 1, null), keyform);
});

test('horizontal mirror swaps columns and flips direction-dependent channels', () => {
  let keyform = setKeyformCell(grid(), 0, 1, -6);
  keyform = setKeyformCell(keyform, 0, 0, -4);
  const mirrored = mirrorKeyformHorizontal(keyform);
  assert.equal(getKeyformCell(mirrored, 2, 1), 6);
  assert.equal(getKeyformCell(mirrored, 2, 0), 4);
  assert.equal(getKeyformCell(mirrored, 0, 1), null);
});

test('horizontal mirror keeps sign for channels that are not direction-dependent', () => {
  const scale = createKeyform({
    id: 'ear-scale', targetId: 'ear', channel: 'scaleX',
    axes: [{ parameter: 'headX', values: [-1, 0, 1] }]
  });
  const mirrored = mirrorKeyformHorizontal(setKeyformCell(scale, 0, 0, 1.2));
  assert.equal(getKeyformCell(mirrored, 2, 0), 1.2);
});

test('mirroring an asymmetric axis matches the opposite sample when it exists', () => {
  assert.equal(mirrorAxisIndex([-1, -0.4, 0, 0.4, 1], 1), 3);
  assert.equal(mirrorAxisIndex([-1, 0, 1], 1), 1);
  // No opposite sample: fall back to the reversed position.
  assert.equal(mirrorAxisIndex([-1, -0.4, 0, 0.7, 1], 1), 3);
});

test('mirroring twice returns the original grid', () => {
  const keyform = setKeyformCell(setKeyformCell(grid(), 0, 0, -4), 1, 2, 1);
  const twice = mirrorKeyformHorizontal(mirrorKeyformHorizontal(keyform));
  assert.deepEqual(twice.keyforms, keyform.keyforms);
});

test('replacing an axis drops captures outside the new one', () => {
  const keyform = setKeyformCell(setKeyformCell(grid(), 0, 0, 1), 2, 0, 2);
  const narrowed = setKeyformAxis(keyform, 0, { parameter: 'headX', values: [-1, 1] });
  assert.deepEqual(narrowed.axes[0].values, [-1, 1]);
  assert.equal(narrowed.keyforms.length, 1);
  assert.equal(getKeyformCell(narrowed, 0, 0), 1);
});

test('an authored grid evaluates to the captured pose', () => {
  let keyform = setKeyformCell(grid(), 0, 1, -6);
  keyform = setKeyformCell(keyform, 1, 1, 0);
  keyform = setKeyformCell(keyform, 2, 1, 6);
  assert.equal(evaluateKeyform(keyform, { headX: 0, headY: 0 }), 0);
  assert.equal(evaluateKeyform(keyform, { headX: 1, headY: 0 }), 6);
  assert.equal(evaluateKeyform(keyform, { headX: -0.5, headY: 0 }), -3);
});
