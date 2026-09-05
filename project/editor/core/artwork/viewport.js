/**
 * Where the artwork's own units land on the canvas (docs/VECTOR_EDITING.md).
 *
 * The artwork is a nested `<svg>` with a `viewBox`, drawn inside a group that
 * carries the zoom and pan. Everything chrome draws in artwork units — the
 * shape being drawn, the artboard edge, the grid — needs the matrix from those
 * units to the canvas, and every pointer needs its inverse.
 *
 * The canvas used to ask the browser for that matrix (`getScreenCTM()` on the
 * nested `<svg>`) once, at the start of a gesture. Two things were wrong with
 * that: the answer went stale the moment the view moved mid-gesture (a wheel
 * pan while drawing left the preview a hundred pixels from the shape it
 * became), and nested-`<svg>` CTMs are the one place browsers have disagreed
 * for years. So it is computed here, from the SVG specification's own rule
 * for `viewBox` + `preserveAspectRatio`, and recomputed whenever the view
 * changes. Pure: numbers in, a matrix out.
 *
 * A matrix is `{ a, b, c, d, e, f }`, the SVG convention: `x' = a·x + c·y + e`,
 * `y' = b·x + d·y + f`.
 */

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

export const IDENTITY = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

/** `m1 × m2`: apply `m2` first, then `m1` — the order `getCTM()` composes in. */
export function multiplyMatrix(m1, m2) {
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f
  };
}

export function invertMatrix(m) {
  const det = m.a * m.d - m.b * m.c;
  if (!det || !Number.isFinite(det)) return null;
  return {
    a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det, f: (m.b * m.e - m.a * m.f) / det
  };
}

export function applyMatrix(m, point) {
  const x = number(point?.x), y = number(point?.y);
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

/** How much a matrix scales lengths, for handles that keep a screen size. */
export const matrixScale = (m) => Math.hypot(number(m?.a, 1), number(m?.b)) || 1;

export const matrixToString = (m) => `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;

/** `viewBox="x y w h"` → numbers, or null when there is no usable box. */
export function parseViewBox(value) {
  const parts = String(value ?? '').trim().split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part)) || parts[2] <= 0 || parts[3] <= 0) return null;
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

/**
 * An SVG length attribute in pixels. A percentage is of the viewport; an
 * absent or unreadable value is the whole viewport, which is what a nested
 * `<svg>` without `width` / `height` occupies.
 */
export function resolveLength(value, reference) {
  const text = String(value ?? '').trim();
  if (!text) return number(reference);
  if (text.endsWith('%')) return (number(text.slice(0, -1)) / 100) * number(reference);
  const parsed = Number.parseFloat(text);
  return Number.isFinite(parsed) ? parsed : number(reference);
}

const ALIGN = { min: 0, mid: 0.5, max: 1 };

/**
 * The matrix from a nested `<svg>`'s user units to its parent's units.
 *
 * @param {{ viewBox?: string, width?: string|number, height?: string|number, x?: string|number, y?: string|number, preserveAspectRatio?: string }} attrs
 * @param {{ width: number, height: number }} viewport  the parent viewport, in its own units
 */
export function viewBoxTransform(attrs = {}, viewport = { width: 0, height: 0 }) {
  const ex = resolveLength(attrs.x, 0) || 0, ey = resolveLength(attrs.y, 0) || 0;
  const ew = resolveLength(attrs.width, viewport.width), eh = resolveLength(attrs.height, viewport.height);
  const box = parseViewBox(attrs.viewBox);
  if (!box) return { a: 1, b: 0, c: 0, d: 1, e: ex, f: ey };
  const spec = String(attrs.preserveAspectRatio ?? 'xMidYMid meet').trim().split(/\s+/);
  const align = spec[0] || 'xMidYMid';
  let sx = ew / box.width, sy = eh / box.height;
  let tx = ex, ty = ey;
  if (align !== 'none') {
    const slice = spec[1] === 'slice';
    const scale = slice ? Math.max(sx, sy) : Math.min(sx, sy);
    sx = scale; sy = scale;
    const ax = ALIGN[/^x(min|mid|max)/i.exec(align)?.[1]?.toLowerCase()] ?? 0.5;
    const ay = ALIGN[/y(min|mid|max)/i.exec(align)?.[1]?.toLowerCase()] ?? 0.5;
    tx += (ew - box.width * scale) * ax;
    ty += (eh - box.height * scale) * ay;
  }
  return { a: sx, b: 0, c: 0, d: sy, e: tx - box.x * sx, f: ty - box.y * sy };
}

/** The attributes `viewBoxTransform` reads, taken off a DOM element. */
export function viewBoxAttributes(element) {
  const read = (name) => (element?.getAttribute ? element.getAttribute(name) : undefined) ?? undefined;
  return { viewBox: read('viewBox'), width: read('width'), height: read('height'), x: read('x'), y: read('y'), preserveAspectRatio: read('preserveAspectRatio') };
}
