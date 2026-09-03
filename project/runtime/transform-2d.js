/**
 * The 2D transform every part of Boop agrees on.
 *
 * An element's transform is written to the DOM as
 *
 * ```text
 * translate(x y) rotate(r px py) translate(px py) scale(sx sy) translate(-px -py)
 * ```
 *
 * so mapping a point is: scale about the pivot, rotate about the pivot,
 * translate. Both directions live here because the runtime needs the forward
 * map (hand anchors) and the editor needs the inverse (turning a pointer
 * position into element coordinates).
 */
import { finite } from './numeric.js';

/** Point → world, matching the renderer's transform string exactly. */
export function applyElementTransform(transform, point) {
  const t = transform || {};
  const pivotX = finite(t.pivotX, 0);
  const pivotY = finite(t.pivotY, 0);
  const scaled = {
    x: (finite(point?.x, 0) - pivotX) * finite(t.scaleX, 1) + pivotX,
    y: (finite(point?.y, 0) - pivotY) * finite(t.scaleY, 1) + pivotY
  };
  const rotated = rotateAround(scaled, { x: pivotX, y: pivotY }, finite(t.rotation, 0));
  return { x: rotated.x + finite(t.x, 0), y: rotated.y + finite(t.y, 0) };
}

/**
 * World → the space the element is in *after* scaling but before rotation and
 * translation. This is the space a scale drag has to reason in: the pivot and
 * the handles are still at their scaled positions.
 */
export function unrotateElementPoint(transform, point) {
  const t = transform || {};
  const pivot = { x: finite(t.pivotX, 0), y: finite(t.pivotY, 0) };
  const moved = { x: finite(point?.x, 0) - finite(t.x, 0), y: finite(point?.y, 0) - finite(t.y, 0) };
  return rotateAround(moved, pivot, -finite(t.rotation, 0));
}

/** World → the element's own untransformed coordinates. */
export function inverseElementTransform(transform, point) {
  const t = transform || {};
  const pivotX = finite(t.pivotX, 0);
  const pivotY = finite(t.pivotY, 0);
  const scaleX = finite(t.scaleX, 1) || 1;
  const scaleY = finite(t.scaleY, 1) || 1;
  const unrotated = unrotateElementPoint(t, point);
  return {
    x: (unrotated.x - pivotX) / scaleX + pivotX,
    y: (unrotated.y - pivotY) / scaleY + pivotY
  };
}

export function rotateAround(point, pivot, degrees) {
  const radians = (finite(degrees, 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = finite(point?.x, 0) - finite(pivot?.x, 0);
  const dy = finite(point?.y, 0) - finite(pivot?.y, 0);
  return { x: finite(pivot?.x, 0) + dx * cos - dy * sin, y: finite(pivot?.y, 0) + dx * sin + dy * cos };
}

/** Degrees from `from` to `to` measured around `pivot`, in SVG's y-down space. */
export function angleAround(pivot, from, to) {
  const a = Math.atan2(finite(from?.y, 0) - finite(pivot?.y, 0), finite(from?.x, 0) - finite(pivot?.x, 0));
  const b = Math.atan2(finite(to?.y, 0) - finite(pivot?.y, 0), finite(to?.x, 0) - finite(pivot?.x, 0));
  return ((b - a) * 180) / Math.PI;
}
