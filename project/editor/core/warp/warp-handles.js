/**
 * Dragging a warp's control points (docs/WARP_GRID.md).
 *
 * The warp panel has always said *"Warp added. Drag its handles on the
 * canvas."* and its own header drew the flow as
 * `Add Warp → choose 3×3 / 4×4 → drag handles → Capture`. There were no
 * handles. `movePoint` existed, the runtime bent paths correctly, the panel
 * could add, size, drive, reset and remove a warp — and nothing in the editor
 * could move a single point, so every warp an author added did exactly
 * nothing. This is the missing gesture.
 *
 * It follows the hand rig (`core/puppet/hand-handles.js`) deliberately, because
 * it is the same kind of thing and the same distinction applies: the puppet
 * handles drive *parameters*, live and non-destructive, while a control point
 * is a **document** field, so a whole drag is one command and one undo step,
 * never one per frame.
 *
 * What is different is that the artwork has to bend while the drag is
 * happening — a lattice you move blind is not an editor. So the target is
 * compiled once when the drag starts and `applyWarp` is asked for a path per
 * move: the same call the render loop makes, with the parse already paid for.
 */
import { applyWarp, compileWarpTarget, normalizeWarpGrid } from '../../../runtime/runtime.js';

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value) => Math.round(number(value) * 100) / 100;

/**
 * The warp on this element, if it has one, in the shape the canvas draws.
 *
 * `grid` is carried whole and normalized rather than picked apart: it holds the
 * **rest lattice** the displacement is measured against, and a grid handed on
 * without it reports no displacement at all — which is a warp that silently
 * does nothing, the exact failure this file exists to end.
 */
export function warpOverlay(document = {}, elementId = null) {
  if (!elementId) return null;
  const warp = (document?.warps || []).find((item) => item?.target === elementId);
  const restPath = document?.elements?.[elementId]?.restPath;
  if (!warp || !restPath) return null;
  const grid = normalizeWarpGrid(warp.grid);
  if (!grid.points.length) return null;
  return { id: warp.id, target: elementId, columns: grid.columns, rows: grid.rows, points: grid.points, grid, restPath };
}

/**
 * The lattice, as pairs of point indices — every horizontal and vertical
 * neighbour, and nothing else. Drawn so an author can see the grid they are
 * bending rather than a constellation of dots.
 */
export function warpLattice({ columns = 3, rows = 3 } = {}) {
  const edges = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      if (column + 1 < columns) edges.push([index, index + 1]);
      if (row + 1 < rows) edges.push([index, index + columns]);
    }
  }
  return edges;
}

/** Whether a point sits on the outside of the grid, which is what pins a silhouette. */
export const isWarpEdgePoint = (index, { columns = 3, rows = 3 } = {}) => {
  const row = Math.floor(index / columns), column = index % columns;
  return row === 0 || column === 0 || row === rows - 1 || column === columns - 1;
};

export function createWarpGesture({ document: read = () => ({}), commands = {} } = {}) {
  let drag = null;

  const start = (elementId, index) => {
    const overlay = warpOverlay(read(), elementId);
    if (!overlay || !overlay.points[index]) return null;
    // Parsed once for the whole gesture; every move after this is arithmetic.
    let target = null;
    try { target = compileWarpTarget(overlay.restPath, overlay.grid); } catch { target = null; }
    return { overlay, target };
  };

  /** The overlay with one point moved, plus the outline that bends with it. */
  const shaped = (base, index, point) => {
    const points = base.overlay.points.map((current, position) => (position === index ? point : current));
    const grid = { ...base.overlay.grid, points };
    let path = null;
    if (base.target) {
      try { path = applyWarp(base.target, grid); } catch { path = null; }
    }
    return { ...base.overlay, grid, points, path };
  };

  return {
    active: () => (drag ? { target: drag.elementId, index: drag.index, moved: drag.moved } : null),
    /** What to draw right now: the live lattice, or nothing when no drag is on. */
    preview: () => (drag ? drag.overlay : null),
    begin(elementId, index) {
      const base = Number.isInteger(index) ? start(elementId, index) : null;
      if (!base) return null;
      drag = { elementId, index, base, moved: false, point: null, overlay: { ...base.overlay, path: null } };
      return drag.overlay;
    },
    to(point) {
      if (!drag || !point) return null;
      drag.point = { x: round(point.x), y: round(point.y) };
      drag.overlay = shaped(drag.base, drag.index, drag.point);
      drag.moved = true;
      return drag.overlay;
    },
    /** One command for the whole gesture. A drag that never moved writes nothing. */
    commit() {
      if (!drag) return false;
      const { base, index, point, moved } = drag;
      drag = null;
      return moved && point ? Boolean(commands.movePoint?.(base.overlay.id, index, point)) : false;
    },
    /** Give up. The document was never written to, so there is nothing to undo. */
    cancel() {
      const had = Boolean(drag);
      drag = null;
      return had;
    },
    /** A keyboard nudge: the same edit, in artwork units, committed on the spot. */
    nudge(elementId, index, { dx = 0, dy = 0 } = {}) {
      if (drag) return false;
      const base = Number.isInteger(index) ? start(elementId, index) : null;
      if (!base) return false;
      const from = base.overlay.points[index];
      return Boolean(commands.movePoint?.(base.overlay.id, index, { x: round(from.x + number(dx)), y: round(from.y + number(dy)) }));
    }
  };
}
