/**
 * Transform gizmo geometry (docs/SELECTION_GIZMO.md).
 *
 * ```text
 *                  ○
 *             rotate handle
 *                  │
 *
 *         □────────────────□
 *         │                │
 *         │       ⊕        │
 *         │      pivot     │
 *         │                │
 *         □────────────────□
 * ```
 *
 * Pure geometry, no DOM: every drag is a function from (start state, start
 * point, current point) to a new transform. That is what lets the whole
 * interaction be unit-tested, and it is why a drag can produce exactly one
 * history command — the DOM layer only has to apply the result.
 */
import { applyElementTransform, unrotateElementPoint, inverseElementTransform, angleAround } from '../../runtime/runtime.js';

export const GIZMO_MODES = Object.freeze(['move', 'rotate', 'scale', 'pivot']);

/** G / R / S / P, and Escape to cancel — the shortcuts the toolbar mirrors. */
export const GIZMO_SHORTCUTS = Object.freeze({ g: 'move', r: 'rotate', s: 'scale', p: 'pivot' });

export const CORNER_HANDLES = Object.freeze(['nw', 'ne', 'se', 'sw']);
export const EDGE_HANDLES = Object.freeze(['n', 'e', 's', 'w']);

/** How far above the box the rotate handle floats, in screen pixels. */
export const ROTATE_HANDLE_OFFSET = 28;

export const SNAP = Object.freeze({ translate: 8, rotation: 15, scale: 0.1 });

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

/** Handle anchors in the element's own coordinates. */
export function localHandlePoints(box) {
  const x = finite(box?.x), y = finite(box?.y);
  const w = finite(box?.width), h = finite(box?.height);
  const cx = x + w / 2, cy = y + h / 2;
  return {
    nw: { x, y }, n: { x: cx, y }, ne: { x: x + w, y },
    w: { x, y: cy }, e: { x: x + w, y: cy },
    sw: { x, y: y + h }, s: { x: cx, y: y + h }, se: { x: x + w, y: y + h }
  };
}

/**
 * Everything the overlay draws, in canvas coordinates.
 *
 * `scale` is the canvas zoom: handles keep a constant screen size, so a gizmo
 * stays usable at any zoom instead of becoming a speck or swallowing the
 * artwork.
 */
export function gizmoModel(box, transform, { scale = 1, rotateOffset = ROTATE_HANDLE_OFFSET } = {}) {
  const local = localHandlePoints(box);
  const handles = {};
  for (const [name, point] of Object.entries(local)) handles[name] = applyElementTransform(transform, point);
  const zoom = finite(scale, 1) || 1;
  // The rotate handle floats along the box's own "up", so it follows rotation.
  const up = { x: handles.n.x - handles.s.x, y: handles.n.y - handles.s.y };
  const length = Math.hypot(up.x, up.y) || 1;
  const rotate = {
    x: handles.n.x + (up.x / length) * (rotateOffset / zoom),
    y: handles.n.y + (up.y / length) * (rotateOffset / zoom)
  };
  return {
    handles,
    rotate,
    pivot: applyElementTransform(transform, { x: finite(transform?.pivotX), y: finite(transform?.pivotY) }),
    outline: [handles.nw, handles.ne, handles.se, handles.sw],
    /** Handle radius in canvas units that renders at a constant screen size. */
    handleRadius: 5 / zoom
  };
}

/**
 * Which handle a pointer is over, or `null` for the body.
 *
 * The pivot wins ties: it sits inside the box, and an author reaching for it
 * has aimed at it deliberately.
 */
export function hitTestGizmo(model, point, { tolerance = 8, scale = 1, mode = 'move' } = {}) {
  const radius = finite(tolerance, 8) / (finite(scale, 1) || 1);
  const near = (candidate) => Math.hypot(candidate.x - finite(point?.x), candidate.y - finite(point?.y)) <= radius;
  if (mode === 'pivot' && near(model.pivot)) return 'pivot';
  if (near(model.pivot)) return 'pivot';
  if (near(model.rotate)) return 'rotate';
  for (const name of [...CORNER_HANDLES, ...EDGE_HANDLES]) if (near(model.handles[name])) return name;
  return pointInQuad(model.outline, point) ? 'body' : null;
}

export function pointInQuad(quad, point) {
  if (!Array.isArray(quad) || quad.length < 3) return false;
  const x = finite(point?.x), y = finite(point?.y);
  let inside = false;
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i, i += 1) {
    const a = quad[i], b = quad[j];
    const straddles = (a.y > y) !== (b.y > y);
    if (straddles && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function snapValue(value, step) {
  const size = Math.abs(finite(step, 0));
  return size ? Math.round(finite(value) / size) * size : finite(value);
}

/* ── Drags ───────────────────────────────────────────────────────────────── */

/**
 * A drag session. `start` is the transform at pointer-down and is never
 * mutated, so cancelling is simply applying it again — that is the whole of
 * "Esc restores exactly the previous state".
 */
export function beginGizmoDrag({ mode, handle, transform, box, point, scale = 1 }) {
  return {
    mode: GIZMO_MODES.includes(mode) ? mode : 'move',
    handle: handle || null,
    start: { ...transform },
    box: { ...box },
    origin: { ...point },
    scale: finite(scale, 1) || 1,
    rotationDelta: 0
  };
}

/** @returns {object} the transform for the current pointer position */
export function updateGizmoDrag(drag, point, { shift = false } = {}) {
  if (!drag) return null;
  if (drag.mode === 'rotate') return rotateDrag(drag, point, shift);
  if (drag.mode === 'scale') return scaleDrag(drag, point, shift);
  if (drag.mode === 'pivot') return pivotDrag(drag, point, shift);
  return moveDrag(drag, point, shift);
}

/** Cancel: the transform the drag started from, untouched. */
export function cancelGizmoDrag(drag) {
  return drag ? { ...drag.start } : null;
}

function moveDrag(drag, point, shift) {
  let dx = finite(point?.x) - drag.origin.x;
  let dy = finite(point?.y) - drag.origin.y;
  if (shift) {
    // Constrain to the dominant axis, then snap along it.
    if (Math.abs(dx) >= Math.abs(dy)) { dy = 0; dx = snapValue(dx, SNAP.translate); }
    else { dx = 0; dy = snapValue(dy, SNAP.translate); }
  }
  return { ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy };
}

function rotateDrag(drag, point, shift) {
  const pivot = applyElementTransform(drag.start, { x: finite(drag.start.pivotX), y: finite(drag.start.pivotY) });
  // atan2 wraps at ±180°. Unwrapping against the previous reading keeps a drag
  // going the way the hand is going, instead of spinning the long way round
  // the moment it crosses the seam.
  let delta = angleAround(pivot, drag.origin, point);
  const previous = finite(drag.rotationDelta, 0);
  while (delta - previous > 180) delta -= 360;
  while (delta - previous < -180) delta += 360;
  drag.rotationDelta = delta;
  const rotation = finite(drag.start.rotation) + delta;
  return { ...drag.start, rotation: shift ? snapValue(rotation, SNAP.rotation) : rotation };
}

function scaleDrag(drag, point, shift) {
  const handle = drag.handle && localHandlePoints(drag.box)[drag.handle];
  if (!handle) return { ...drag.start };
  const pivotX = finite(drag.start.pivotX);
  const pivotY = finite(drag.start.pivotY);
  // Scaling happens about the pivot and before rotation, so the drag is
  // resolved in the space that has been scaled but not yet rotated.
  const target = unrotateElementPoint(drag.start, point);
  const armX = handle.x - pivotX;
  const armY = handle.y - pivotY;
  const horizontal = drag.handle !== 'n' && drag.handle !== 's' && Math.abs(armX) > 1e-6;
  const vertical = drag.handle !== 'e' && drag.handle !== 'w' && Math.abs(armY) > 1e-6;
  let scaleX = horizontal ? (target.x - pivotX) / armX : finite(drag.start.scaleX, 1);
  let scaleY = vertical ? (target.y - pivotY) / armY : finite(drag.start.scaleY, 1);
  if (shift) {
    if (horizontal && vertical) {
      // Keep proportions: take the larger change and apply it to both axes.
      const ratioX = scaleX / (finite(drag.start.scaleX, 1) || 1);
      const ratioY = scaleY / (finite(drag.start.scaleY, 1) || 1);
      const ratio = Math.abs(ratioX) > Math.abs(ratioY) ? ratioX : ratioY;
      scaleX = finite(drag.start.scaleX, 1) * ratio;
      scaleY = finite(drag.start.scaleY, 1) * ratio;
    } else {
      scaleX = snapValue(scaleX, SNAP.scale);
      scaleY = snapValue(scaleY, SNAP.scale);
    }
  }
  // A zero scale is unrecoverable by dragging: it collapses the arm the next
  // drag would measure against.
  return { ...drag.start, scaleX: nonZero(scaleX, drag.start.scaleX), scaleY: nonZero(scaleY, drag.start.scaleY) };
}

/**
 * Move the pivot without moving the artwork.
 *
 * Changing the pivot only changes the transform's translation component, so
 * compensating one reference point compensates every point exactly.
 */
function pivotDrag(drag, point, shift) {
  const local = inverseElementTransform(drag.start, point);
  const pivotX = shift ? snapValue(local.x, SNAP.translate) : local.x;
  const pivotY = shift ? snapValue(local.y, SNAP.translate) : local.y;
  const reference = { x: finite(drag.box.x), y: finite(drag.box.y) };
  const before = applyElementTransform(drag.start, reference);
  const moved = { ...drag.start, pivotX, pivotY };
  const after = applyElementTransform(moved, reference);
  return { ...moved, x: moved.x + (before.x - after.x), y: moved.y + (before.y - after.y) };
}

function nonZero(value, fallback) {
  const number = finite(value, fallback);
  if (number === 0 || !Number.isFinite(number)) return finite(fallback, 1) || 1;
  return number;
}
