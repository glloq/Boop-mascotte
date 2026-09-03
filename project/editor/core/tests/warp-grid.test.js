import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWarpGrid, normalizeWarpGrid, normalizeWarp, normalizeWarps, normalizeWarpSize,
  locateInGrid, samplePosition, compileWarpTarget, warpDisplacement, applyWarp,
  isWarpGridMoved, weightWarpGrid, MIN_WARP_GRID, MAX_WARP_GRID
} from '../../../runtime/warp-grid.js';
import { compileRigFrame } from '../../../runtime/runtime.js';
import { parsePath } from '../../../runtime/path-vector.js';
import { interpolate2D } from '../keyforms/interpolate-2d.js';
import { shapeDeltaFromPaths } from '../shape-keys/shape-key-model.js';
import { normalizeRig } from '../rig/normalize-rig.js';

const BOX = { x: 0, y: 0, width: 10, height: 10 };
const SQUARE = 'M0 0 L10 0 L10 10 L0 10 Z';
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message ?? ''} ${actual} != ${expected}`);
const grid = (over = {}) => normalizeWarpGrid({ box: BOX, columns: 3, rows: 3, ...over });
const moved = (base, index, point) => ({ ...base, points: base.points.map((item, i) => i === index ? point : item) });

test('a rest grid spans the box, outer ring included', () => {
  const rest = createWarpGrid(BOX, { columns: 3, rows: 3 });
  assert.equal(rest.points.length, 9);
  assert.deepEqual(rest.points[0], { x: 0, y: 0 });
  assert.deepEqual(rest.points[4], { x: 5, y: 5 });
  assert.deepEqual(rest.points[8], { x: 10, y: 10 });
  assert.equal(createWarpGrid(BOX, { columns: 4, rows: 4 }).points.length, 16);
});

test('grid sizes are held to the small range the roadmap asks for', () => {
  assert.equal(normalizeWarpSize(3), 3);
  assert.equal(normalizeWarpSize(4), 4);
  assert.equal(normalizeWarpSize(9), MAX_WARP_GRID);
  assert.equal(normalizeWarpSize(1), MIN_WARP_GRID);
  assert.equal(normalizeWarpSize('nope'), 3);
});

test('a point is located by cell and fraction, and clamped to the grid', () => {
  const rest = grid();
  assert.deepEqual(locateInGrid(rest, { x: 0, y: 0 }), { column: 0, row: 0, u: 0, v: 0 });
  assert.deepEqual(locateInGrid(rest, { x: 2.5, y: 2.5 }), { column: 0, row: 0, u: 0.5, v: 0.5 });
  assert.deepEqual(locateInGrid(rest, { x: 10, y: 10 }), { column: 1, row: 1, u: 1, v: 1 });
  assert.deepEqual(locateInGrid(rest, { x: -50, y: 99 }), { column: 0, row: 1, u: 0, v: 1 }, 'clamped');
});

test('sampling is bilinear over the four surrounding control points', () => {
  const rest = grid();
  assert.deepEqual(samplePosition(rest.points, 3, { column: 0, row: 0, u: 0.5, v: 0.5 }), { x: 2.5, y: 2.5 });
  const bulged = moved(rest, 4, { x: 8, y: 5 });
  assert.deepEqual(samplePosition(bulged.points, 3, { column: 1, row: 1, u: 0, v: 0 }), { x: 8, y: 5 });
});

test('an unmoved grid leaves the path untouched, and costs nothing', () => {
  const rest = grid();
  const target = compileWarpTarget(SQUARE, rest);
  assert.equal(isWarpGridMoved(rest), false);
  assert.equal(warpDisplacement(target, rest), null);
  assert.equal(applyWarp(target, rest), SQUARE);
});

test('moving an inner control point moves the path near it, not the corners', () => {
  const rest = grid();
  const bulged = moved(rest, 4, { x: 8, y: 5 });
  assert.equal(applyWarp(compileWarpTarget(SQUARE, rest), bulged), SQUARE, 'corners are unaffected by the centre');
  const centred = applyWarp(compileWarpTarget('M5 5 L5 0', rest), bulged);
  assert.equal(centred, 'M8 5 L5 0', 'the point at the centre follows it');
});

test('moving an outer control point moves the corner it holds', () => {
  const rest = grid();
  const pulled = moved(rest, 0, { x: -4, y: -2 });
  const values = parsePath(applyWarp(compileWarpTarget(SQUARE, rest), pulled)).values;
  near(values[0], -4, 'corner x');
  near(values[1], -2, 'corner y');
  near(values[2], 10, 'the far corner stays');
});

test('a warp keeps the path structure exactly', () => {
  const path = 'M0 0 C2 2 8 2 10 0 L10 10 Z';
  const rest = grid();
  const warped = applyWarp(compileWarpTarget(path, rest), moved(rest, 4, { x: 7, y: 6 }));
  assert.equal(parsePath(warped).signature, parsePath(path).signature);
});

test('a 4x4 grid gives finer control than a 3x3 without changing the rules', () => {
  const fine = normalizeWarpGrid({ box: BOX, columns: 4, rows: 4 });
  assert.equal(fine.points.length, 16);
  const target = compileWarpTarget('M3.3333333 3.3333333 L10 10', fine);
  const warped = applyWarp(target, moved(fine, 5, { x: 5, y: 3.3333333 }));
  assert.match(warped, /^M5 3.3333/);
});

test('weightWarpGrid fades a whole warp towards rest', () => {
  const rest = grid();
  const bulged = moved(rest, 4, { x: 9, y: 5 });
  assert.deepEqual(weightWarpGrid(bulged, 1).points[4], { x: 9, y: 5 });
  assert.deepEqual(weightWarpGrid(bulged, 0.5).points[4], { x: 7, y: 5 });
  assert.equal(isWarpGridMoved(weightWarpGrid(bulged, 0)), false);
});

test('a warp and shape keys compose on the same element', () => {
  const rest = 'M0 0 L10 0 L10 10 L0 10 Z';
  const elements = { cheek: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, restPath: rest } };
  const shapeKeys = [{ id: 'puff', target: 'cheek', driver: { mode: 'range', parameter: 'puff', min: 0, max: 1 }, delta: shapeDeltaFromPaths(rest, 'M0 -2 L10 0 L10 10 L0 10 Z') }];
  const warps = [{ id: 'cheek-warp', target: 'cheek', grid: { box: BOX, columns: 3, rows: 3, points: moved(grid(), 0, { x: -3, y: 0 }).points } }];

  const shapeOnly = compileRigFrame(elements, { puff: 1 }, {}, {}, { shapeKeys });
  const warpOnly = compileRigFrame(elements, { puff: 0 }, {}, {}, { warps });
  const both = compileRigFrame(elements, { puff: 1 }, {}, {}, { shapeKeys, warps });
  const first = (path) => parsePath(path).values;
  near(first(shapeOnly.cheek.path)[1], -2, 'the shape key alone lifts the corner');
  near(first(warpOnly.cheek.path)[0], -3, 'the warp alone pulls it sideways');
  near(first(both.cheek.path)[0], -3, 'together: the warp still pulls');
  near(first(both.cheek.path)[1], -2, 'and the shape key still lifts');
});

test('a warp with no shape keys still rebuilds its path', () => {
  const elements = { hair: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, restPath: SQUARE } };
  const warps = [{ id: 'hair-warp', target: 'hair', grid: { box: BOX, columns: 3, rows: 3, points: moved(grid(), 0, { x: -5, y: 0 }).points } }];
  assert.match(compileRigFrame(elements, {}, {}, {}, { warps }).hair.path, /^M-5 0/);
});

test('a driven warp fades in with its parameter', () => {
  const elements = { hair: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, restPath: SQUARE } };
  const warps = [{ id: 'hair-warp', target: 'hair', driver: { parameter: 'wind', min: 0, max: 1 }, grid: { box: BOX, columns: 3, rows: 3, points: moved(grid(), 0, { x: -4, y: 0 }).points } }];
  assert.equal(compileRigFrame(elements, { wind: 0 }, {}, {}, { warps }).hair.path, SQUARE);
  assert.match(compileRigFrame(elements, { wind: 0.5 }, {}, {}, { warps }).hair.path, /^M-2 0/);
  assert.match(compileRigFrame(elements, { wind: 5 }, {}, {}, { warps }).hair.path, /^M-4 0/, 'clamped');
});

test('a warp on an element with no rest outline is skipped, not crashed on', () => {
  const elements = { hair: { baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } } };
  const warps = [{ id: 'hair-warp', target: 'hair', grid: { box: BOX } }];
  assert.doesNotThrow(() => compileRigFrame(elements, {}, {}, {}, { warps }));
  assert.equal(compileRigFrame(elements, {}, {}, {}, { warps }).hair.path, undefined);
});

test('warp records normalize and survive migration', () => {
  const records = normalizeWarps({ warps: [{ id: 'a', target: 'hair', grid: { box: BOX } }, { id: '', target: 'hair' }, { id: 'b', target: '' }] });
  assert.deepEqual(records.map((item) => item.id), ['a']);
  assert.equal(records[0].grid.points.length, 9);
  assert.equal(normalizeWarp({}).driver, null);
  const rig = normalizeRig({ params: {}, states: {}, elements: {}, warps: [{ id: 'a', target: 'hair', grid: { box: BOX } }] });
  assert.deepEqual(rig.warps.map((item) => item.id), ['a']);
  assert.deepEqual(normalizeRig({ params: {}, states: {}, elements: {} }).warps, []);
});

test('spatial and parameter interpolation are separate functions with separate meanings', () => {
  // Same bilinear shape, different domains: gridX × gridY here, headX × headY there.
  const spatial = samplePosition(grid().points, 3, { column: 0, row: 0, u: 0.5, v: 0.5 });
  const parameter = interpolate2D([-1, 0, 1], [-1, 0, 1], [[0, 1, 2], [3, 4, 5], [6, 7, 8]], 0, 0);
  assert.deepEqual(spatial, { x: 2.5, y: 2.5 });
  assert.equal(parameter, 4);
});

test('warp diagnostics read like advice and check what was authored', async () => {
  const { validateWarps } = await import('../validation/rig-validator.js');
  const issues = validateWarps({
    elements: { hair: { restPath: SQUARE } }, params: {},
    warps: [
      { id: 'a', target: 'ghost', grid: { box: { width: 0, height: 0 } }, driver: { parameter: 'wind' } },
      { id: 'b', target: 'hair', grid: { columns: 9, rows: 3, box: { width: 10, height: 10 } } },
      { id: 'c', target: 'hair', grid: { columns: 3, rows: 3, box: { width: 10, height: 10 }, points: [{ x: 0, y: 0 }] } },
      { id: 'a', target: 'hair', grid: { columns: 3, rows: 3, box: { width: 10, height: 10 } } }
    ]
  });
  assert.ok(issues.some((issue) => /the shape "ghost" it bends no longer exists/.test(issue)));
  assert.ok(issues.some((issue) => /its area has no size yet/.test(issue)));
  assert.ok(issues.some((issue) => /faded by a movement that no longer exists: "wind"/.test(issue)));
  assert.ok(issues.some((issue) => /a grid must be between 2x2 and 5x5/.test(issue)));
  assert.ok(issues.some((issue) => /has 1 control point but needs 9/.test(issue)));
  assert.ok(issues.some((issue) => /another warp already uses this identifier/.test(issue)));
});

test('an element with no rest outline is told so, rather than silently doing nothing', async () => {
  const { validateWarps } = await import('../validation/rig-validator.js');
  const issues = validateWarps({ elements: { hair: {} }, params: {}, warps: [{ id: 'a', target: 'hair', grid: { columns: 3, rows: 3, box: { width: 10, height: 10 } } }] });
  assert.ok(issues.some((issue) => /has no rest outline, so there is nothing to bend/.test(issue)));
});
