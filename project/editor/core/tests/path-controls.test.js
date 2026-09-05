import test from 'node:test';
import assert from 'node:assert/strict';
import { convertNode, movePathControl, pathControls, smoothNode } from '../path/path-controls.js';
import { remapValues } from '../path/path-edit.js';
import { parsePath } from '../../../runtime/path-vector.js';

/** The serializer writes `M0 0 C10 -10`; compare paths on their numbers and letters, not their spacing. */
const norm = (d) => String(d).replace(/([A-Za-z])/g, ' $1 ').replace(/\s+/g, ' ').trim();

const CURVE = 'M 0 0 C 10 -10 20 -10 30 0 C 40 10 50 10 60 0';

test('pathControls finds the handle arriving at and leaving every node', () => {
  const nodes = pathControls(CURVE);
  assert.equal(nodes.length, 3);
  assert.equal(nodes[0].in, null, 'the start has nothing arriving');
  assert.deepEqual(nodes[0].out, { x: 10, y: -10, slots: [2, 3] });
  assert.deepEqual(nodes[1].in, { x: 20, y: -10, slots: [4, 5] });
  assert.deepEqual(nodes[1].out, { x: 40, y: 10, slots: [8, 9] });
  assert.equal(nodes[1].smooth, true, 'opposite handles make a smooth node');
  assert.equal(nodes[2].out, null, 'the end has nothing leaving');
  const corner = pathControls('M 0 0 C 10 -10 20 -10 30 0 C 20 10 50 10 60 0')[1];
  assert.equal(corner.smooth, false, 'handles on the same side make a corner');
  const line = pathControls('M 0 0 L 10 0 L 20 5')[1];
  assert.equal(line.in, null); assert.equal(line.out, null);
  const quad = pathControls('M 0 0 Q 5 5 10 0 Q 15 -5 20 0');
  assert.deepEqual(quad[1].in, { x: 5, y: 5, slots: [2, 3] });
  assert.deepEqual(quad[1].out, { x: 15, y: -5, slots: [6, 7] });
  assert.equal(pathControls('m 0 0 c 1 1 2 2 3 3')[1].in, null, 'relative handles are not offered');
});

test('moving a handle moves only it, or mirrors the other one as asked', () => {
  const moved = movePathControl(CURVE, 1, 'in', { x: 25, y: -20 });
  assert.equal(norm(moved), norm('M 0 0 C 10 -10 25 -20 30 0 C 40 10 50 10 60 0'));
  const symmetric = movePathControl(CURVE, 1, 'in', { x: 20, y: -20 }, { mirror: 'symmetric' });
  assert.equal(norm(symmetric), norm('M 0 0 C 10 -10 20 -20 30 0 C 40 20 50 10 60 0'), 'the out-handle is exactly opposite');
  const angled = movePathControl(CURVE, 1, 'in', { x: 30, y: -20 }, { mirror: 'angle' });
  const out = pathControls(angled)[1].out;
  assert.ok(Math.abs(out.x - 30) < 1e-3 && Math.abs(out.y - Math.hypot(10, 10)) < 1e-3, 'the out-handle keeps its own length (√200) on the opposite line');
  assert.equal(movePathControl(CURVE, 0, 'in', { x: 1, y: 1 }), CURVE, 'a handle that is not there does not move');
  assert.equal(norm(smoothNode('M 0 0 C 10 -10 20 -10 30 0 C 20 10 50 10 60 0', 1)), norm('M 0 0 C 10 -10 20 -10 30 0 C 40 10 50 10 60 0'), 'smoothing puts the out-handle on the in-handle\'s line at its own length');
});

test('a straight node becomes a curve that draws the same line, and back, with a map every delta follows', () => {
  const line = 'M 0 0 L 30 0 L 60 30';
  const curved = convertNode(line, 1, 'curve');
  assert.equal(curved.ok, undefined);
  assert.equal(norm(curved.d), norm('M 0 0 C 10 0 20 0 30 0 C 40 10 50 20 60 30'), 'controls a third of the way along keep the line');
  assert.equal(curved.from, 6); assert.equal(curved.to, 14);
  // The map carries a delta vector laid out like the old path.
  const delta = remapValues(curved, [0, 0, 5, 0, 0, 10]);
  const r3 = (list) => list.map((v) => Math.round(v * 1000) / 1000);
  assert.deepEqual(r3(delta), r3([0, 0, 5 / 3, 0, 10 / 3, 0, 5, 0, 10 / 3, 10 / 3, 5 / 3, 20 / 3, 0, 10]), 'a delta on an anchor reaches the new controls a third and two thirds of the way');
  const straight = convertNode(curved.d, 1, 'straight');
  assert.equal(norm(straight.d), norm('M 0 0 L 30 0 L 60 30'));
  assert.equal(straight.to, 6);
  assert.equal(convertNode(line, 1, 'straight').ok, false, 'already straight is refused with a reason');
  assert.equal(convertNode('m 0 0 l 1 1 l 2 2', 1, 'curve').ok, false, 'relative commands are refused');
  const start = convertNode('M 0 0 L 30 0', 0, 'curve');
  assert.equal(norm(start.d), norm('M 0 0 C 10 0 20 0 30 0'), 'converting the first node curves the segment after it');
  assert.equal(parsePath(start.d).commands.join(' '), 'M C');
});
