/**
 * Building paths from gestures (docs/VECTOR_EDITING.md).
 *
 * The Pen used to join its points with straight lines and nothing else; a
 * curve had to be made afterwards with the Node tool. These are the pure
 * pieces the drawing tools are made of: a run of anchors with optional bezier
 * handles becomes a `d`, a centre and a radius become a polygon or a star, and
 * a pointer is constrained to an angle or snapped to a grid. No DOM here, so
 * every one of them is unit-tested with numbers.
 */

const round = (value, precision) => {
  const factor = 10 ** precision;
  const rounded = Math.round(Number(value) * factor) / factor;
  return Object.is(rounded, -0) ? 0 : rounded;
};
const point = (source) => ({ x: Number(source?.x) || 0, y: Number(source?.y) || 0 });

/**
 * @typedef {object} Anchor
 * @property {number} x
 * @property {number} y
 * @property {{x: number, y: number}|null} [in]   the handle arriving at the anchor
 * @property {{x: number, y: number}|null} [out]  the handle leaving it
 */

/**
 * The `d` for a run of anchors.
 *
 * A segment between two anchors is a straight line when neither end has a
 * handle on that side, and a cubic otherwise — a missing handle is the anchor
 * itself, which is how one-sided curves come out right.
 *
 * @param {Anchor[]} anchors
 * @param {{ close?: boolean, precision?: number }} [options]
 */
export function anchorsToPath(anchors, { close = false, precision = 2 } = {}) {
  const list = (anchors || []).map((anchor) => ({ ...point(anchor), in: anchor.in ? point(anchor.in) : null, out: anchor.out ? point(anchor.out) : null }));
  if (!list.length) return '';
  const fmt = (value) => round(value, precision);
  const segment = (from, to) => (!from.out && !to.in
    ? `L ${fmt(to.x)} ${fmt(to.y)}`
    : `C ${fmt((from.out || from).x)} ${fmt((from.out || from).y)} ${fmt((to.in || to).x)} ${fmt((to.in || to).y)} ${fmt(to.x)} ${fmt(to.y)}`);
  const parts = [`M ${fmt(list[0].x)} ${fmt(list[0].y)}`];
  for (let index = 1; index < list.length; index += 1) parts.push(segment(list[index - 1], list[index]));
  if (close && list.length > 2) {
    const last = list.at(-1), first = list[0];
    // The closing segment is straight unless a handle reaches across it, in
    // which case it is drawn out so `Z` has nothing left to bend.
    if (last.out || first.in) parts.push(segment(last, first));
    parts.push('Z');
  }
  return parts.join(' ');
}

/** `M a L b`: the Line tool. */
export function linePath(a, b, precision = 2) {
  const from = point(a), to = point(b);
  return `M ${round(from.x, precision)} ${round(from.y, precision)} L ${round(to.x, precision)} ${round(to.y, precision)}`;
}

/**
 * A regular polygon, or a star, around a centre.
 *
 * @param {{x: number, y: number}} center
 * @param {number} radius            to the outer points
 * @param {number} sides             3 or more
 * @param {{ star?: boolean, inner?: number, rotation?: number, precision?: number }} [options]
 *        `inner` is the star's inner radius as a fraction of `radius`;
 *        `rotation` in degrees, with the first point straight up by default.
 */
export function polygonPath(center, radius, sides, { star = false, inner = 0.5, rotation = -90, precision = 2 } = {}) {
  const at = point(center), r = Math.abs(Number(radius) || 0), n = Math.max(3, Math.round(Number(sides) || 3));
  if (!r) return '';
  const count = star ? n * 2 : n;
  const innerRadius = r * Math.min(0.95, Math.max(0.05, Number(inner) || 0.5));
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const angle = ((Number(rotation) || 0) + (360 / count) * index) * (Math.PI / 180);
    const length = star && index % 2 ? innerRadius : r;
    points.push({ x: round(at.x + Math.cos(angle) * length, precision), y: round(at.y + Math.sin(angle) * length, precision) });
  }
  return `${points.map((item, index) => `${index ? 'L' : 'M'} ${item.x} ${item.y}`).join(' ')} Z`;
}

/**
 * The angle of `from → to`, snapped to the nearest multiple of `step` degrees,
 * with the same length: what Shift does to a line or a pen segment.
 */
export function constrainAngle(from, to, step = 45) {
  const a = point(from), b = point(to);
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (!length) return { ...b };
  const size = (Math.abs(Number(step)) || 45) * (Math.PI / 180);
  const angle = Math.round(Math.atan2(dy, dx) / size) * size;
  return { x: a.x + Math.cos(angle) * length, y: a.y + Math.sin(angle) * length };
}

/** A point on the nearest grid crossing. A size of zero is no grid. */
export function snapToGrid(source, size) {
  const step = Math.abs(Number(size)) || 0;
  const p = point(source);
  if (!step) return p;
  return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
}

/**
 * The box two corners make, with Shift squaring it (from the first corner)
 * and Alt growing it out from the centre — the modifiers every shape tool has.
 */
export function shapeBox(a, b, { square = false, fromCenter = false } = {}) {
  const from = point(a), to = point(b);
  let dx = to.x - from.x, dy = to.y - from.y;
  if (square) {
    const size = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * size; dy = Math.sign(dy || 1) * size;
  }
  if (fromCenter) return { x: from.x - Math.abs(dx), y: from.y - Math.abs(dy), width: Math.abs(dx) * 2, height: Math.abs(dy) * 2 };
  return { x: Math.min(from.x, from.x + dx), y: Math.min(from.y, from.y + dy), width: Math.abs(dx), height: Math.abs(dy) };
}

/** The mirror of a handle through its anchor, keeping the length. */
export function mirrorHandle(anchor, handle) {
  const a = point(anchor), h = point(handle);
  return { x: a.x * 2 - h.x, y: a.y * 2 - h.y };
}
