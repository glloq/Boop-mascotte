/**
 * Small SVG warp grid (docs/WARP_GRID.md).
 *
 * ```text
 * ●────●────●
 * │    │    │
 * ●────●────●
 * │    │    │
 * ●────●────●
 * ```
 *
 * A path's points are located inside a rest grid once; moving the control
 * points then moves the path with them. It is the escape hatch for shapes that
 * transforms and shape keys cannot do — a face outline, hair, a fat cheek —
 * and it is deliberately small: 3×3 or 4×4, exceptionally 5×5.
 *
 * **This is spatial interpolation.** Parameter interpolation lives in
 * `keyforms.js`, and the two are kept apart on purpose: they look alike and
 * mean completely different things.
 */
import { finite, clamp } from './numeric.js';
import { parsePath, serializePath } from './path-vector.js';

export const WARP_GRID_SIZES = Object.freeze([3, 4, 5]);
export const MIN_WARP_GRID = 2;
export const MAX_WARP_GRID = 5;

export function normalizeWarpSize(value, fallback = 3) {
  const size = Math.round(finite(value, fallback));
  return clamp(Number.isFinite(size) ? size : fallback, MIN_WARP_GRID, MAX_WARP_GRID);
}

/**
 * A rest grid over a bounding box: `columns × rows` points, row-major.
 * The outer ring sits exactly on the box, so a path never falls outside.
 */
export function createWarpGrid(box, { columns = 3, rows = 3 } = {}) {
  const width = normalizeWarpSize(columns);
  const height = normalizeWarpSize(rows);
  const x = finite(box?.x, 0);
  const y = finite(box?.y, 0);
  const w = Math.max(1e-6, finite(box?.width, 1));
  const h = Math.max(1e-6, finite(box?.height, 1));
  const points = [];
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      points.push({ x: x + (w * column) / (width - 1), y: y + (h * row) / (height - 1) });
    }
  }
  return { columns: width, rows: height, box: { x, y, width: w, height: h }, points };
}

export function normalizeWarpGrid(source = {}) {
  const grid = createWarpGrid(source?.box, { columns: source?.columns, rows: source?.rows });
  const authored = Array.isArray(source?.points) ? source.points : [];
  return {
    ...grid,
    points: grid.points.map((rest, index) => ({
      x: finite(authored[index]?.x, rest.x),
      y: finite(authored[index]?.y, rest.y)
    })),
    rest: grid.points
  };
}

/**
 * Where a point sits in the rest grid: which cell, and how far into it.
 * Computed once per path point and then reused every frame.
 */
export function locateInGrid(grid, point) {
  const { box, columns, rows } = grid;
  const u = clamp((finite(point?.x, 0) - box.x) / box.width, 0, 1) * (columns - 1);
  const v = clamp((finite(point?.y, 0) - box.y) / box.height, 0, 1) * (rows - 1);
  const column = Math.min(columns - 2, Math.floor(u));
  const row = Math.min(rows - 2, Math.floor(v));
  return { column, row, u: u - column, v: v - row };
}

/** Bilinear blend of the four surrounding control points. */
export function samplePosition(points, columns, cell) {
  const index = (column, row) => row * columns + column;
  const p00 = points[index(cell.column, cell.row)];
  const p10 = points[index(cell.column + 1, cell.row)];
  const p01 = points[index(cell.column, cell.row + 1)];
  const p11 = points[index(cell.column + 1, cell.row + 1)];
  const top = { x: p00.x + (p10.x - p00.x) * cell.u, y: p00.y + (p10.y - p00.y) * cell.u };
  const bottom = { x: p01.x + (p11.x - p01.x) * cell.u, y: p01.y + (p11.y - p01.y) * cell.u };
  return { x: top.x + (bottom.x - top.x) * cell.v, y: top.y + (bottom.y - top.y) * cell.v };
}

/**
 * Bind a path to a grid **once**: parse it, and record where each of its
 * points sits in the rest grid. Per frame all that remains is a blend and one
 * string rebuild (docs/RUNTIME_PERFORMANCE.md).
 */
export function compileWarpTarget(path, grid) {
  const parsed = parsePath(path);
  const cells = [];
  for (let index = 0; index + 1 < parsed.values.length; index += 2) {
    cells.push(locateInGrid(grid, { x: parsed.values[index], y: parsed.values[index + 1] }));
  }
  return {
    commands: parsed.commands,
    signature: parsed.signature,
    rest: parsed.values,
    cells,
    scratch: new Float64Array(parsed.values.length),
    lastPath: path
  };
}

export function isWarpGridMoved(grid) {
  const rest = grid.rest || grid.points;
  for (let index = 0; index < grid.points.length; index += 1) {
    if (grid.points[index].x !== rest[index].x || grid.points[index].y !== rest[index].y) return true;
  }
  return false;
}

/**
 * How far each of a target's points moves under a grid, as a flat
 * `[dx, dy, …]` vector.
 *
 * A displacement rather than a finished path, because a warped element is
 * usually also carrying shape keys: both are offsets on the same numeric
 * vector, so they add instead of fighting over who rebuilds the string.
 * Returns `null` when the grid is at rest, so an idle warp costs nothing.
 */
export function warpDisplacement(target, grid) {
  if (!isWarpGridMoved(grid)) return null;
  const rest = grid.rest || grid.points;
  const out = target.displacement || (target.displacement = new Float64Array(target.rest.length));
  for (let pair = 0; pair < target.cells.length; pair += 1) {
    const cell = target.cells[pair];
    const restPoint = samplePosition(rest, grid.columns, cell);
    const nowPoint = samplePosition(grid.points, grid.columns, cell);
    out[pair * 2] = nowPoint.x - restPoint.x;
    out[pair * 2 + 1] = nowPoint.y - restPoint.y;
  }
  return out;
}

/** Convenience: the warped path on its own, for previews and tests. */
export function applyWarp(target, grid) {
  const displacement = warpDisplacement(target, grid);
  if (!displacement) return target.lastPath;
  const values = target.scratch;
  values.set(target.rest);
  for (let index = 0; index < values.length; index += 1) values[index] += displacement[index];
  target.lastPath = serializePath(target.commands, values);
  return target.lastPath;
}

/* ── Records ─────────────────────────────────────────────────────────────── */

export function normalizeWarp(source = {}) {
  return {
    id: typeof source?.id === 'string' && source.id ? source.id : '',
    target: typeof source?.target === 'string' ? source.target : '',
    grid: normalizeWarpGrid(source?.grid),
    /** Optional parameter that fades the whole warp in and out. */
    driver: source?.driver && typeof source.driver === 'object'
      ? { parameter: String(source.driver.parameter ?? ''), min: finite(source.driver.min, 0), max: finite(source.driver.max, 1) }
      : null
  };
}

export function normalizeWarps(rig = {}) {
  if (!Array.isArray(rig?.warps)) return [];
  return rig.warps
    .filter((item) => item && typeof item === 'object')
    .map(normalizeWarp)
    .filter((item) => item.id && item.target);
}

/** Blend a grid towards its rest by `1 - weight`, for a driven warp. */
export function weightWarpGrid(grid, weight) {
  const amount = clamp(finite(weight, 1), 0, 1);
  if (amount === 1) return grid;
  const rest = grid.rest || grid.points;
  return {
    ...grid,
    points: grid.points.map((point, index) => ({
      x: rest[index].x + (point.x - rest[index].x) * amount,
      y: rest[index].y + (point.y - rest[index].y) * amount
    }))
  };
}
