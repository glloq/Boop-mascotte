import test from 'node:test';
import assert from 'node:assert/strict';
import { headPoseCellDistance, headPoseGrid, headPoseReadout, nearestHeadPoseCell, snapHeadPoseValues } from '../puppet/head-pose-handle.js';
import { captureHeadPose, createHeadPoseAxes } from '../head-pose/head-pose-model.js';
import { puppetHandles, puppetOrbitValues, puppetRestValues } from '../puppet/puppet-handles.js';

const axes = createHeadPoseAxes();
const element = () => ({ baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1 });

/** A project whose head grid holds a right-hand turn and a neutral centre. */
function posed() {
  const elements = { face: element(), nose: element() };
  let keyforms = captureHeadPose([], { axes, cell: { i: 1, j: 1 }, samples: { nose: { translateX: 0 } } });
  keyforms = captureHeadPose(keyforms, { axes, cell: { i: 2, j: 1 }, samples: { nose: { translateX: 10 } } });
  return { elements, keyforms };
}

test('a pose lands on the nearest of the nine positions', () => {
  assert.deepEqual(nearestHeadPoseCell({ headX: 0, headY: 0 }, axes), { i: 1, j: 1, x: 0, y: 0 });
  assert.deepEqual(nearestHeadPoseCell({ headX: 0.9, headY: -0.8 }, axes), { i: 2, j: 0, x: 1, y: -1 }, 'up is the lowest headY');
  assert.deepEqual(nearestHeadPoseCell({ headX: -0.4, headY: 0.6 }, axes), { i: 1, j: 2, x: 0, y: 1 });
  assert.deepEqual(nearestHeadPoseCell({}, axes), { i: 1, j: 1, x: 0, y: 0 }, 'nothing set is the centre');

  // Distance is in steps, so "on a position" means the same at any axis scale.
  assert.equal(headPoseCellDistance({ headX: 1, headY: 0 }, axes), 0);
  assert.equal(headPoseCellDistance({ headX: 0.5, headY: 0 }, axes), 0.5);
  assert.deepEqual(snapHeadPoseValues({ headX: 0.9, headY: -0.4 }, axes), { headX: 1, headY: 0 });
});

test('the grid tells the canvas where every position is and what it holds', () => {
  const grid = headPoseGrid(posed(), { headX: 1, headY: 0 }, axes);
  assert.equal(grid.total, 9);
  assert.equal(grid.captured, 2, 'the centre and the right-hand turn');
  assert.equal(grid.empty, false);
  assert.equal(grid.onCell, true);
  assert.equal(grid.current.i, 2);
  assert.equal(grid.current.state, 'captured');
  assert.equal(grid.cells.filter((cell) => cell.current).length, 1);

  // `at` places a cell in the halo without the caller knowing the axis values:
  // 0 is left/up, 1 is right/down.
  const corner = grid.cells.find((cell) => cell.x === -1 && cell.y === -1);
  assert.deepEqual(corner.at, { x: 0, y: 0 });
  assert.deepEqual(grid.cells.find((cell) => cell.x === 1 && cell.y === 1).at, { x: 1, y: 1 });
  assert.deepEqual(grid.cells.find((cell) => cell.center).at, { x: 0.5, y: 0.5 });

  const nothing = headPoseGrid({}, {}, axes);
  assert.equal(nothing.captured, 0);
  assert.equal(nothing.empty, true);
});

test('the head handle says which way it is turned, and whether that pose exists', () => {
  const project = posed();
  assert.equal(headPoseReadout(headPoseGrid(project, { headX: 1, headY: 0 }, axes)), 'right · captured');
  assert.equal(headPoseReadout(headPoseGrid(project, { headX: 0, headY: 0 }, axes)), 'centred · captured');
  assert.equal(headPoseReadout(headPoseGrid(project, { headX: -1, headY: -1 }, axes)), 'up and left · this position is not captured');
  assert.equal(headPoseReadout(headPoseGrid(project, { headX: 0.7, headY: 0 }, axes)), 'between positions, nearest right · captured');
  // Exactly between two positions, the lower one wins — a tie has to go
  // somewhere, and it stays there whichever way the drag came from.
  assert.deepEqual(nearestHeadPoseCell({ headX: 0.5, headY: 0 }, axes), { i: 1, j: 1, x: 0, y: 0 });
  assert.equal(headPoseReadout(headPoseGrid({}, { headX: 1, headY: 0 }, axes)), 'right · no turn generated yet');
  assert.equal(headPoseReadout(null), 'at rest');
});

/* The tilt handle is turned, not dragged. */
const tiltProject = () => ({
  svgMarkup: '<svg/>', elements: { face: element() },
  layers: [{ id: 'face', name: 'face', type: 'path', visible: true, children: [] }],
  semanticParts: { head: { id: 'head', type: 'head', roles: { head: 'face' }, controls: ['headX', 'headY', 'headTilt'] } },
  params: { headX: { type: 'number', min: -1, max: 1, default: 0 }, headY: { type: 'number', min: -1, max: 1, default: 0 }, headTilt: { type: 'number', min: -1, max: 1, default: 0 } }
});

test('tilting is an orbit: degrees around the head, not a distance', () => {
  const tilt = puppetHandles(tiltProject()).find((handle) => handle.id === 'headTilt');
  assert.equal(tilt.mode, 'orbit');
  assert.equal(tilt.orbit.control, 'headTilt');
  assert.equal(tilt.x, null, 'it has no drag axes at all');

  // `throw` is how many degrees cover the range, so half of it is half the way.
  assert.deepEqual(puppetOrbitValues(tilt, tilt.throw / 2), { headTilt: 1 });
  assert.deepEqual(puppetOrbitValues(tilt, -tilt.throw / 2), { headTilt: -1 });
  assert.deepEqual(puppetOrbitValues(tilt, tilt.throw / 4), { headTilt: 0.5 });
  assert.deepEqual(puppetOrbitValues(tilt, 900), { headTilt: 1 }, 'a full spin stops at the end of the range');
  assert.deepEqual(puppetOrbitValues(tilt, 30, { start: { headTilt: 0.5 } }), { headTilt: 1 });
  assert.deepEqual(puppetOrbitValues(tilt, NaN), { headTilt: 0 });
  assert.deepEqual(puppetOrbitValues({ orbit: null }, 45), {});
  assert.deepEqual(puppetRestValues(tilt), { headTilt: 0 }, 'and it can be put back like any other');

  // Turning it off takes its handle away with it.
  const flat = tiltProject();
  flat.semanticParts.head.controls = ['headX', 'headY'];
  assert.equal(puppetHandles(flat).some((handle) => handle.id === 'headTilt'), false);
});
