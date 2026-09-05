import test from 'node:test';
import assert from 'node:assert/strict';
import * as build from '../path/path-build.js';
import { anchorsToPath, constrainAngle, linePath, mirrorHandle, polygonPath, shapeBox, snapToGrid } from '../path/path-build.js';
import { pathNodes } from '../path/path-nodes.js';
import { canParsePath } from '../../../runtime/path-vector.js';

test('anchors without handles make straight segments, with handles make cubics, and close cleanly', () => {
  assert.equal(anchorsToPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]), 'M 0 0 L 10 0 L 10 10');
  assert.equal(anchorsToPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], { close: true }), 'M 0 0 L 10 0 L 10 10 Z');
  const curved = anchorsToPath([{ x: 0, y: 0, out: { x: 5, y: -5 } }, { x: 10, y: 0, in: { x: 8, y: -5 }, out: { x: 12, y: 5 } }, { x: 20, y: 10 }]);
  assert.equal(curved, 'M 0 0 C 5 -5 8 -5 10 0 C 12 5 20 10 20 10', 'a missing handle is the anchor itself');
  assert.ok(canParsePath(curved));
  assert.equal(pathNodes(curved).length, 3, 'the node model reads every anchor back');
  // A handle reaching across the closing segment draws it out before Z.
  const closedCurve = anchorsToPath([{ x: 0, y: 0, in: { x: -3, y: 3 } }, { x: 10, y: 0 }, { x: 10, y: 10, out: { x: 5, y: 12 } }], { close: true });
  assert.equal(closedCurve, 'M 0 0 L 10 0 L 10 10 C 5 12 -3 3 0 0 Z');
  assert.equal(anchorsToPath([]), '');
  assert.equal(anchorsToPath([{ x: 1.234, y: 5.678 }], { precision: 1 }), 'M 1.2 5.7');
  assert.equal(anchorsToPath([{ x: 0, y: 0 }, { x: 5, y: 5 }], { close: true }), 'M 0 0 L 5 5', 'two points cannot close');
});

test('lines, polygons and stars', () => {
  assert.equal(linePath({ x: 1, y: 2 }, { x: 3, y: 4 }), 'M 1 2 L 3 4');
  const square = polygonPath({ x: 0, y: 0 }, 10, 4, { rotation: -90 });
  const corners = pathNodes(square);
  assert.equal(corners.length, 4);
  assert.deepEqual(corners.map((c) => [c.x, c.y]), [[0, -10], [10, 0], [0, 10], [-10, 0]]);
  assert.ok(square.endsWith(' Z'));
  const star = polygonPath({ x: 0, y: 0 }, 10, 5, { star: true, inner: 0.5 });
  const points = pathNodes(star);
  assert.equal(points.length, 10, 'a star has twice the points');
  const radii = points.map((p) => Math.round(Math.hypot(p.x, p.y)));
  assert.deepEqual(radii, [10, 5, 10, 5, 10, 5, 10, 5, 10, 5]);
  assert.equal(polygonPath({ x: 0, y: 0 }, 0, 5), '', 'no radius, no shape');
  assert.equal(pathNodes(polygonPath({ x: 0, y: 0 }, 5, 2)).length, 3, 'fewer than three sides is a triangle');
});

test('Shift constrains an angle, the grid snaps, and the shape box honours its modifiers', () => {
  const snapped = constrainAngle({ x: 0, y: 0 }, { x: 10, y: 1 });
  assert.ok(Math.abs(snapped.y) < 1e-9 && Math.abs(snapped.x - Math.hypot(10, 1)) < 1e-9, 'nearly horizontal becomes horizontal, keeping the length');
  const diagonal = constrainAngle({ x: 0, y: 0 }, { x: 10, y: 8 });
  assert.ok(Math.abs(diagonal.x - diagonal.y) < 1e-9, 'nearly diagonal becomes 45 degrees');
  assert.deepEqual(constrainAngle({ x: 3, y: 3 }, { x: 3, y: 3 }), { x: 3, y: 3 }, 'no length, nothing to constrain');
  assert.deepEqual(snapToGrid({ x: 13, y: 27 }, 10), { x: 10, y: 30 });
  assert.deepEqual(snapToGrid({ x: 13, y: 27 }, 0), { x: 13, y: 27 });
  assert.deepEqual(shapeBox({ x: 10, y: 10 }, { x: 30, y: 15 }), { x: 10, y: 10, width: 20, height: 5 });
  assert.deepEqual(shapeBox({ x: 10, y: 10 }, { x: 30, y: 15 }, { square: true }), { x: 10, y: 10, width: 20, height: 20 });
  assert.deepEqual(shapeBox({ x: 10, y: 10 }, { x: -10, y: 15 }, { square: true }), { x: -10, y: 10, width: 20, height: 20 }, 'a square drawn leftwards grows leftwards');
  assert.deepEqual(shapeBox({ x: 10, y: 10 }, { x: 30, y: 15 }, { fromCenter: true }), { x: -10, y: 5, width: 40, height: 10 });
  assert.deepEqual(mirrorHandle({ x: 5, y: 5 }, { x: 8, y: 9 }), { x: 2, y: 1 });
});

test('a basic shape becomes the path it draws, and a shape with no outline does not', () => {
  const { shapeToPath, SHAPE_GEOMETRY_ATTRIBUTES } = { shapeToPath: (...args) => build.shapeToPath(...args), SHAPE_GEOMETRY_ATTRIBUTES: build.SHAPE_GEOMETRY_ATTRIBUTES };
  assert.equal(shapeToPath('rect', { x: 10, y: 20, width: 30, height: 10 }), 'M 10 20 L 40 20 L 40 30 L 10 30 Z');
  const rounded = shapeToPath('rect', { x: 0, y: 0, width: 20, height: 10, rx: 4 });
  assert.match(rounded, /^M 4 0 L 16 0 C /, 'the corners are arcs');
  assert.equal((rounded.match(/ C /g) || []).length, 4);
  assert.match(shapeToPath('rect', { x: 0, y: 0, width: 20, height: 10, rx: 50 }), /^M 10 0 L 10 0 C /, 'a radius is capped at half');
  const circle = shapeToPath('circle', { cx: 5, cy: 5, r: 5 });
  assert.match(circle, /^M 10 5 C /);
  assert.equal((circle.match(/ C /g) || []).length, 4, 'four quarter arcs');
  assert.ok(circle.endsWith(' Z'));
  assert.equal(shapeToPath('ellipse', { cx: 0, cy: 0, rx: 10, ry: 0 }), null, 'no outline, no path');
  assert.equal(shapeToPath('line', { x1: 1, y1: 2, x2: 3, y2: 4 }), 'M 1 2 L 3 4');
  assert.equal(shapeToPath('polygon', { points: '0,0 10,0 10,10' }), 'M 0 0 L 10 0 L 10 10 Z');
  assert.equal(shapeToPath('polyline', { points: '0 0 10 0' }), 'M 0 0 L 10 0');
  assert.equal(shapeToPath('text', {}), null);
  assert.deepEqual(SHAPE_GEOMETRY_ATTRIBUTES.rect, ['x', 'y', 'width', 'height', 'rx', 'ry']);
});
