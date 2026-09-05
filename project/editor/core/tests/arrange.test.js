import test from 'node:test';
import assert from 'node:assert/strict';
import { alignBoxes, boxFromCorners, containsBox, distributeBoxes, marqueeSelection, unionBox, vectorInSpace } from '../artwork/arrange.js';
import { invertMatrix } from '../artwork/viewport.js';

const box = (id, x, y, width, height) => ({ id, x, y, width, height });
const a = box('a', 0, 0, 10, 10), b = box('b', 30, 5, 20, 30), c = box('c', 100, 50, 10, 10);

test('the union is the box around all of them', () => {
  assert.deepEqual(unionBox([a, b, c]), { x: 0, y: 0, width: 110, height: 60 });
  assert.equal(unionBox([]), null);
  assert.deepEqual(unionBox([a, { id: 'nan', x: NaN }]), { x: 0, y: 0, width: 10, height: 10 }, 'an unmeasurable box is left out');
});

test('align moves every box onto the selection\'s edge or centre line, and only the ones that move', () => {
  assert.deepEqual(alignBoxes([a, b, c], 'left'), [{ id: 'b', dx: -30, dy: 0 }, { id: 'c', dx: -100, dy: 0 }]);
  assert.deepEqual(alignBoxes([a, b, c], 'right'), [{ id: 'a', dx: 100, dy: 0 }, { id: 'b', dx: 60, dy: 0 }]);
  assert.deepEqual(alignBoxes([a, b, c], 'center'), [{ id: 'a', dx: 50, dy: 0 }, { id: 'b', dx: 15, dy: 0 }, { id: 'c', dx: -50, dy: 0 }]);
  assert.deepEqual(alignBoxes([a, b, c], 'top'), [{ id: 'b', dx: 0, dy: -5 }, { id: 'c', dx: 0, dy: -50 }]);
  assert.deepEqual(alignBoxes([a, b, c], 'middle'), [{ id: 'a', dx: 0, dy: 25 }, { id: 'b', dx: 0, dy: 10 }, { id: 'c', dx: 0, dy: -25 }]);
  assert.deepEqual(alignBoxes([a, b, c], 'bottom'), [{ id: 'a', dx: 0, dy: 50 }, { id: 'b', dx: 0, dy: 25 }]);
  assert.deepEqual(alignBoxes([a], 'left'), [], 'one box has nothing to line up with');
  assert.deepEqual(alignBoxes([a, b], 'sideways'), []);
});

test('align onto a given frame works for one box: centring a piece on the working area', () => {
  const artboard = { x: 0, y: 0, width: 240, height: 240 };
  assert.deepEqual(alignBoxes([a], 'center', { target: artboard }), [{ id: 'a', dx: 115, dy: 0 }]);
  assert.deepEqual(alignBoxes([a], 'middle', { target: artboard }), [{ id: 'a', dx: 0, dy: 115 }]);
  assert.deepEqual(alignBoxes([box('x', 115, 0, 10, 10)], 'center', { target: artboard }), [], 'already there');
});

test('distribute keeps the first and last where they are and spaces the rest evenly', () => {
  // Gaps: a ends at 10, c starts at 100; b (20 wide) sits so both gaps are 35.
  assert.deepEqual(distributeBoxes([a, b, c], 'horizontal'), [{ id: 'b', dx: 15, dy: 0 }]);
  const moves = distributeBoxes([a, box('b', 5, 20, 10, 10), box('c', 0, 50, 10, 10)], 'vertical');
  assert.deepEqual(moves, [{ id: 'b', dx: 0, dy: 5 }], 'a ends at 10, c starts at 50: b goes to 25');
  assert.deepEqual(distributeBoxes([a, b], 'horizontal'), [], 'two boxes have no middle to spread');
  assert.deepEqual(distributeBoxes([b, a, c], 'horizontal'), distributeBoxes([a, b, c], 'horizontal'), 'the order given does not matter');
});

test('a marquee picks the highest pieces wholly inside it, and looks into the ones it crosses', () => {
  const tree = [{ id: 'face', children: [
    { id: 'eyeL', children: [{ id: 'pupilL', children: [] }] },
    { id: 'eyeR', children: [] },
    { id: 'mouth', children: [] },
    { id: 'hidden', visible: false, children: [] }
  ] }];
  const boxes = { face: box('face', 0, 0, 100, 100), eyeL: box('eyeL', 10, 10, 20, 20), pupilL: box('pupilL', 15, 15, 5, 5), eyeR: box('eyeR', 60, 10, 20, 20), mouth: box('mouth', 30, 70, 40, 10), hidden: box('hidden', 12, 12, 2, 2) };
  const boxOf = (item) => boxes[item.id] || null;
  const skip = (item) => item.visible === false;
  assert.deepEqual(marqueeSelection(tree, { x: 5, y: 5, width: 80, height: 30 }, boxOf, skip), ['eyeL', 'eyeR'], 'the eyes, not the face, and not the hidden piece');
  assert.deepEqual(marqueeSelection(tree, { x: -1, y: -1, width: 102, height: 102 }, boxOf, skip), ['face'], 'the whole face is taken whole');
  assert.deepEqual(marqueeSelection(tree, { x: 14, y: 14, width: 8, height: 8 }, boxOf, skip), ['pupilL']);
  assert.deepEqual(marqueeSelection(tree, { x: 90, y: 90, width: 5, height: 5 }, boxOf, skip), []);
});

test('boxes from corners and containment', () => {
  assert.deepEqual(boxFromCorners({ x: 10, y: 20 }, { x: 4, y: 2 }), { x: 4, y: 2, width: 6, height: 18 });
  assert.equal(containsBox({ x: 0, y: 0, width: 10, height: 10 }, box('i', 2, 2, 5, 5)), true);
  assert.equal(containsBox({ x: 0, y: 0, width: 10, height: 10 }, box('o', 8, 2, 5, 5)), false);
});

test('a screen vector becomes a move inside a scaled or rotated group', () => {
  const doubled = invertMatrix({ a: 2, b: 0, c: 0, d: 2, e: 100, f: 50 });
  assert.deepEqual(vectorInSpace(doubled, { x: 10, y: -4 }), { x: 5, y: -2 }, 'twice as big on screen means half the move inside');
  const quarter = invertMatrix({ a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 });
  const v = vectorInSpace(quarter, { x: 10, y: 0 });
  assert.ok(Math.abs(v.x) < 1e-9 && Math.abs(v.y + 10) < 1e-9, 'a 90° group turns a screen move sideways');
  assert.deepEqual(vectorInSpace(null, { x: 3, y: 4 }), { x: 3, y: 4 });
});
