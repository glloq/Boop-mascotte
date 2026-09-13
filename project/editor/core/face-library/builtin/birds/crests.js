/**
 * Crests: what a bird has instead of hair, and the second slot that makes one.
 *
 * `crest` has been in `FACE_SLOTS` since MASC-01 and empty ever since. These are
 * the first drawings it has had, and with the beaks they are what turns `beak`
 * on in the Type row.
 *
 * ## The anchor, which closes MASC-09's question
 *
 * MASC-09 left the crest with two candidates and said the first real crest
 * would decide (docs/FACE_ASSET_AUTHORING.md): `head.top` is the skull, and
 * `hair.top` is the top of whatever hair the face has — "which on a bird *is*
 * the crest".
 *
 * It is **`head.top`**, and the argument settles it without waiting for the
 * drawings: a `beak` face offers no hair slot at all, so `hair.top` would be an
 * anchor measured from something that can never be there. A crest anchored to
 * absent hair is a crest anchored to nothing.
 *
 * Drawn standing on the crown at y 22 and into the sixty units of headroom the
 * artboard keeps above y 0 — the same headroom the hat's crown and the rabbit's
 * ears use. The parrot's is the tallest thing in the library after those ears.
 */
import { featherPath, ovalPath, round, unionBox } from './shapes.js';

const FEATHER = '#f0e2cd', LINE = '#8a6f4e';
const at = (sign, offset) => round(120 + sign * offset);
/** The crown: where the template's skull ends and a crest begins. */
const CROWN = 30;

const crest = (slug, name, description, artwork, box, { tags, parts }) => Object.freeze({
  id: `accessory.${slug}`, category: 'accessory', name, description, origin: 'builtin',
  artwork: `<g id="${slug}" data-name="${name}">${artwork}</g>`,
  roles: Object.freeze({ element: 'accessory' }),
  capabilities: Object.freeze([]),
  // An accessory that says nothing about the 2.5D turn does not turn at all,
  // and no row of the role table could answer for one: `element` is the role
  // every accessory plays. A crest stands off the crown and sweeps round with
  // it, which is the reading the robot antennae take at the same anchor.
  turn: Object.freeze({ element: Object.freeze({ depth: 0.35, side: null, narrow: true }) }),
  paletteRoles: Object.freeze(Object.fromEntries(parts.map((id) => [id, Object.freeze({ fill: 'accessorySecondary', stroke: 'outline' })]))),
  referenceBox: Object.freeze(box),
  mountPoint: 'head.top',
  slot: 'crest', morphologies: Object.freeze(['beak']), tags: Object.freeze(['bird', ...tags]),
  palette: Object.freeze(['accessorySecondary', 'outline'])
});

/** One feather of a crest, as a painted path. */
const plume = (id, x, base, height, width, options) =>
  `<path id="${id}" data-name="Feather" d="${featherPath(x, base, height, width, options)}" fill="${FEATHER}" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round" />`;

/**
 * Aigrettes hibou — the only crest that is a pair rather than one piece.
 *
 * Tall, where `head.bird-owl` carries a short pair in its own silhouette. An
 * owl wearing both reads as one bird rather than as four ears, which is what
 * the two heights are for (MASC-12A, `owl-tufts-versus-crest`).
 */
export const CREST_OWL_TUFTS = crest('crest-owl-tufts', 'Owl tufts', 'Two pointed tufts, one each side of the crown.',
  plume('accessory', at(-1, 44), CROWN + 6, 62, 20, { lean: -16, sharp: 0.4 })
  + plume('tuftRight', at(1, 44), CROWN + 6, 62, 20, { lean: 16, sharp: 0.4 }),
  { x: 48, y: -28, width: 144, height: 66 }, { tags: ['owl', 'tufts', 'pointed'], parts: ['accessory', 'tuftRight'] });

/** Crête simple — exactly three feathers, all the same. */
export const CREST_SIMPLE = crest('crest-simple', 'Simple crest', 'Three plain feathers standing straight up.',
  plume('accessory', 120, CROWN + 4, 54, 13, { lean: 0 })
  + plume('plumeLeft', at(-1, 20), CROWN + 10, 44, 12, { lean: -10 })
  + plume('plumeRight', at(1, 20), CROWN + 10, 44, 12, { lean: 10 }),
  { x: 86, y: -22, width: 68, height: 62 }, { tags: ['simple', 'feathers'], parts: ['accessory', 'plumeLeft', 'plumeRight'] });

/** Touffe ébouriffée — the only untidy one: no two feathers alike. */
export const CREST_MESSY_TUFT = crest('crest-messy-tuft', 'Messy tuft', 'A ragged spray of short feathers, no two alike.',
  plume('accessory', at(-1, 22), CROWN + 8, 36, 11, { lean: -18, sharp: 0.62 })
  + plume('sprayA', at(-1, 4), CROWN + 2, 46, 10, { lean: -4, sharp: 0.38 })
  + plume('sprayB', at(1, 12), CROWN + 6, 30, 12, { lean: 12, sharp: 0.7 })
  + plume('sprayC', at(1, 28), CROWN + 12, 40, 9, { lean: 20, sharp: 0.45 }),
  { x: 78, y: -18, width: 84, height: 60 }, { tags: ['messy', 'ruffled'], parts: ['accessory', 'sprayA', 'sprayB', 'sprayC'] });

/** Plume lisse — one feather, and the only crest with a single closed outline. */
export const CREST_SMOOTH_FEATHER = crest('crest-smooth-feather', 'Smooth feather', 'One smooth leaf-shaped feather lying back.',
  plume('accessory', 120, CROWN + 6, 50, 19, { lean: -14, sharp: 0.5 }),
  { x: 98, y: -16, width: 44, height: 52 }, { tags: ['smooth', 'single'], parts: ['accessory'] });

/** Crête perroquet — the tallest, by a long way. */
export const CREST_PARROT_TALL = crest('crest-parrot-tall', 'Parrot crest', 'A tall fan of long feathers.',
  plume('accessory', 120, CROWN + 4, 86, 16, { lean: -2, sharp: 0.36 })
  + plume('fanA', at(-1, 18), CROWN + 10, 70, 14, { lean: -14, sharp: 0.4 })
  + plume('fanB', at(1, 18), CROWN + 10, 70, 14, { lean: 14, sharp: 0.4 })
  + plume('fanC', at(-1, 34), CROWN + 16, 52, 12, { lean: -22, sharp: 0.46 })
  + plume('fanD', at(1, 34), CROWN + 16, 52, 12, { lean: 22, sharp: 0.46 }),
  { x: 68, y: -54, width: 104, height: 100 }, { tags: ['parrot', 'tall', 'fan'], parts: ['accessory', 'fanA', 'fanB', 'fanC', 'fanD'] });

/** Touffe ronde — the shortest, and the only one with no point on it. */
export const CREST_ROUND_TUFT = crest('crest-round-tuft', 'Round tuft', 'A small soft round tuft, barely clear of the crown.',
  `<path id="accessory" data-name="Tuft" d="${ovalPath(120, CROWN - 6, 20, 16)}" fill="${FEATHER}" stroke="${LINE}" stroke-width="3.5" />`
  + `<path id="tuftInner" data-name="Tuft crown" d="${ovalPath(120, CROWN - 14, 11, 9)}" fill="${FEATHER}" stroke="${LINE}" stroke-width="3" />`,
  { x: 99, y: 1, width: 42, height: 41 }, { tags: ['round', 'small', 'cute'], parts: ['accessory', 'tuftInner'] });

export const BIRD_CRESTS = Object.freeze([
  CREST_OWL_TUFTS, CREST_SIMPLE, CREST_MESSY_TUFT, CREST_SMOOTH_FEATHER, CREST_PARROT_TALL, CREST_ROUND_TUFT
]);

/* ── The one accessory the planche draws that the library has not got ──── */

/**
 * Monocle — and the only drawing in this pack that is **not** for birds only.
 *
 * Everything else here says `morphologies: ['beak']`, because an owl's beak on
 * a person is not a look anybody asked for. A monocle is not like that: row 6
 * of the planche is captioned "4 accessoires simples et compatibles", and the
 * library reads an empty `morphologies` as every kind of face. So it ships
 * universal, beside the glasses and the bow tie it arrived next to — which are
 * the other two of those four, and were already drawn.
 */
export const ACCESSORY_MONOCLE = Object.freeze({
  id: 'accessory.monocle', category: 'accessory', name: 'Monocle', description: 'A single rimmed lens over one eye, on a fine chain.', origin: 'builtin',
  artwork: '<g id="monocle" data-name="Monocle">'
    + `<path id="chain" data-name="Chain" d="M175 128 Q182 150 176 170" fill="none" stroke="${LINE}" stroke-width="2" stroke-dasharray="1 4" stroke-linecap="round" />`
    + `<circle id="lens" data-name="Lens" cx="157" cy="113" r="25" fill="#ffffff" opacity="0.28" />`
    + `<circle id="accessory" data-name="Monocle rim" cx="157" cy="113" r="25" fill="none" stroke="${LINE}" stroke-width="4" />`
    + '</g>',
  roles: Object.freeze({ element: 'accessory' }),
  capabilities: Object.freeze([]),
  // Glass sits close to the face and barely moves against it: the reading the
  // shipped glasses take, which is the drawing this one stands beside.
  turn: Object.freeze({ element: Object.freeze({ depth: 0.72, side: null, narrow: true }) }),
  paletteRoles: Object.freeze({
    accessory: Object.freeze({ stroke: 'accessoryPrimary' }),
    chain: Object.freeze({ stroke: 'accessoryPrimary' }),
    lens: Object.freeze({ fill: 'eyeWhite' })
  }),
  referenceBox: Object.freeze({ x: 130, y: 86, width: 54, height: 86 }),
  mountPoint: 'eye.right',
  palette: Object.freeze(['accessoryPrimary', 'eyeWhite']),
  tags: Object.freeze(['monocle', 'distinguished', 'lens', 'glasses'])
});

export { unionBox };
