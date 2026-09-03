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

/* ── Matrices ────────────────────────────────────────────────────────────── */

/**
 * `[a, b, c, d, e, f]`, the same six numbers SVG's `matrix()` takes. The
 * transform hierarchy composes in matrices because a parent's rotation and
 * scale do not survive being decomposed back into a child's channels.
 */
export const IDENTITY_MATRIX = Object.freeze([1, 0, 0, 1, 0, 0]);

export function transformToMatrix(transform) {
  const t = transform || {};
  const pivotX = finite(t.pivotX, 0);
  const pivotY = finite(t.pivotY, 0);
  const scaleX = finite(t.scaleX, 1);
  const scaleY = finite(t.scaleY, 1);
  const radians = (finite(t.rotation, 0) * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  // translate(x y) · rotate(r, pivot) · scale(s, pivot)
  const a = cos * scaleX;
  const b = sin * scaleX;
  const c = -sin * scaleY;
  const d = cos * scaleY;
  const e = finite(t.x, 0) + pivotX - (a * pivotX + c * pivotY);
  const f = finite(t.y, 0) + pivotY - (b * pivotX + d * pivotY);
  return [a, b, c, d, e, f];
}

/** `outer ∘ inner`: apply `inner` first, then `outer`. */
export function multiplyMatrix(outer, inner) {
  const [a1, b1, c1, d1, e1, f1] = outer;
  const [a2, b2, c2, d2, e2, f2] = inner;
  return [
    a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1
  ];
}

export function applyMatrix(matrix, point) {
  const [a, b, c, d, e, f] = matrix;
  const x = finite(point?.x, 0);
  const y = finite(point?.y, 0);
  return { x: a * x + c * y + e, y: b * x + d * y + f };
}

export function matrixToString(matrix, precision = 6) {
  const round = (value) => {
    const number = Math.round(finite(value, 0) * 10 ** precision) / 10 ** precision;
    return Object.is(number, -0) ? 0 : number;
  };
  return `matrix(${matrix.map(round).join(' ')})`;
}

export function isIdentityMatrix(matrix) {
  return matrix.every((value, index) => Math.abs(value - IDENTITY_MATRIX[index]) < 1e-9);
}
