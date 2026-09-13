/**
 * Bird head silhouettes: the bare feathered outline, and the marks on it.
 *
 * "6 formes de base pour têtes d'oiseaux (vue de face)" — the planche's own
 * caption, and the same shape the rest of this library has. Every feature is a
 * separate piece; what belongs to the *head* is only what belongs to the
 * silhouette, which is why the owl's tufts and the parrot's side feathers are
 * here and the crests are not.
 *
 * Drawn where the human skulls are drawn — the face's middle at 120, 116 — so a
 * bird head and a person's head fit the same face at the same size.
 *
 * **A bird head ships a jaw, and it is the skull.** Unlike a robot shell, a
 * feathered head is soft: the same outline drawn twice, at rest and with its
 * lower half stretched down by `JAW_DROP`, exactly as the human and animal
 * heads do it. What a bird does *not* have is a separate mouth — the beak is
 * the mouth — so `jawOpen` drops the face and `mouthOpen` opens the beak, and
 * the two read together as one bird opening up.
 *
 * ## Measured against the delivered reference (`art/planches/`)
 *
 * Four of the six species arrived as painted face backgrounds — owl, duck,
 * parrot, crow. Their outlines were sampled and fitted back onto this pack's
 * own width rule, and the fit is tight enough to settle the question: the
 * reference silhouettes *are* superellipses of the same family, to under one
 * unit RMS on a head two hundred units across. So the reference did not change
 * how a bird head is built here. It changed the numbers, and four of them
 * were wrong:
 *
 * ```text
 *            shipped before          measured from the reference
 * owl        rx 94 ry  88            rx 99.5 ry 106 lean -0.08  crown 2.1 jaw 2.0
 * duck       rx 96 ry  84            rx 92  ry  98  lean -0.02  crown 2.1 jaw 1.7
 * parrot     rx 82 ry  92            rx 82  ry 102  lean -0.08  crown 2.2 jaw 1.7
 * crow       rx 86 ry  90 crown 3.2  rx 83  ry 100  lean -0.08  crown 2.3 jaw 1.9
 * ```
 *
 * - **Every head was too short.** A bird's face runs on down into a throat;
 *   these stopped at a person's chin. `ry` rises by about 15%.
 * - **Every head leans up.** The width sits above the middle on all four, by a
 *   little and by the same little. Nothing was leaning before.
 * - **Every jaw is rounder than drawn.** I squared the chins; the reference
 *   rounds all four.
 * - **The crow is not flat-browed.** It shipped with `crown: 3.2`, the only
 *   squared silhouette in the pack, deduced from the word *angular* in the
 *   planche caption. The reference measures 2.3 — the crow's angularity is in
 *   its feather direction and its heavy brow, not in its skull. That mark is
 *   now drawn where it belongs.
 *
 * ## What could be taken, and what could not
 *
 * The delivered files paint in tone: gradients, and three or four values of the
 * plumage colour per head. Almost none of that can be held here, for two
 * reasons that are the library's, not the art's.
 *
 * - A gradient is not a paint the palette can hold. `palette-model.js` says so
 *   outright — what a token writes goes into a `style` attribute, so a value
 *   carrying `url(` is not a colour. A shape filled with `url(#headBase)` would
 *   keep that fill for ever while the skin token moved out from under it.
 * - **A `beak` face seeds seven of the twelve tokens.** `skinShadow` is read
 *   from the nose, `hair` and `hairShadow` from the hair, `teeth` and `tongue`
 *   from the mouth's own parts — and a beak morphology offers no nose, no hair,
 *   and a mouth that is a beak. So a bird face has exactly **one** skin tone.
 *   Every shadow plane and every lighter cheek in the reference would be a
 *   paint the author cannot reach.
 *
 * So the reference was read for structure and re-stated as line, which is the
 * language this library already draws in — filled with `skin` and stroked with
 * `outline`, so a mark reads as drawn on a painted head and stays paintable.
 * Two marks survived that translation and the rest did not:
 *
 * - **The brow band, on all six.** All four references draw the same crescent
 *   across the forehead, and each head here carries its own species' arc,
 *   lifted and reframed. It is the family mark.
 * - **The owl's facial discs.** The only facial *structure* in the set, and the
 *   thing the owl's `<desc>` leads with. They are drawn tighter than the pale
 *   masses the file paints: a mass that size becomes a cage when it is a line.
 *
 * The duck's bill-root socket and the parrot's face patches were drawn, looked
 * at, and dropped. The socket is covered by every beak that lands on it, and
 * the reference's own first words for that head are *continuous rounded head* —
 * the duck is the smooth one, and a mark on it argues with that. The patches
 * ring the eyes just outside the eyes' own rings, and two concentric circles
 * read as goggles; the parrot already has six cheek feathers, which is mark
 * enough.
 *
 * The two species that arrived with no reference, `bird-cute` and `bird-slim`,
 * were moved toward the family the other four now describe: taller, leaning up,
 * round-jawed, and carrying the same brow band.
 */
import { JAW_DROP } from '../heads.js';
import { birdBox, birdRing, closedCurve, featherPath, ovalPath, round, unionBox } from './shapes.js';

const FEATHER = '#f0e2cd', LINE = '#8a6f4e';

/** The silhouette, with its lower half stretched down by `drop`. */
function silhouette(cx, cy, rx, ry, shape, drop = 0) {
  const stretch = ([x, y]) => [x, y > cy ? cy + (y - cy) * (1 + drop / ry) : y];
  return closedCurve(birdRing(cx, cy, rx, ry, shape).map(stretch));
}

/**
 * A mark on the face: filled like the head and stroked like its outline, so it
 * reads as a line drawn on the plumage rather than a second colour of it.
 *
 * The brow band is the one mark all six carry. It is an open arc, not a closed
 * shape: the reference draws the band as a crescent whose upper edge lies along
 * the skull, and stroking that edge would only double the silhouette.
 */
const mark = (id, name, d, { open = false } = {}) =>
  `<path id="${id}" data-name="${name}" d="${d}" fill="${open ? 'none' : FEATHER}" stroke="${LINE}"`
  + ` stroke-width="3" stroke-linejoin="round"${open ? ' stroke-linecap="round"' : ''} />`;

const markPaint = (open = false) => (open ? { stroke: 'outline' } : { fill: 'skin', stroke: 'outline' });

const head = (slug, name, description, geometry, { tags, extra = () => '', extraRoles = {}, marks = '', markRoles = {}, box = null }) => {
  const { cx, cy, rx, ry } = geometry;
  const draw = (drop) => silhouette(cx, cy, rx, ry, geometry, drop);
  const painted = { skull: Object.freeze({ fill: 'skin', stroke: 'outline' }), ...extraRoles, ...markRoles };
  return Object.freeze({
    id: `head.${slug}`, category: 'head', name, description, origin: 'builtin',
    artwork: `<g id="head-${slug}" data-name="Head">${extra(-1, 'Left')}${extra(1, 'Right')}`
      + `<path id="skull" data-name="Skull" d="${draw(0)}" fill="${FEATHER}" stroke="${LINE}" stroke-width="4" stroke-linejoin="round" />`
      + `${marks}</g>`,
    roles: Object.freeze({ head: 'skull' }),
    capabilities: Object.freeze(['headX', 'headY', 'headTilt']),
    // The jaw takes the skull, as it does on a person: a feathered head is soft,
    // and the pose is the same outline with its lower half dropped. The marks do
    // not move with it, and should not: a cheek stays where it is when a chin
    // drops. Only the outline below the face's middle travels.
    parts: Object.freeze({ jaw: Object.freeze({ roles: Object.freeze({}), capabilities: Object.freeze(['jawOpen']), drivers: Object.freeze({ jawOpen: Object.freeze({ property: 'shapeKey', posePath: draw(JAW_DROP) }) }) }) }),
    paletteRoles: Object.freeze(Object.fromEntries(Object.entries(painted).map(([id, paint]) => [id, Object.freeze(paint)]))),
    referenceBox: Object.freeze(box || birdBox(cx, cy, rx, ry, geometry)),
    mountPoint: 'head.center',
    palette: Object.freeze([...new Set(Object.values(painted).flatMap((paint) => Object.values(paint)))]),
    slot: 'head', morphologies: Object.freeze(['beak']), tags: Object.freeze(['bird', ...tags])
  });
};

/** Each species' own brow arc, lifted from its reference and reframed. */
const BROW = Object.freeze({
  owl: 'M176.14 45.36 C158.41 41.43 140.68 43.4 120 51.25 C99.32 43.4 81.59 41.43 63.86 45.36',
  duck: 'M176.31 67.75 C160.22 55.81 141.11 50.83 120 52.82 C98.89 50.83 79.78 55.81 63.69 67.75',
  parrot: 'M160.25 49 C147.17 42 134.09 40 120 43 C105.91 40 92.83 42 79.75 49',
  crow: 'M168 52.35 C152 47.33 136 47.33 120 53.35 C104 47.33 88 47.33 72 52.35',
  cute: 'M166 56 C151 50 136 50 120 56 C104 50 89 50 74 56',
  slim: 'M156 48 C143 42 131 42 120 48 C109 42 97 42 84 48'
});

const brow = (species) => mark('brow', 'Brow band', BROW[species], { open: true });
const BROW_ROLE = Object.freeze({ brow: markPaint(true) });

/**
 * Hibou — broad, with two tufts worked into the outline and the facial discs
 * drawn on the face.
 *
 * The discs are the owl, and the reference's own `<desc>` leads with them. They
 * are drawn as line rather than as the pale mass the file paints, because a
 * bird face has one skin tone to spend (see the note at the top of this file).
 * They are also drawn *smaller* than that mass: the reference's disc runs from
 * the brow to below the cheek, and stroked at that size it stops being a disc
 * and becomes a cage around the face. Tightened onto the eyes, it reads.
 *
 * The tufts are drawn *behind* the skull and short, so what stands above the
 * crown is a hint rather than a crest. `accessory.crest-owl-tufts` is the tall
 * pair; an owl wearing both reads as one bird, which is the whole reason the
 * two are drawn to different heights (MASC-12A, `owl-tufts-versus-crest`).
 * They moved out and up with the taller skull: a crown at y 10 buries a tuft
 * that used to clear a crown at y 28.
 */
const OWL = { cx: 120, cy: 116, rx: 99.5, ry: 106, lean: -0.08, crown: 2.1, jaw: 2, tags: ['owl', 'broad', 'tufted'] };
const OWL_DISCS = Object.freeze({
  discLeft: ovalPath(83, 111, 43, 48),
  discRight: ovalPath(157, 111, 43, 48)
});
export const HEAD_BIRD_OWL = head('bird-owl', 'Owl head', 'A broad soft head with two tufts and the facial discs drawn on.',
  OWL, {
    tags: OWL.tags,
    extra: (sign) => `<path id="tuft${sign < 0 ? 'Left' : 'Right'}" data-name="${sign < 0 ? 'Left' : 'Right'} head tuft" d="${featherPath(120 + sign * 52, 68, 70, 34, { lean: sign * 8, sharp: 0.62 })}" fill="${FEATHER}" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round" />`,
    extraRoles: { tuftLeft: { fill: 'skin', stroke: 'outline' }, tuftRight: { fill: 'skin', stroke: 'outline' } },
    marks: mark('discLeft', 'Left facial disc', OWL_DISCS.discLeft) + mark('discRight', 'Right facial disc', OWL_DISCS.discRight) + brow('owl'),
    markRoles: { discLeft: markPaint(), discRight: markPaint(), ...BROW_ROLE },
    box: unionBox(birdBox(120, 116, 99.5, 106, OWL), { x: 30, y: -2, width: 180, height: 70 })
  });

/**
 * Canard — round and wide, with the smoothest edge of the six and nothing on it.
 *
 * "Continuous rounded head" is the reference's own first phrase for this bird,
 * and it is the whole brief: the duck is the one whose edge never breaks.
 */
const DUCK = { cx: 120, cy: 116, rx: 92, ry: 98, lean: -0.02, crown: 2.1, jaw: 1.7, tags: ['duck', 'round', 'wide'] };
export const HEAD_BIRD_DUCK = head('bird-duck', 'Duck head', 'Round and wide, with the smoothest unbroken edge of the six.',
  DUCK, {
    tags: DUCK.tags,
    marks: brow('duck'),
    markRoles: BROW_ROLE
  });

/**
 * Perroquet — upright, with a fan of feathers down each side of the face.
 *
 * The feathers stay inside the head's own reference box: MASC-12A asked whether
 * they would push it wide enough to shrink the face on a fit, and they do not —
 * three short feathers tucked against the cheek, not a second silhouette. They
 * were stepped down the taller skull to keep hugging it.
 */
const PARROT = { cx: 120, cy: 116, rx: 82, ry: 102, lean: -0.08, crown: 2.2, jaw: 1.7, tags: ['parrot', 'feathered', 'upright'] };
export const HEAD_BIRD_PARROT = head('bird-parrot', 'Parrot head', 'Upright, with a fan of feathers down each side of the face.',
  PARROT, {
    tags: PARROT.tags,
    extra: (sign, side) => [0, 1, 2].map((step) => `<path id="cheek${side}${step}" data-name="${side} cheek feather ${step + 1}" d="${featherPath(120 + sign * (74 + step * 2), 118 + step * 18, 38, 14, { lean: sign * 11, sharp: 0.55 })}" fill="${FEATHER}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" />`).join(''),
    extraRoles: Object.fromEntries(['Left', 'Right'].flatMap((side) => [0, 1, 2].map((step) => [`cheek${side}${step}`, { fill: 'skin', stroke: 'outline' }]))),
    marks: brow('parrot'),
    markRoles: BROW_ROLE,
    box: unionBox(birdBox(120, 116, 82, 102, PARROT), { x: 26, y: 78, width: 188, height: 80 })
  });

/**
 * Corbeau — the heaviest brow of the six, and nothing else on the face.
 *
 * It shipped as the pack's one squared silhouette, on the strength of the word
 * *angular* in the planche caption. The reference measures a crown of 2.3, no
 * squarer than a parrot's; what is angular about this bird is the brow ridge
 * and the direction of its feathers. So the outline is now the family's, and
 * the brow band carries the weight — the flattest arc of the six, a straight
 * bar where the owl's dips six units at the centre.
 */
const CROW = { cx: 120, cy: 116, rx: 83, ry: 100, lean: -0.08, crown: 2.3, jaw: 1.9, tags: ['crow', 'angular', 'sharp'] };
export const HEAD_BIRD_CROW = head('bird-crow', 'Crow head', 'Narrow and upright under a heavy straight brow.',
  CROW, { tags: CROW.tags, marks: brow('crow'), markRoles: BROW_ROLE });

/** Oiseau mignon — the roundest and the plainest. No reference; moved to the family. */
const CUTE = { cx: 120, cy: 116, rx: 87, ry: 90, lean: -0.04, crown: 2.1, jaw: 1.85, tags: ['cute', 'round', 'small'] };
export const HEAD_BIRD_CUTE = head('bird-cute', 'Cute bird head', 'A small, nearly round head with a light edge.',
  CUTE, { tags: CUTE.tags, marks: brow('cute'), markRoles: BROW_ROLE });

/** Oiseau fin — the narrowest, and the only one much taller than it is wide. */
const SLIM = { cx: 120, cy: 116, rx: 72, ry: 104, lean: -0.06, crown: 2.1, jaw: 1.9, tags: ['slim', 'tall', 'elegant'] };
export const HEAD_BIRD_SLIM = head('bird-slim', 'Slim bird head', 'Tall and narrow, tapering below the eyes.',
  SLIM, { tags: SLIM.tags, marks: brow('slim'), markRoles: BROW_ROLE });

export const BIRD_HEADS = Object.freeze([
  HEAD_BIRD_OWL, HEAD_BIRD_DUCK, HEAD_BIRD_PARROT, HEAD_BIRD_CROW, HEAD_BIRD_CUTE, HEAD_BIRD_SLIM
]);

export { round };
