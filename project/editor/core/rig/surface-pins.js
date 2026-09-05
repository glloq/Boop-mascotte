/**
 * Surface pins: the missing link between the 2.5D turn and a facial rig
 * (docs/FACE_CONTROL_RIG.md, CR-24, CR-49, CR-50).
 *
 * The generated turn moves each *part* of the face as a whole — the head
 * shifts and narrows, the features inside it travel further
 * (docs/HEAD_POSE_2_5D.md). That is enough for a face made of separate
 * drawings, and it is not enough for a **silhouette**: an outline that only
 * shifts and narrows is a card being turned, not a head. What is missing is
 * that the near cheek keeps its room while the far one compresses, that the
 * jaw swings, that the chin comes round.
 *
 * A surface pin is a point on the head's own logical surface:
 *
 * ```text
 *              top
 *        ╭──────●──────╮
 *   ●    │             │    ●     temple L / R
 *        │             │
 *   ●    │             │    ●     cheek L / R
 *        ╰──●───────●──╯          jaw L / R
 *              ●                  chin
 * ```
 *
 * Each carries `(u, v)` — where it sits on the head, as a fraction of the
 * head's own box — and a `virtualZ`, how far it stands towards the viewer.
 * The projector turns that volume and reports where each point landed, and the
 * pin holds the outline there.
 *
 * **The residual, not the movement.** The head element already translates and
 * narrows as a whole; a pin that also moved by the full projection would move
 * the point twice. So what is baked is what this point does *beyond* what its
 * own element already does to it — which is exactly the subtraction the turn
 * generator does on depths, done per point instead of per part.
 *
 * **Sampled, never solved.** The projector is trigonometry and must not run per
 * frame (`core/projection/pseudo-projector.js` says so in its own header). The
 * pin therefore carries the projection sampled over the head-pose grid, read
 * back by the same bilinear interpolation the head pose itself uses.
 */
import { boxCentre, projectFeature } from '../projection/pseudo-projector.js';
import { createHeadPoseAxes } from '../head-pose/head-pose-model.js';

/**
 * Where each silhouette pin sits, and how far it stands out.
 *
 * `u` / `v` are fractions of the head's own box, `z` is the virtual depth in
 * the same units the turn's layers use — the chin and the cheeks stand
 * furthest out, the temples sit near the axis and barely move, which is what
 * makes the near half travel further than the far half.
 *
 * `reach` is the radius as a fraction of the head's width: a cheek holds a
 * quarter of the face, a chin rather less.
 */
export const HEAD_SURFACE_PINS = Object.freeze([
  Object.freeze({ id: 'top', name: 'Top', u: 0.5, v: 0.04, z: 0.12, reach: 0.3, side: null }),
  Object.freeze({ id: 'temple-left', name: 'Left temple', u: 0.12, v: 0.3, z: 0.1, reach: 0.26, side: 'left' }),
  Object.freeze({ id: 'temple-right', name: 'Right temple', u: 0.88, v: 0.3, z: 0.1, reach: 0.26, side: 'right' }),
  Object.freeze({ id: 'cheek-left', name: 'Left cheek', u: 0.14, v: 0.62, z: 0.34, reach: 0.28, side: 'left' }),
  Object.freeze({ id: 'cheek-right', name: 'Right cheek', u: 0.86, v: 0.62, z: 0.34, reach: 0.28, side: 'right' }),
  Object.freeze({ id: 'jaw-left', name: 'Left jaw', u: 0.26, v: 0.87, z: 0.3, reach: 0.24, side: 'left' }),
  Object.freeze({ id: 'jaw-right', name: 'Right jaw', u: 0.74, v: 0.87, z: 0.3, reach: 0.24, side: 'right' }),
  Object.freeze({ id: 'chin', name: 'Chin', u: 0.5, v: 0.97, z: 0.5, reach: 0.26, side: null })
]);

/** The depth the head outline itself travels at, matching the turn's own layer. */
export const HEAD_OUTLINE_DEPTH = 0.18;

const finite = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/**
 * Where one point of the head ends up, beyond what the head element already
 * does to it.
 *
 * The element's own movement is a translation and a narrowing about the head's
 * centre; applying that to the point gives where the point would be with no
 * pin at all, and the difference is what the pin has to carry.
 *
 * @returns {{x:number, y:number}} in the artwork's own units
 */
export function surfacePinResidual(point, { box, depth, headX, headY, strength = 1, unit = 8, outlineDepth = HEAD_OUTLINE_DEPTH } = {}) {
  const centre = boxCentre(box);
  if (!centre) return { x: 0, y: 0 };
  const projected = projectFeature({ centre: point, originBox: box, depth, headX, headY, strength, unit });
  // What the outline as a whole does: the same projection at the outline's own
  // depth, plus the narrowing that comes with it.
  const outline = projectFeature({ centre, originBox: box, depth: outlineDepth, headX, headY, strength, unit });
  const carried = {
    x: centre.x + (point.x - centre.x) * finite(outline.scaleX, 1) + finite(outline.translateX, 0),
    y: centre.y + (point.y - centre.y) * finite(outline.scaleY, 1) + finite(outline.translateY, 0)
  };
  return {
    x: round(point.x + finite(projected.translateX, 0) - carried.x),
    y: round(point.y + finite(projected.translateY, 0) - carried.y)
  };
}

const round = (value) => Math.round(finite(value) * 1000) / 1000;

/**
 * Build the silhouette pins for one head, with their movement already sampled.
 *
 * @param {object} options
 * @param {string} options.target the element that draws the head outline
 * @param {{x,y,width,height}} options.box its box, in artwork units
 * @param {{x:number[], y:number[]}} [options.axes] the head-pose grid to sample over
 * @param {number} [options.unit] how far the deepest feature travels at a full turn
 * @returns {object[]} pin records, ready for `document.rigPins`
 */
export function generateSurfacePins({ target, box, axes = createHeadPoseAxes(), unit = 8, strength = 1, prefix = 'head' } = {}) {
  if (!target || !box?.width || !box?.height) return [];
  // The same grid the head pose itself is captured on, so a cell an author
  // re-poses by hand and a cell the projection filled in are the same cell.
  const columns = [...axes.x.values], rows = [...axes.y.values];
  return HEAD_SURFACE_PINS.map((spot) => {
    const point = { x: box.x + box.width * spot.u, y: box.y + box.height * spot.v };
    const sample = (headX, headY) => surfacePinResidual(point, { box, depth: spot.z, headX, headY, unit, strength });
    const x = rows.map((headY) => columns.map((headX) => sample(headX, headY).x));
    const y = rows.map((headY) => columns.map((headX) => sample(headX, headY).y));
    return {
      id: `${prefix}-${spot.id}`,
      target,
      type: 'surface',
      falloff: 'smooth',
      position: { x: round(point.x), y: round(point.y) },
      radius: round(box.width * spot.reach),
      strength: 1,
      surface: { u: spot.u, v: spot.v, z: spot.z },
      motion: {
        grid: {
          axes: [{ parameter: axes.x.parameter, values: columns }, { parameter: axes.y.parameter, values: rows }],
          x, y
        }
      }
    };
  });
}

/** Whether a project already carries the silhouette, so a panel can say so. */
export const hasSurfacePins = (document = {}, prefix = 'head') =>
  (document.rigPins || []).some((pin) => pin?.type === 'surface' && String(pin.id).startsWith(`${prefix}-`));

/** Take them away again, leaving every pin an author placed by hand. */
export const withoutSurfacePins = (document = {}, prefix = 'head') =>
  (document.rigPins || []).filter((pin) => !(pin?.type === 'surface' && String(pin.id).startsWith(`${prefix}-`)));
