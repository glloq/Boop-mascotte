import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROL_GAP, CONTROL_SPOTS, controlSpot, fitCells, packControls, pushClear, shareCells } from '../puppet/control-packing.js';

/**
 * How several controls share a space without meeting (V3-14).
 *
 * The rule the rest of the rig is held to is here, on its own, in numbers: a
 * control that clashes with nothing stays exactly where it asked to be, one
 * that clashes is moved until it does not, and a control whose position is the
 * value it reports is never moved at all. A control is a **box** — which is
 * both what a reader means by one being on top of another, and what the
 * browser reports for every shape a control can take.
 */
const at = (id, x, y, side = 26, rest = {}) => ({ id, x, y, width: side, height: side, ...rest });
const overlapping = (placed, side = 26) => {
  const clashes = [];
  for (const [index, one] of placed.entries()) {
    for (const other of placed.slice(index + 1)) {
      const across = ((one.width ?? side) + (other.width ?? side)) / 2 + CONTROL_GAP;
      const down = ((one.height ?? side) + (other.height ?? side)) / 2 + CONTROL_GAP;
      if (Math.abs(one.x - other.x) + 1e-6 < across && Math.abs(one.y - other.y) + 1e-6 < down) clashes.push(`${one.id} over ${other.id}`);
    }
  }
  return clashes;
};

test('a control nobody is sitting on stays where it asked to be', () => {
  const wanted = [at('a', 0, 0), at('b', 60, 0), at('c', 0, 60)];
  const placed = packControls(wanted);
  assert.deepEqual(placed.map((item) => [item.x, item.y, item.moved]), [[0, 0, false], [60, 0, false], [0, 60, false]]);
  // And the answer comes back in the order it was asked for, whatever order
  // the placing happened in: a caller pairs it up with its own list.
  assert.deepEqual(placed.map((item) => item.id), ['a', 'b', 'c']);
});

test('controls piled on one point are spread until none of them touch', () => {
  // Eight controls on the same spot is not a contrivance: the tongue's four
  // controls and the mouth's five all sit inside a mouth fourteen units tall.
  const piled = Array.from({ length: 8 }, (_, index) => at(`c${index}`, 40, 40));
  assert.ok(overlapping(piled).length > 0, 'unpacked, every one of them covers every other');
  const placed = packControls(piled).map((item, index) => ({ ...item, width: piled[index].width, height: piled[index].height }));
  assert.deepEqual(overlapping(placed), []);
  // The first one asked for is the one that keeps the spot, so a rig's most
  // important control is the one that does not move.
  assert.deepEqual([placed[0].x, placed[0].y, placed[0].moved], [40, 40, false]);
  // Nobody is flung across the canvas to make room: eight controls need two
  // rings at most, and a ring is a little over one control wide.
  for (const item of placed) assert.ok(Math.hypot(item.x - 40, item.y - 40) <= 3 * (26 + CONTROL_GAP), `${item.id} went too far`);
});

test('a control whose position is the value it reports is never moved off it', () => {
  // A knob on a hand's console sits where the movement is set to and a control
  // on a named point sits on the fingertip it names: moving either of those to
  // make room would be a control lying about what it says.
  const placed = packControls([at('face', 10, 10), at('knob', 12, 10, 26, { fixed: true })]);
  assert.deepEqual([placed[1].x, placed[1].y, placed[1].moved], [12, 10, false], 'the fixed one holds its ground');
  assert.equal(placed[0].moved, true, 'and the one that may move is the one that does');
  assert.deepEqual(overlapping(placed), []);
});

test('a control sits on a spot of its artwork, plus whatever the author nudged it by', () => {
  const rect = { x: 100, y: 200, width: 60, height: 40 };
  assert.deepEqual(controlSpot(rect, 'centre'), { x: 130, y: 220 });
  assert.deepEqual(controlSpot(rect, 'bottom'), { x: 130, y: 236.8 });
  assert.deepEqual(controlSpot(rect, 'nowhere'), { x: 130, y: 220 }, 'a spot nobody has is the middle');
  // `offset` has been on the record, normalized and merged since handles became
  // records, and until now nothing read it (V3-14).
  assert.deepEqual(controlSpot(rect, 'centre', { x: 12, y: -5 }), { x: 142, y: 215 });
  assert.deepEqual(controlSpot(null, 'centre'), { x: 0, y: 0 }, 'and artwork nobody could measure places nothing');
  assert.deepEqual(Object.keys(CONTROL_SPOTS), ['centre', 'top', 'bottom', 'left', 'right', 'bottomLeft']);
});

test('a handle that says how far something reaches is pushed out, never sideways', () => {
  // The square that sets how far a pin holds *is* the distance it reports, so
  // it may only be kept far enough out to be grabbed: a pin with a reach of
  // three units drew both of its squares inside its own dot.
  const pin = { x: 50, y: 50 };
  assert.deepEqual(pushClear(pin, { x: 53, y: 50 }, 19), { x: 69, y: 50 }, 'out along its own axis');
  assert.deepEqual(pushClear(pin, { x: 50, y: 54 }, 19), { x: 50, y: 69 });
  assert.deepEqual(pushClear(pin, { x: 90, y: 50 }, 19), { x: 90, y: 50 }, 'one already clear is left alone');
  assert.deepEqual(pushClear(pin, pin, 19), { x: 50, y: 50 }, 'and one with no direction at all is not invented one');
});

test('a run shared between controls, and cells as big as they will fit', () => {
  // The ring of a hand's console and the row under it: equal cells, each
  // shrunk by a share of its own so that two never meet.
  const ring = shareCells(360, 4, { gap: 0.3 });
  assert.deepEqual([ring.cell, ring.size, ring.pad], [90, 63, 13.5]);
  assert.deepEqual(shareCells(360, 0, {}), { cell: 0, size: 0, pad: 0 }, 'nothing to share is not a division by zero');

  // The column of drawings beside the face: fewer pictures means bigger ones,
  // more of them means smaller ones rather than a column off the canvas.
  assert.deepEqual(fitCells(100, 1, { biggest: 30, gap: 0.16 }), { size: 30, step: 34.8 });
  assert.ok(fitCells(100, 8, { biggest: 30, gap: 0.16 }).size < fitCells(100, 4, { biggest: 30, gap: 0.16 }).size);
  assert.deepEqual(fitCells(100, 0, {}), { size: 0, step: 0 });
});
