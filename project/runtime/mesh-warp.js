/**
 * Deforming a picture, with the renderer this editor already has.
 *
 * The plan left the implementation open on purpose (docs/V4_ROADMAP.md,
 * V4-071) and the measurement answered it: a mesh is drawn as triangles of
 * the *same* picture, each clipped to its own triangle and carrying the affine
 * transform that maps its rest triangle onto its moved one. That is ordinary
 * SVG. It needs no WebGL context, no second renderer, no texture upload, and
 * no second answer to any of the questions this codebase has already
 * answered -- the sanitizer, the serializer, the asset resolver and undo all
 * keep working because nothing new is being drawn, only more of what is.
 *
 * The cost is a seam between triangles, which is why `MESH_OVERDRAW` exists.
 *
 * The maths lives in the runtime because an exported mascot deforms exactly as
 * the editor does, and two answers would drift.
 */

/** Vertices per side. Nine points, or sixteen: enough to bend, few enough to drag. */
export const MESH_PRESETS = Object.freeze([3, 4]);
export const DEFAULT_MESH_SIZE = 3;

/**
 * Triangles are clipped to their own edges, and two clips meeting exactly on a
 * line leave a hairline of background between them wherever the rasteriser
 * rounds the two sides the same way. Each clip is grown by a hair so the
 * neighbours overlap instead of meeting; the overlap is invisible because both
 * sides are drawing the same picture in the same place.
 */
export const MESH_OVERDRAW = 0.35;

/** The rest grid, in unit space: `{ x, y }` from 0 to 1, row by row. */
export function meshRestPoints(size = DEFAULT_MESH_SIZE) {
  const side = Math.max(2, Math.round(Number(size) || DEFAULT_MESH_SIZE));
  const points = [];
  for (let row = 0; row < side; row += 1) for (let column = 0; column < side; column += 1)
    points.push({ x: column / (side - 1), y: row / (side - 1) });
  return points;
}

/**
 * Which three points make each triangle, as indices into the grid.
 *
 * Two per cell, split along the same diagonal every time. A consistent
 * diagonal matters: alternating it makes a deformation fold differently in
 * neighbouring cells, which reads as a crease nobody put there.
 */
export function meshTriangles(size = DEFAULT_MESH_SIZE) {
  const side = Math.max(2, Math.round(Number(size) || DEFAULT_MESH_SIZE));
  const at = (column, row) => row * side + column;
  const triangles = [];
  for (let row = 0; row < side - 1; row += 1) for (let column = 0; column < side - 1; column += 1) {
    triangles.push([at(column, row), at(column + 1, row), at(column, row + 1)]);
    triangles.push([at(column + 1, row), at(column + 1, row + 1), at(column, row + 1)]);
  }
  return triangles;
}

/**
 * The affine that carries one triangle onto another.
 *
 * Three points determine an affine map exactly, which is the whole reason a
 * mesh is drawn as triangles rather than as quads: a quad needs a projective
 * transform, and SVG has no way to express one.
 *
 * @returns {number[]|null} `[a, b, c, d, e, f]`, or null for a degenerate rest triangle
 */
export function triangleTransform(from, to) {
  const [p0, p1, p2] = from, [q0, q1, q2] = to;
  const u1 = p1.x - p0.x, v1 = p1.y - p0.y, u2 = p2.x - p0.x, v2 = p2.y - p0.y;
  const determinant = u1 * v2 - u2 * v1;
  // A rest triangle with no area has no inverse: there is no map from a line
  // onto a triangle, and pretending otherwise writes NaN into the artwork.
  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-12) return null;
  const x1 = q1.x - q0.x, y1 = q1.y - q0.y, x2 = q2.x - q0.x, y2 = q2.y - q0.y;
  const a = (x1 * v2 - x2 * v1) / determinant;
  const b = (y1 * v2 - y2 * v1) / determinant;
  const c = (x2 * u1 - x1 * u2) / determinant;
  const d = (y2 * u1 - y1 * u2) / determinant;
  return [a, b, c, d, q0.x - a * p0.x - c * p0.y, q0.y - b * p0.x - d * p0.y];
}

/**
 * Each corner pushed a fixed distance away from the triangle's centre, so
 * neighbours overlap rather than meet.
 *
 * A fixed distance and not a scale, because the seam to cover is a hairline
 * whatever the triangle's size: scaling would grow a big triangle by pixels
 * and a small one by nothing. The centre shifts very slightly as a result --
 * three unit vectors only cancel for an equilateral triangle -- which is
 * invisible at this magnitude and is the price of a constant overlap.
 */
export function growTriangle(points, by = MESH_OVERDRAW) {
  const cx = (points[0].x + points[1].x + points[2].x) / 3;
  const cy = (points[0].y + points[1].y + points[2].y) / 3;
  return points.map((point) => {
    const dx = point.x - cx, dy = point.y - cy;
    const length = Math.hypot(dx, dy) || 1;
    return { x: point.x + (dx / length) * by, y: point.y + (dy / length) * by };
  });
}

/**
 * Everything needed to draw one deformed picture, as data.
 *
 * Deliberately not markup. The editor and the runtime draw into different
 * places and at different moments, and a shape they can both read is what
 * keeps the maths in one file and the drawing in two.
 *
 * @param {{ size: number, points: {x: number, y: number}[] }} mesh moved points, unit space
 * @param {{ x: number, y: number, width: number, height: number }} box the picture's own box
 * @returns {{ index: number, clip: {x: number, y: number}[], transform: number[] }[]}
 */
export function meshPieces(mesh, box, { overdraw = MESH_OVERDRAW } = {}) {
  const size = Math.max(2, Math.round(Number(mesh?.size) || DEFAULT_MESH_SIZE));
  const rest = meshRestPoints(size);
  const moved = Array.isArray(mesh?.points) && mesh.points.length === rest.length ? mesh.points : rest;
  const toBox = (point) => ({ x: box.x + point.x * box.width, y: box.y + point.y * box.height });
  const pieces = [];
  meshTriangles(size).forEach((corners, index) => {
    const from = corners.map((corner) => toBox(rest[corner]));
    const to = corners.map((corner) => toBox(moved[corner] ?? rest[corner]));
    const transform = triangleTransform(from, to);
    if (!transform) return;
    pieces.push({ index, clip: growTriangle(to, overdraw), transform });
  });
  return pieces;
}

/**
 * The meshes a rig carries, one per piece that deforms.
 *
 * Shaped like `warps` and `shapeKeys` beside it, and additive in the same way:
 * a runtime that does not know about meshes draws every picture at rest, which
 * is the picture undeformed rather than the picture wrong. That is why this
 * does not move `RIG_SCHEMA_VERSION` (docs/V4_ROADMAP.md).
 *
 * A mesh whose point count does not match its size is dropped rather than
 * padded: a half-read mesh is a deformation nobody authored, and drawing one
 * is worse than drawing none.
 */
const readPoints = (candidate, size) => {
  const points = Array.isArray(candidate) ? candidate : null;
  if (!points || points.length !== size * size) return null;
  const moved = points.map((point) => ({ x: Number(point?.x), y: Number(point?.y) }));
  return moved.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y)) ? null : moved;
};

/**
 * What decides how far between the two shapes a mesh is.
 *
 * The same shape as a shape key's driver (`runtime/shape-keys.js`), on
 * purpose: an author who has learned that `mouthOpen` from 0 to 1 drives a
 * mouth's outline should not have to learn a second vocabulary to drive the
 * picture of one.
 */
const readDriver = (candidate) => {
  const parameter = typeof candidate?.parameter === 'string' ? candidate.parameter.trim() : '';
  if (!parameter) return null;
  const min = Number(candidate.min), max = Number(candidate.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) return null;
  return Object.freeze({ parameter, min, max, clamp: candidate.clamp !== false });
};

export function normalizeMeshes(source = {}) {
  const list = Array.isArray(source?.meshes) ? source.meshes : [];
  const out = [];
  for (const candidate of list) {
    const target = typeof candidate?.target === 'string' ? candidate.target.trim() : '';
    const size = Math.round(Number(candidate?.size));
    if (!target || !MESH_PRESETS.includes(size)) continue;
    const moved = readPoints(candidate.points, size);
    if (!moved) continue;
    // The shape the driver moves *to*. Without one a mesh is a single pose,
    // which is most of them: a picture bent once and left bent.
    const driver = readDriver(candidate.driver);
    const to = driver ? readPoints(candidate.to, size) : null;
    out.push(Object.freeze({
      id: typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id.trim() : `mesh-${target}`,
      target, size, points: Object.freeze(moved),
      driver: to ? driver : null,
      to: to ? Object.freeze(to) : null
    }));
  }
  return Object.freeze(out);
}

/**
 * How far along its driver a mesh is, from 0 to 1.
 *
 * Clamped by default, because a mesh is two shapes and a weight outside them
 * is a shape nobody drew: `mouthOpen` at 3 should be a mouth as open as it
 * gets, not a mouth turned inside out.
 */
export function meshWeight(mesh, values = {}) {
  if (!mesh?.driver) return 0;
  const { parameter, min, max, clamp } = mesh.driver;
  const raw = Number(values?.[parameter]);
  if (!Number.isFinite(raw)) return 0;
  const t = (raw - min) / (max - min);
  return clamp ? Math.max(0, Math.min(1, t)) : t;
}

/**
 * The points a mesh is at right now.
 *
 * Returns the authored array itself when nothing is driving it, so an idle
 * mascot allocates nothing per frame -- the same bargain `evaluateShapeTarget`
 * makes for paths.
 */
export function meshPointsAt(mesh, values = {}) {
  if (!mesh?.driver || !mesh.to) return mesh?.points || [];
  const weight = meshWeight(mesh, values);
  if (weight === 0) return mesh.points;
  if (weight === 1) return mesh.to;
  return mesh.points.map((point, index) => ({
    x: point.x + (mesh.to[index].x - point.x) * weight,
    y: point.y + (mesh.to[index].y - point.y) * weight
  }));
}

/** The mesh deforming a piece, or null. */
export const meshFor = (meshes, target) => (Array.isArray(meshes) ? meshes.find((mesh) => mesh.target === target) : null) || null;

/** Whether a mesh is doing anything at all, or is still the grid it started as. */
export function meshIsRest(mesh) {
  if (!mesh) return true;
  const rest = meshRestPoints(mesh.size);
  return mesh.points.every((point, index) => Math.abs(point.x - rest[index].x) < 1e-6 && Math.abs(point.y - rest[index].y) < 1e-6);
}

/** A fresh, undeformed mesh for a piece. */
export const restMesh = (target, size = DEFAULT_MESH_SIZE) => ({ id: `mesh-${target}`, target, size, points: meshRestPoints(size) });

const escapeAttribute = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const round = (value) => Math.round(value * 1000) / 1000;
const pointsAttribute = (points) => points.map((point) => `${round(point.x)},${round(point.y)}`).join(' ');

/** The id a mesh piece's clip is kept under, so a rebuild reuses them rather than piling them up. */
export const meshClipId = (target, index) => `mesh-${target}-${index}`;

/**
 * A deformed picture, as markup: one group, one clipped copy per triangle.
 *
 * The group keeps the piece's own id, so everything above it is unchanged --
 * the rig binds to it, the turn carries it, the depth sorts it and the layer
 * list names it, none of which asked what is inside. What *is* inside is
 * eight or eighteen copies of the same `<image>`, each clipped to one triangle
 * and carrying the affine that maps its rest triangle onto its moved one.
 *
 * It is plain SVG, which is the point: an exported mascot draws a deformed
 * picture with no code of ours running at all.
 *
 * @returns {{ markup: string, defs: string }} the group, and the clips it needs in `<defs>`
 */
export function meshMarkup(mesh, { target, reference, box, attributes = '' }) {
  const pieces = meshPieces(mesh, box);
  if (!pieces.length) return { markup: '', defs: '' };
  const image = (transform) => `<image href="${escapeAttribute(reference)}" x="${round(box.x)}" y="${round(box.y)}" width="${round(box.width)}" height="${round(box.height)}" preserveAspectRatio="none" transform="matrix(${transform.map(round).join(' ')})"/>`;
  const defs = pieces.map((piece) => `<clipPath id="${escapeAttribute(meshClipId(target, piece.index))}" clipPathUnits="userSpaceOnUse"><polygon points="${pointsAttribute(piece.clip)}"/></clipPath>`).join('');
  const body = pieces.map((piece) => `<g clip-path="url(#${escapeAttribute(meshClipId(target, piece.index))})">${image(piece.transform)}</g>`).join('');
  return {
    markup: `<g id="${escapeAttribute(target)}" data-mesh="${mesh.size}"${attributes ? ` ${attributes}` : ''}>${body}</g>`,
    defs
  };
}

/**
 * `preserveAspectRatio="none"` on every piece, and it matters.
 *
 * A mesh stretches; the default would letterbox each triangle's copy inside
 * its own box and the pieces would stop lining up with each other, which is a
 * seam that no amount of overdraw covers.
 */
export const MESH_PRESERVE_ASPECT_RATIO = 'none';

/**
 * Write a mesh's current shape onto the triangles already in a document.
 *
 * The per-frame half, and it is deliberately small: the nodes exist, so a
 * frame is `N` transform writes and `N` polygon writes, where `N` is eight or
 * eighteen. Nothing is created, nothing is parsed and nothing is measured.
 *
 * Shared by the editor's canvas and by an exported mascot, because a
 * deformation that looked different in the two would be worse than one that
 * did not work at all.
 *
 * @param {Element} root the `<svg>`, or anything above the mesh groups
 * @param {object[]} meshes the rig's meshes
 * @param {object} values the parameter values this frame
 * @param {{ skip?: string|null }} [options] a piece the pointer owns
 * @returns {number} how many meshes were written
 */
export function applyMeshesToDom(root, meshes = [], values = {}, { skip = null } = {}) {
  if (!root?.querySelector || !Array.isArray(meshes)) return 0;
  let written = 0;
  for (const mesh of meshes) {
    if (!mesh?.driver || mesh.target === skip) continue;
    const group = root.querySelector(`#${cssEscape(mesh.target)}`);
    const image = group?.querySelector?.('image');
    if (!image) continue;
    const side = (name) => Number(image.getAttribute(name)) || 0;
    const box = { x: side('x'), y: side('y'), width: side('width'), height: side('height') };
    if (!(box.width > 0) || !(box.height > 0)) continue;
    const cells = [...group.children];
    meshPieces({ size: mesh.size, points: meshPointsAt(mesh, values) }, box).forEach((piece, index) => {
      const cell = cells[index];
      const picture = cell?.querySelector?.('image');
      if (picture) picture.setAttribute('transform', `matrix(${piece.transform.map(round).join(' ')})`);
      const reference = /url\(['"]?#([^)'"]+)['"]?\)/.exec(cell?.getAttribute?.('clip-path') || '')?.[1];
      const polygon = reference ? root.querySelector(`#${cssEscape(reference)} > polygon`) : null;
      if (polygon) polygon.setAttribute('points', pointsAttribute(piece.clip));
    });
    written += 1;
  }
  return written;
}

/** `CSS.escape` where there is one, and the ids this editor writes where there is not. */
const cssEscape = (value) => (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&'));
