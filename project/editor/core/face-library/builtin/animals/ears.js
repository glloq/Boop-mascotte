/**
 * Animal ears: a pair each, **on top of the skull**.
 *
 * The one geometric departure in the pilot. The three shipped pairs sit at the
 * sides of the head at y 118, where a person's ears are; all four of these sit
 * above the crown, which is where a cat's, a fox's, a dog's and a bear's are.
 *
 * That works because a fit keeps the **offset** from the anchor rather than the
 * anchor itself (docs/FACE_ASSET_AUTHORING.md): a pair drawn high stays high,
 * at the size of whatever head it meets. The `ears` anchor is still the right
 * one — it is the pair's own place on the face, and a face with no ears yet
 * keeps it in proportion to its skull.
 *
 * Drawn behind the head, as the shipped pairs are: the base of an ear tucks
 * under the coat and only what stands above the crown shows, which is what
 * makes an ear read as part of the animal rather than as a sticker.
 *
 * Each side is a group with its shape inside it, so an earring still has
 * somewhere to hang and the thing that wiggles is the thing that carries it.
 */
import { ovalPath, roundedTriangle } from './shapes.js';

const SKIN = '#f9d9b0', LINE = '#a4674a', INNER = '#e8a9a0';
const round = (value) => Math.round(value * 100) / 100;

/** Mirror a point across the face's middle: the two ears are exact mirrors. */
const at = (sign, offset) => round(120 + sign * offset);

const ears = (slug, name, description, draw, box, { tags, inner = true, tuft = false }) => Object.freeze({
  id: `ears.${slug}`, category: 'ears', name, description, origin: 'builtin',
  artwork: `<g id="ears-${slug}" data-name="Ears">`
    + `<g id="earLeft" data-name="Left ear">${draw(-1, 'Left')}</g>`
    + `<g id="earRight" data-name="Right ear">${draw(1, 'Right')}</g></g>`,
  roles: Object.freeze({ leftEar: 'earLeft', rightEar: 'earRight' }),
  capabilities: Object.freeze(['earWiggle']),
  // An ear stands off the head, so it sweeps round with the turn rather than
  // staying flat against it: the same reading the earring already declares.
  turn: Object.freeze({ leftEar: Object.freeze({ depth: 0.25, side: 'left', ear: true, sweeps: true }), rightEar: Object.freeze({ depth: 0.25, side: 'right', ear: true, sweeps: true }) }),
  paletteRoles: Object.freeze(Object.fromEntries(['Left', 'Right'].flatMap((side) => [
    [`ear${side}Shape`, Object.freeze({ fill: 'skin', stroke: 'outline' })],
    ...(tuft ? [[`ear${side}Tuft`, Object.freeze({ fill: 'skin', stroke: 'outline' })]] : []),
    ...(inner ? [[`ear${side}Inner`, Object.freeze({ fill: 'skinShadow' })]] : [])
  ]))),
  referenceBox: Object.freeze(box),
  mountPoint: 'ears',
  palette: Object.freeze(inner ? ['skin', 'outline', 'skinShadow'] : ['skin', 'outline']),
  slot: 'ears', morphologies: Object.freeze(['muzzle']), tags: Object.freeze(tags)
});

/**
 * A pointed ear: an outer triangle standing on the crown, with a smaller one
 * inside it. The base is wide and low enough to tuck under the coat, so the
 * ear grows out of the head rather than balancing on it.
 */
const pointed = ({ inner, outer, tip, base, rise }) => (sign, side) => {
  const shape = [[at(sign, tip), rise], [at(sign, outer), base - 12], [at(sign, inner), base]];
  const lining = [[at(sign, tip * 0.92 + inner * 0.08), rise + 16], [at(sign, outer - 12), base - 16], [at(sign, inner + 9), base - 6]];
  return `<path id="ear${side}Shape" data-name="${side} ear" d="${roundedTriangle(shape, 8)}" fill="${SKIN}" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round" />`
    + `<path id="ear${side}Inner" data-name="${side} inner ear" d="${roundedTriangle(lining, 6)}" fill="${INNER}" />`;
};

export const EARS_CAT_POINTED = ears('cat-pointed', 'Cat pointed', 'Two upright triangles with a pink inner ear.',
  pointed({ inner: 18, outer: 66, tip: 42, base: 66, rise: 10 }),
  { x: 54, y: 10, width: 132, height: 56 }, { tags: ['cat', 'feline', 'pointed'] });

export const EARS_FOX_LARGE_POINTED = ears('fox-large-pointed', 'Fox large pointed', 'Tall triangles, wide at the base and leaning out.',
  pointed({ inner: 16, outer: 74, tip: 50, base: 64, rise: -18 }),
  { x: 46, y: -18, width: 148, height: 82 }, { tags: ['fox', 'vulpine', 'pointed', 'large'] });

export const EARS_WOLF_POINTED = ears('wolf-pointed', 'Wolf pointed', 'Broad-based triangles, more upright than a fox\'s.',
  pointed({ inner: 18, outer: 70, tip: 44, base: 64, rise: -2 }),
  { x: 50, y: -2, width: 140, height: 66 }, { tags: ['wolf', 'canine', 'pointed'] });

/**
 * A folded ear: a long lobe from the top of the head, hanging down *outside*
 * the skull so it reads as an ear and not as a patch of coat.
 */
const folded = (sign, side) => {
  const x = (offset) => at(sign, offset);
  const shape = `M${x(48)} 52 C${x(86)} 42 ${x(114)} 68 ${x(116)} 108 C${x(118)} 148 ${x(100)} 176 ${x(78)} 170 C${x(58)} 164 ${x(50)} 118 ${x(48)} 52 Z`;
  const inner = `M${x(60)} 70 C${x(88)} 62 ${x(104)} 84 ${x(105)} 112 C${x(106)} 142 ${x(94)} 162 ${x(79)} 157 C${x(66)} 153 ${x(61)} 112 ${x(60)} 70 Z`;
  return `<path id="ear${side}Shape" data-name="${side} ear" d="${shape}" fill="${SKIN}" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round" />`
    + `<path id="ear${side}Inner" data-name="${side} inner ear" d="${inner}" fill="${INNER}" />`;
};

export const EARS_DOG_FOLDED = ears('dog-folded', 'Dog folded', 'Ears that fold over and hang down beside the head.',
  folded, { x: 4, y: 45, width: 232, height: 128 }, { tags: ['dog', 'canine', 'folded', 'floppy'] });

/** A round ear: a circle on the crown with a smaller one inside it. */
const rounded = ({ offset, radius, top }) => (sign, side) => {
  const cx = at(sign, offset);
  return `<circle id="ear${side}Shape" data-name="${side} ear" cx="${cx}" cy="${top + radius}" r="${radius}" fill="${SKIN}" stroke="${LINE}" stroke-width="3.5" />`
    + `<path id="ear${side}Inner" data-name="${side} inner ear" d="${ovalPath(cx, top + radius + 1, radius * 0.52, radius * 0.52)}" fill="${INNER}" />`;
};

export const EARS_BEAR_ROUND = ears('bear-round', 'Bear round', 'Two round ears set wide on top of the skull.',
  rounded({ offset: 60, radius: 28, top: 8 }),
  { x: 32, y: 8, width: 176, height: 56 }, { tags: ['bear', 'round', 'small'] });

/** A long ear: a tall rounded lobe, upright, with a pale inner strip. */
const long = (sign, side) => {
  const cx = at(sign, 36);
  return `<path id="ear${side}Shape" data-name="${side} ear" d="${ovalPath(cx, 16, 17, 52)}" fill="${SKIN}" stroke="${LINE}" stroke-width="3.5" />`
    + `<path id="ear${side}Inner" data-name="${side} inner ear" d="${ovalPath(cx, 18, 8.5, 39)}" fill="${INNER}" />`;
};

export const EARS_RABBIT_LONG = ears('rabbit-long', 'Rabbit long', 'Two long upright ears with a pale inner strip.',
  long, { x: 67, y: -36, width: 106, height: 104 }, { tags: ['rabbit', 'long', 'upright'] });

/**
 * The two pairs no species in the pilot asks for, and that the pilot draws
 * anyway: a parts library exists to be combined, and an author whose creature
 * is not one of the six needs somewhere to start.
 */

/** Small and plain: the only pair with no inner ear drawn. */
export const EARS_SMALL_ROUND = ears('small-round', 'Small round', 'Two small plain rounds, no inner ear.',
  (sign, side) => `<circle id="ear${side}Shape" data-name="${side} ear" cx="${at(sign, 56)}" cy="34" r="19" fill="${SKIN}" stroke="${LINE}" stroke-width="3.5" />`,
  { x: 45, y: 15, width: 150, height: 38 }, { tags: ['animal', 'small', 'round', 'plain'], inner: false });

/**
 * Tufted: a pointed ear with a tuft of fur breaking the tip -- a lynx, a
 * caracal, a squirrel. The tuft is part of the ear's own shape rather than a
 * piece on top of it, so it wiggles and turns with the ear.
 */
const tufted = (sign, side) => {
  const shape = [[at(sign, 44), 8], [at(sign, 68), 60], [at(sign, 18), 62]];
  const lining = [[at(sign, 43), 26], [at(sign, 58), 54], [at(sign, 27), 55]];
  const tuft = `M${at(sign, 37)} 18 L${at(sign, 44)} -4 L${at(sign, 50)} 10 L${at(sign, 56)} -2 L${at(sign, 62)} 20 Z`;
  return `<path id="ear${side}Tuft" data-name="${side} ear tuft" d="${tuft}" fill="${SKIN}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" />`
    + `<path id="ear${side}Shape" data-name="${side} ear" d="${roundedTriangle(shape, 7)}" fill="${SKIN}" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round" />`
    + `<path id="ear${side}Inner" data-name="${side} inner ear" d="${roundedTriangle(lining, 5)}" fill="${INNER}" />`;
};

export const EARS_TUFTED = ears('tufted', 'Tufted', 'Pointed ears with a tuft of fur breaking the tip.',
  tufted, { x: 50, y: -6, width: 140, height: 70 }, { tags: ['animal', 'tufted', 'pointed', 'lynx'], tuft: true });

export const ANIMAL_EARS = Object.freeze([
  EARS_CAT_POINTED, EARS_FOX_LARGE_POINTED, EARS_WOLF_POINTED, EARS_DOG_FOLDED, EARS_BEAR_ROUND, EARS_RABBIT_LONG,
  EARS_SMALL_ROUND, EARS_TUFTED
]);
