/**
 * The head handle, in 2.5D (docs/DIRECT_CONTROLS.md, docs/HEAD_POSE_2_5D.md).
 *
 * Dragging the head sets `headX` and `headY`, and those two parameters are
 * what the pose grid interpolates: the handle is already driving the 2.5D
 * turn. What it could not do was **say so** — nothing on the canvas told you
 * which of the nine positions you were near, or which ones had been captured.
 * That lived only in a 3×3 grid inside a panel.
 *
 * This is the model behind a head handle that knows about the grid: where the
 * live pose sits in it, what each cell holds, and where the cell centres are.
 *
 * Pure: it reads the document and the live parameters, and reports.
 */
import { createHeadPoseAxes, headPoseSummary } from '../head-pose/head-pose-model.js';

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const nearestIndex = (values, value) => values.reduce((best, candidate, index) =>
  Math.abs(candidate - value) < Math.abs(values[best] - value) ? index : best, 0);

/** Where a pose sits in the grid: the cell it is nearest to. */
export function nearestHeadPoseCell(values = {}, axes = createHeadPoseAxes()) {
  const i = nearestIndex(axes.x.values, number(values[axes.x.parameter]));
  const j = nearestIndex(axes.y.values, number(values[axes.y.parameter]));
  return { i, j, x: axes.x.values[i], y: axes.y.values[j] };
}

/** The same pose, moved onto that cell — what Shift does while dragging. */
export function snapHeadPoseValues(values = {}, axes = createHeadPoseAxes()) {
  const cell = nearestHeadPoseCell(values, axes);
  return { [axes.x.parameter]: cell.x, [axes.y.parameter]: cell.y };
}

/** How far the pose is from that cell, as a fraction of a step (0 = on it). */
export function headPoseCellDistance(values = {}, axes = createHeadPoseAxes()) {
  const cell = nearestHeadPoseCell(values, axes);
  const step = (axis) => { const span = axis.values[axis.values.length - 1] - axis.values[0]; return Math.abs(span) / Math.max(1, axis.values.length - 1) || 1; };
  return Math.max(
    Math.abs(number(values[axes.x.parameter]) - cell.x) / step(axes.x),
    Math.abs(number(values[axes.y.parameter]) - cell.y) / step(axes.y)
  );
}

/**
 * The grid as the canvas needs it: every cell with its state and its place in
 * the 3×3, plus which one the live pose is on.
 *
 * `at` is the cell's position in the halo, from 0 to 1 on each axis, so the
 * canvas can lay the dots out without knowing what the axis values are.
 *
 * @returns {{axes, cells: object[], current: object, captured: number,
 *            total: number, onCell: boolean, empty: boolean}}
 */
export function headPoseGrid(document = {}, values = {}, axes = createHeadPoseAxes()) {
  const summary = headPoseSummary(document.keyforms || [], axes);
  const current = nearestHeadPoseCell(values, axes);
  const place = (axis, value) => { const list = axis.values, span = list[list.length - 1] - list[0]; return span ? (value - list[0]) / span : 0.5; };
  const cells = summary.map((cell) => ({
    ...cell,
    current: cell.i === current.i && cell.j === current.j,
    at: { x: place(axes.x, cell.x), y: place(axes.y, cell.y) }
  }));
  const captured = cells.filter((cell) => cell.state !== 'empty').length;
  return {
    axes, cells, captured, total: cells.length,
    current: cells.find((cell) => cell.current) || cells[0],
    onCell: headPoseCellDistance(values, axes) < 0.2,
    empty: captured === 0
  };
}

const DIRECTIONS = Object.freeze({
  '-1,-1': 'up and left', '0,-1': 'up', '1,-1': 'up and right',
  '-1,0': 'left', '0,0': 'centred', '1,0': 'right',
  '-1,1': 'down and left', '0,1': 'down', '1,1': 'down and right'
});

/** Which way the head is turned, and whether that position was captured. */
export function headPoseReadout(grid) {
  const cell = grid?.current;
  if (!cell) return 'at rest';
  const sign = (value) => (value > 0 ? 1 : value < 0 ? -1 : 0);
  const direction = DIRECTIONS[`${sign(cell.x)},${sign(cell.y)}`] || 'turned';
  const where = grid.onCell ? direction : `between positions, nearest ${direction}`;
  if (grid.empty) return `${where} · no turn generated yet`;
  return `${where} · ${cell.state === 'empty' ? 'this position is not captured' : 'captured'}`;
}
