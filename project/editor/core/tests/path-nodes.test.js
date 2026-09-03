import test from 'node:test';
import assert from 'node:assert/strict';
import { movePathNode, pathNodes } from '../path/path-nodes.js';

const at = (d, index) => pathNodes(d).find((node) => node.index === index);

test('a node is an on-curve anchor, wherever the command puts it', () => {
  assert.deepEqual(pathNodes('M 10 10 L 50 10 L 50 50 Z').map((node) => [node.command, node.x, node.y]),
    [['M', 10, 10], ['L', 50, 10], ['L', 50, 50]], 'Z closes the path and is not a node');

  // A curve has one anchor: its endpoint. The control points are not nodes.
  assert.deepEqual(pathNodes('M 0 0 C 10 20 30 20 40 0').map((node) => [node.x, node.y]), [[0, 0], [40, 0]]);
  assert.deepEqual(pathNodes('M 0 0 Q 20 20 40 0').map((node) => [node.x, node.y]), [[0, 0], [40, 0]]);
  // An arc's radii and flags are not points either.
  assert.deepEqual(pathNodes('M 0 0 A 25 25 0 0 1 50 0').map((node) => [node.x, node.y]), [[0, 0], [50, 0]]);
  // H and V carry one number and inherit the other from where the pen is.
  assert.deepEqual(pathNodes('M 5 7 H 40 V 60').map((node) => [node.x, node.y]), [[5, 7], [40, 7], [40, 60]]);
  // Relative commands are resolved to absolute points, which is what a pointer
  // gives and what a handle has to be drawn at.
  assert.deepEqual(pathNodes('m 10 10 l 40 0 l 0 40 z').map((node) => [node.x, node.y]), [[10, 10], [50, 10], [50, 50]]);
  assert.deepEqual(pathNodes('M 0 0 L 10 0 Z L 20 20').map((node) => node.x), [0, 10, 20], 'after Z the pen is back at the start');
});

test('a malformed path has no nodes and cannot be edited into rubbish', () => {
  assert.deepEqual(pathNodes('not a path'), []);
  assert.deepEqual(pathNodes(''), []);
  assert.deepEqual(pathNodes(undefined), []);
  assert.equal(movePathNode('not a path', 0, { x: 1, y: 1 }), 'not a path');
  assert.equal(movePathNode('M 0 0 L 10 0', 9, { x: 1, y: 1 }), 'M 0 0 L 10 0', 'no such node');
  assert.equal(movePathNode('M 0 0 L 10 0', 1, { x: NaN, y: 2 }), 'M 0 0 L 10 0', 'a pointer that reported nothing');
  assert.equal(movePathNode('M 0 0 L 10 0', 1, { x: 10, y: 0 }), 'M 0 0 L 10 0', 'moving a node nowhere writes nothing');
});

test('moving an absolute node moves that node and nothing else', () => {
  const moved = movePathNode('M 10 10 L 50 10 L 50 50 Z', 1, { x: 70, y: 20 });
  assert.deepEqual(pathNodes(moved).map((node) => [node.x, node.y]), [[10, 10], [70, 20], [50, 50]]);
  assert.match(moved, /Z$/, 'the command list is untouched');

  // A curve keeps its control points: only the anchor travels.
  assert.equal(movePathNode('M 0 0 C 10 20 30 20 40 0', 1, { x: 50, y: 5 }), 'M0 0 C10 20 30 20 50 5');
  // An arc keeps its radii and flags.
  assert.equal(movePathNode('M 0 0 A 25 25 0 0 1 50 0', 1, { x: 60, y: 10 }), 'M0 0 A25 25 0 0 1 60 10');
});

test('moving a relative node compensates the next one, so only it moves', () => {
  const moved = movePathNode('m 10 10 l 40 0 l 0 40 z', 1, { x: 70, y: 20 });
  assert.deepEqual(pathNodes(moved).map((node) => [node.x, node.y]), [[10, 10], [70, 20], [50, 50]],
    'the third node is exactly where it was');
  // The first node of a relative path is the whole path's origin: moving it is
  // meant to move everything after it.
  const origin = movePathNode('m 10 10 l 40 0', 0, { x: 30, y: 30 });
  assert.deepEqual(pathNodes(origin).map((node) => [node.x, node.y]), [[30, 30], [50, 10]], 'compensated too');
});

test('a horizontal or vertical line is promoted rather than losing half the drag', () => {
  // H cannot hold a vertical move: 12 would be dropped in silence.
  const promoted = movePathNode('M 0 0 H 40 V 40', 1, { x: 45, y: 12 });
  assert.equal(promoted, 'M0 0 L45 12 V40');
  assert.deepEqual(at(promoted, 1), { index: 1, command: 'L', x: 45, y: 12, relative: false });

  const relative = movePathNode('m 0 0 h 40 v 40', 1, { x: 45, y: 12 });
  assert.equal(relative, 'm0 0 l45 12 v28');
  assert.deepEqual(pathNodes(relative).map((node) => [node.x, node.y]), [[0, 0], [45, 12], [45, 40]],
    'the node after it keeps its own place');

  // A move along the axis still promotes, which keeps one shape for one gesture.
  assert.equal(movePathNode('M 0 0 H 40', 1, { x: 60, y: 0 }), 'M0 0 L60 0');
});

test('every node of a mascot mouth can be dragged, and the result still parses', () => {
  // The mouth of every template: a stroked quadratic curve.
  let d = 'M82 160 Q120 160 158 160';
  for (const node of pathNodes(d)) d = movePathNode(d, node.index, { x: node.x + 5, y: node.y - 3 });
  assert.deepEqual(pathNodes(d).map((node) => [node.x, node.y]), [[87, 157], [163, 157]]);
  assert.equal(pathNodes(d).length, 2);
});
