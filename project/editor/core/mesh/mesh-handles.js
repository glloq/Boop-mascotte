import { meshPieces, meshRestPoints, meshTriangles } from '../../../runtime/mesh-warp.js';

/**
 * Dragging a mesh's control points.
 *
 * Built on the warp's gesture (`core/warp/warp-handles.js`) because it is the
 * same kind of thing and the same bargain applies: a control point is a
 * **document** field, so a whole drag is one command and one undo step, never
 * one per frame. And the artwork has to bend while the pointer is down,
 * because a lattice moved blind is not an editor.
 *
 * One difference, and it is what makes this simpler than the warp. A warp
 * bends a path, so the preview has to re-run the deformation over the path's
 * points. A mesh bends a *picture*, which is drawn as triangles that already
 * carry their own transforms (runtime/mesh-warp.js) -- so the preview is
 * writing those transforms again, and nothing has to be re-parsed at all.
 *
 * Points are kept in unit space, 0 to 1, so a mesh survives its picture being
 * resized or replaced: a mouth bent open is still bent open when a bigger
 * drawing of the same mouth arrives.
 */

/**
 * A point may leave its picture's box, but not by much.
 *
 * Bending a mouth open means pulling a point past the edge of the drawing, so
 * clamping at 0 and 1 would forbid the most ordinary thing this is for.
 * Clamping somewhere is still worth doing: a point dragged to the far side of
 * the canvas folds its triangles inside out, and the picture disappears with
 * nothing on screen saying why.
 */
const clampPoint = (value) => Math.min(1.5, Math.max(-0.5, Number(value) || 0));

/**
 * The mesh on this piece, in the space the canvas draws, or null.
 *
 * @returns {{ target: string, size: number, points: {x,y}[], unit: {x,y}[], box: object }|null}
 */
export function meshOverlay(document = {}, elementId = null, box = null) {
  if (!elementId || !box || !(box.width > 0) || !(box.height > 0)) return null;
  const mesh = (document?.meshes || []).find((item) => item?.target === elementId);
  if (!mesh) return null;
  return {
    target: elementId, size: mesh.size, unit: mesh.points, box,
    points: mesh.points.map((point) => ({ x: box.x + point.x * box.width, y: box.y + point.y * box.height }))
  };
}

/** Every horizontal and vertical neighbour, so an author sees a grid and not dots. */
export function meshLattice(size = 3) {
  const side = Math.max(2, Math.round(Number(size) || 3));
  const edges = [];
  for (let row = 0; row < side; row += 1) for (let column = 0; column < side; column += 1) {
    const index = row * side + column;
    if (column + 1 < side) edges.push([index, index + 1]);
    if (row + 1 < side) edges.push([index, index + side]);
  }
  return edges;
}

/** Whether a point sits on the outside, which is what holds a picture's edge straight. */
export const isMeshEdgePoint = (index, size = 3) => {
  const side = Math.max(2, Math.round(Number(size) || 3));
  const row = Math.floor(index / side), column = index % side;
  return row === 0 || column === 0 || row === side - 1 || column === side - 1;
};

/** The point opposite this one across the vertical middle, for mirroring a drag. */
export const meshMirrorIndex = (index, size = 3) => {
  const side = Math.max(2, Math.round(Number(size) || 3));
  const row = Math.floor(index / side), column = index % side;
  return row * side + (side - 1 - column);
};

export function createMeshGesture({ document: read = () => ({}), box: readBox = () => null, commands = {} } = {}) {
  let drag = null;

  /** The overlay with one point moved -- and its mirror, when asked. */
  const shaped = (overlay, index, point, { mirror = false } = {}) => {
    const unit = { x: clampPoint((point.x - overlay.box.x) / overlay.box.width), y: clampPoint((point.y - overlay.box.y) / overlay.box.height) };
    const points = overlay.unit.map((current, position) => (position === index ? unit : current));
    if (mirror) {
      const opposite = meshMirrorIndex(index, overlay.size);
      // A point's mirror is its reflection about the middle: the same distance
      // from the edge, on the other side. A point on the axis is its own
      // mirror and is left alone rather than written twice.
      if (opposite !== index) points[opposite] = { x: clampPoint(1 - unit.x), y: unit.y };
    }
    return {
      ...overlay, unit: points,
      points: points.map((current) => ({ x: overlay.box.x + current.x * overlay.box.width, y: overlay.box.y + current.y * overlay.box.height })),
      pieces: meshPieces({ size: overlay.size, points }, overlay.box)
    };
  };

  return {
    /** What the canvas should draw right now, or null when nothing is being dragged. */
    preview: () => drag?.shape || null,

    start(elementId, index, { mirror = false } = {}) {
      const overlay = meshOverlay(read(), elementId, readBox(elementId));
      if (!overlay || !overlay.points[index]) return false;
      drag = { overlay, index, mirror, shape: shaped(overlay, index, overlay.points[index], { mirror }) };
      return true;
    },

    move(point) {
      if (!drag) return null;
      drag.shape = shaped(drag.overlay, drag.index, point, { mirror: drag.mirror });
      return drag.shape;
    },

    /** One command, one undo step, whatever the pointer did on the way. */
    commit() {
      if (!drag) return false;
      const { overlay, shape } = drag;
      drag = null;
      const moved = shape.unit.some((point, index) => point.x !== overlay.unit[index].x || point.y !== overlay.unit[index].y);
      if (!moved) return false;
      commands.moveMeshPoints?.(overlay.target, shape.unit);
      return true;
    },

    cancel() { const had = Boolean(drag); drag = null; return had; },

    /** Back to the grid it started as, in one step. */
    reset(elementId) {
      const overlay = meshOverlay(read(), elementId, readBox(elementId));
      if (!overlay) return false;
      commands.moveMeshPoints?.(elementId, meshRestPoints(overlay.size));
      return true;
    },

    triangles: (size) => meshTriangles(size)
  };
}
