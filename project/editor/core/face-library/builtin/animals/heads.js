/**
 * Animal skulls: a fur silhouette each, with nothing on it.
 *
 * "6 formes de base sans oreilles, museau, nez ni bouche" — the parts sheet's
 * own caption, and the shape the rest of this library already has. A head here
 * is a coat outline and a jaw pose; the ears go on top of it, the muzzle in
 * front of it, and every feature is its own piece.
 *
 * Drawn where the human skulls are drawn — the face's middle at 120, 116 — so
 * an animal head and a person's head fit the same face at the same size, and a
 * library part lands on either (docs/FACE_ASSET_AUTHORING.md).
 */
import { JAW_DROP } from '../heads.js';
import { furBox, furPath } from './shapes.js';

const SKIN = '#f9d9b0', LINE = '#a4674a';

const head = (slug, name, description, geometry) => {
  const draw = (drop) => furPath(geometry.cx, geometry.cy, geometry.rx, geometry.ry, geometry, drop);
  return Object.freeze({
    id: `head.${slug}`, category: 'head', name, description, origin: 'builtin',
    artwork: `<g id="head-${slug}" data-name="Head"><path id="skull" data-name="Skull" d="${draw(0)}" fill="${SKIN}" stroke="${LINE}" stroke-width="4" stroke-linejoin="round" /></g>`,
    roles: Object.freeze({ head: 'skull' }),
    capabilities: Object.freeze(['headX', 'headY', 'headTilt']),
    // The jaw takes the skull, as it does on a person: the pose is the same
    // coat outline with its chin dropped.
    parts: Object.freeze({ jaw: Object.freeze({ roles: Object.freeze({}), capabilities: Object.freeze(['jawOpen']), drivers: Object.freeze({ jawOpen: Object.freeze({ property: 'shapeKey', posePath: draw(JAW_DROP) }) }) }) }),
    paletteRoles: Object.freeze({ skull: Object.freeze({ fill: 'skin', stroke: 'outline' }) }),
    referenceBox: Object.freeze(furBox(geometry.cx, geometry.cy, geometry.rx, geometry.ry, geometry)),
    mountPoint: 'head.center',
    palette: Object.freeze(['skin', 'outline']),
    slot: 'head', morphologies: Object.freeze(['muzzle']), tags: Object.freeze(['animal', ...geometry.tags])
  });
};

/**
 * The six silhouettes, and what each of the three numbers is doing.
 *
 * A coat outline is a superellipse with a wobble on it, so the same three
 * knobs the human skulls use say all of these too:
 *
 * ```text
 * lean    where the width sits: + is heavy at the jaw, - heavy at the brow
 * crown   how square the top is: 2 is a circle's shoulder, 3+ is a flat brow
 * jaw     how square the bottom is: 2 is a round chin, 3+ turns a corner
 * ```
 *
 * and `tufts` with `depth` say how the coat reads at the edge: many shallow
 * tufts are a short soft coat, few deep ones are a shaggy or a spiked one.
 */
export const HEAD_ANIMAL_ROUND = head('animal-round', 'Animal round', 'A round animal skull with a soft fur edge.',
  { cx: 120, cy: 116, rx: 92, ry: 90, tufts: 34, depth: 0.012, crown: 2, jaw: 2.15, tags: ['round', 'soft'] });

/** Narrow: longer and lighter in the lower face, for a fox or a wolf. */
export const HEAD_ANIMAL_NARROW = head('animal-narrow', 'Animal narrow', 'A narrower animal skull, longer in the face.',
  { cx: 120, cy: 116, rx: 80, ry: 94, tufts: 30, depth: 0.014, lean: 0.05, crown: 2.15, jaw: 2.5, tags: ['narrow', 'sharp'] });

/** Wide: the only one broader than it is tall, and the heaviest coat. */
export const HEAD_ANIMAL_WIDE = head('animal-wide', 'Animal wide', 'A broad, heavy animal skull, wider than it is tall.',
  { cx: 120, cy: 116, rx: 98, ry: 84, tufts: 30, depth: 0.018, crown: 2.05, jaw: 2.3, tags: ['wide', 'heavy'] });

/**
 * Square: a flat brow over a jaw that turns a corner, and a coat of fewer,
 * deeper tufts so the crown reads spiked rather than round.
 */
export const HEAD_ANIMAL_SQUARE = head('animal-square', 'Animal square', 'A squared skull with soft corners and a spiked crown.',
  { cx: 120, cy: 116, rx: 86, ry: 92, tufts: 27, depth: 0.019, crown: 3.1, jaw: 3, tags: ['square', 'angular'] });

/** Small: the smallest of the six, and the plainest edge on any of them. */
export const HEAD_ANIMAL_SMALL = head('animal-small', 'Animal small', 'A small, neat skull with a light tufted edge.',
  { cx: 120, cy: 116, rx: 76, ry: 82, tufts: 26, depth: 0.007, crown: 2, jaw: 2.1, tags: ['small', 'neat'] });

/** Chubby: the only one that widens towards the jaw rather than the brow. */
export const HEAD_ANIMAL_CHUBBY = head('animal-chubby', 'Animal chubby', 'Full cheeks, widest at the jaw.',
  { cx: 120, cy: 116, rx: 86, ry: 88, tufts: 32, depth: 0.013, lean: 0.17, crown: 2.1, jaw: 2.45, tags: ['chubby', 'friendly'] });

export const ANIMAL_HEADS = Object.freeze([
  HEAD_ANIMAL_ROUND, HEAD_ANIMAL_NARROW, HEAD_ANIMAL_WIDE, HEAD_ANIMAL_SQUARE, HEAD_ANIMAL_SMALL, HEAD_ANIMAL_CHUBBY
]);
