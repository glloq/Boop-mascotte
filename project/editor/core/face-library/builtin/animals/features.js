/**
 * The small animal features: noses, mouths, brows and whiskers.
 *
 * All of them sit in the notch and below the seam of a muzzle
 * (`animals/muzzles.js`), which is what lets the snout be an accessory and the
 * nose and the mouth stay the semantic parts they have always been: a cat
 * opens its mouth with `mouthOpen` and smiles with `smile`, exactly as a person
 * does, and no new control is added anywhere in this pack.
 */
import { ovalPath, roundedTriangle, round } from './shapes.js';

const LINE = '#a4674a', DARK = '#3a2b24', PINK = '#e8a9a0', LIP = '#b4525c', INSIDE = '#7a2d35', TONGUE = '#d9707f', HAIR = '#a6603c';
const at = (sign, offset) => round(120 + sign * offset);

/* ── Noses ─────────────────────────────────────────────────────────────
 * In the muzzle's notch, on the template's nose line at 148. A nose that is
 * filled rather than a line, because on an animal it is the darkest thing on
 * the face and the eye goes to it.
 */
const nose = (slug, name, description, shape, box, { tags, token = 'outline' }) => Object.freeze({
  id: `nose.${slug}`, category: 'nose', name, description, origin: 'builtin',
  artwork: `<g id="nose-${slug}" data-name="Nose">${shape}</g>`,
  roles: Object.freeze({ nose: 'nose' }),
  capabilities: Object.freeze(['noseScrunch']),
  paletteRoles: Object.freeze({ nose: Object.freeze({ fill: token }) }),
  referenceBox: Object.freeze(box),
  mountPoint: 'nose.center',
  slot: 'nose', morphologies: Object.freeze(['muzzle']), tags: Object.freeze(tags),
  palette: Object.freeze([token])
});

export const NOSE_TRIANGLE_SMALL = nose('triangle-small', 'Small triangle', 'A small rounded triangle, point down.',
  `<path id="nose" data-name="Nose" d="${roundedTriangle([[105, 134], [135, 134], [120, 151]], 5)}" fill="${DARK}" />`,
  { x: 105, y: 134, width: 30, height: 17 }, { tags: ['cat', 'fox', 'triangle', 'small'] });

export const NOSE_BEAR_BROAD = nose('bear-broad', 'Broad bear', 'A wide nose across the top of the muzzle.',
  `<path id="nose" data-name="Nose" d="${ovalPath(120, 141, 21, 12)}" fill="${DARK}" />`,
  { x: 99, y: 129, width: 42, height: 24 }, { tags: ['bear', 'broad', 'large'] });

export const NOSE_BUTTON_TINY = nose('button-tiny', 'Tiny button', 'A tiny pink button.',
  `<path id="nose" data-name="Nose" d="${ovalPath(120, 143, 9, 7)}" fill="${PINK}" />`,
  { x: 111, y: 136, width: 18, height: 14 }, { tags: ['rabbit', 'button', 'tiny', 'pink'], token: 'accessorySecondary' });

export const NOSE_OVAL_SOFT = nose('oval-soft', 'Soft oval', 'A soft dark oval, wider than tall.',
  `<path id="nose" data-name="Nose" d="${ovalPath(120, 142, 16, 9)}" fill="${DARK}" />`,
  { x: 104, y: 133, width: 32, height: 18 }, { tags: ['wolf', 'oval', 'soft'] });

/** Rounder at the top than the triangle, smaller than the bear's. */
export const NOSE_ANIMAL_ROUNDED = nose('animal-rounded', 'Rounded animal', 'A rounded triangle, fuller at the top.',
  `<path id="nose" data-name="Nose" d="${roundedTriangle([[102, 133], [138, 133], [120, 152]], 9)}" fill="${DARK}" />`,
  { x: 102, y: 133, width: 36, height: 19 }, { tags: ['dog', 'rounded', 'animal'] });

export const ANIMAL_NOSES = Object.freeze([NOSE_TRIANGLE_SMALL, NOSE_BEAR_BROAD, NOSE_BUTTON_TINY, NOSE_OVAL_SOFT, NOSE_ANIMAL_ROUNDED]);

/* ── Mouths ────────────────────────────────────────────────────────────
 * Below the muzzle's seam, on the template's lip line at 176. The ω is the
 * one shape a human mouth cannot stand in for, and it is one path with two
 * subpaths so the role still names one element.
 */
const mouth = (slug, name, description, shapes, { roles, capabilities, box, palette, paletteRoles, tags }) => Object.freeze({
  id: `mouth.${slug}`, category: 'mouth', name, description, origin: 'builtin',
  artwork: `<g id="mouth-${slug}" data-name="Mouth">${shapes}</g>`,
  roles: Object.freeze(roles),
  capabilities: Object.freeze(capabilities),
  paletteRoles: Object.freeze(Object.fromEntries(Object.entries(paletteRoles).map(([id, entry]) => [id, Object.freeze({ ...entry })]))),
  referenceBox: Object.freeze(box),
  mountPoint: 'mouth.center',
  slot: 'mouth', morphologies: Object.freeze(['muzzle']), tags: Object.freeze(tags),
  palette: Object.freeze(palette)
});

export const MOUTH_ANIMAL_SMILE = mouth('animal-smile', 'Animal smile', 'The ω: two curves meeting under the nose.',
  `<path id="mouth" data-name="Mouth" d="M120 172 L120 183 M100 179 Q110 191 120 183 Q130 191 140 179" fill="none" stroke="${LIP}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`,
  { roles: { mouth: 'mouth' }, capabilities: ['mouthOpen', 'smile', 'mouthWidth'], box: { x: 100, y: 172, width: 40, height: 15 }, palette: ['mouth'], paletteRoles: { mouth: { stroke: 'mouth' } }, tags: ['animal', 'smile', 'omega'] });

export const MOUTH_ANIMAL_NEUTRAL = mouth('animal-neutral', 'Neutral', 'A short stem and a small curve each side.',
  `<path id="mouth" data-name="Mouth" d="M120 172 L120 182 M104 182 Q112 188 120 182 Q128 188 136 182" fill="none" stroke="${LIP}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`,
  { roles: { mouth: 'mouth' }, capabilities: ['mouthOpen', 'smile', 'mouthWidth'], box: { x: 104, y: 172, width: 32, height: 14 }, palette: ['mouth'], paletteRoles: { mouth: { stroke: 'mouth' } }, tags: ['animal', 'neutral', 'plain'] });

export const MOUTH_ANIMAL_OPEN = mouth('animal-open-friendly', 'Open and friendly', 'An open animal mouth with a tongue.',
  `<path id="mouth" data-name="Mouth" d="M104 176 Q120 172 136 176 Q120 196 104 176 Z" fill="${INSIDE}" stroke="${LIP}" stroke-width="2.6" stroke-linejoin="round" />`
  + `<path id="tongue" data-name="Tongue" d="M110 184 Q120 180 130 184 Q120 194 110 184 Z" fill="${TONGUE}" />`,
  { roles: { mouth: 'mouth', tongue: 'tongue' }, capabilities: ['mouthOpen', 'smile', 'mouthWidth', 'tongue'], box: { x: 104, y: 172, width: 32, height: 22 }, palette: ['mouth', 'tongue'], paletteRoles: { mouth: { fill: 'mouth' }, tongue: { fill: 'tongue' } }, tags: ['animal', 'open', 'friendly', 'tongue'] });

export const MOUTH_ANIMAL_SMALL_SMILE = mouth('animal-small-smile', 'Small smile', 'One short curve, turning up at the ends.',
  `<path id="mouth" data-name="Mouth" d="M106 178 Q120 188 134 178" fill="none" stroke="${LIP}" stroke-width="4" stroke-linecap="round" />`,
  { roles: { mouth: 'mouth' }, capabilities: ['mouthOpen', 'smile', 'mouthWidth'], box: { x: 106, y: 177, width: 28, height: 10 }, palette: ['mouth'], paletteRoles: { mouth: { stroke: 'mouth' } }, tags: ['animal', 'small', 'smile'] });

/** The widest single curve: no stem, no corners, just a grin across the face. */
export const MOUTH_ANIMAL_HAPPY_CURVE = mouth('animal-happy-curve', 'Happy curve', 'One wide curve across the lower face.',
  `<path id="mouth" data-name="Mouth" d="M96 175 Q120 194 144 175" fill="none" stroke="${LIP}" stroke-width="4.5" stroke-linecap="round" />`,
  { roles: { mouth: 'mouth' }, capabilities: ['mouthOpen', 'smile', 'mouthWidth'], box: { x: 96, y: 174, width: 48, height: 14 }, palette: ['mouth'], paletteRoles: { mouth: { stroke: 'mouth' } }, tags: ['animal', 'happy', 'wide'] });

export const ANIMAL_MOUTHS = Object.freeze([MOUTH_ANIMAL_SMILE, MOUTH_ANIMAL_NEUTRAL, MOUTH_ANIMAL_OPEN, MOUTH_ANIMAL_SMALL_SMILE, MOUTH_ANIMAL_HAPPY_CURVE]);

/* ── Brows ─────────────────────────────────────────────────────────────
 * Five pairs, told apart by weight and by which end is lifted -- which is all
 * a brow is. Above the eyes at the template's line, drawn from the inner end
 * out, so `browTilt` pivots where a brow actually pivots.
 */
const brow = (slug, name, description, draw, box, tags, paint = 'fill') => Object.freeze({
  id: `eyebrows.${slug}`, category: 'eyebrows', name, description, origin: 'builtin',
  artwork: `<g id="brows-${slug}" data-name="Brows">${draw(-1, 'Left')}${draw(1, 'Right')}</g>`,
  roles: Object.freeze({ leftBrow: 'browLeft', rightBrow: 'browRight' }),
  capabilities: Object.freeze(['browRaise', 'browTilt']),
  paletteRoles: Object.freeze({ browLeft: Object.freeze({ [paint]: 'hair' }), browRight: Object.freeze({ [paint]: 'hair' }) }),
  referenceBox: Object.freeze(box),
  mountPoint: 'brows',
  slot: 'eyebrows', morphologies: Object.freeze(['muzzle']), tags: Object.freeze(tags),
  palette: Object.freeze(['hair'])
});

export const BROWS_ANIMAL_FIRM = brow('animal-firm', 'Firm', 'An angled brow, higher at the outer end.',
  (sign, side) => `<path id="brow${side}" data-name="${side} eyebrow" d="M${at(sign, 16)} 85 L${at(sign, 48)} 74 L${at(sign, 50)} 80 L${at(sign, 18)} 91 Z" fill="${HAIR}" />`,
  { x: 70, y: 74, width: 100, height: 17 }, ['animal', 'sharp', 'alert']);

/** The lightest of the five: two thin arcs, set high. */
export const BROWS_ANIMAL_THIN_SOFT = brow('animal-thin-soft', 'Thin and soft', 'Thin soft arcs, set high.',
  (sign, side) => `<path id="brow${side}" data-name="${side} eyebrow" d="M${at(sign, 18)} 82 Q${at(sign, 34)} 73 ${at(sign, 50)} 78" fill="none" stroke="${HAIR}" stroke-width="3.5" stroke-linecap="round" />`,
  { x: 68, y: 72, width: 104, height: 13 }, ['animal', 'thin', 'soft'], 'stroke');

/** The heaviest: blunt at both ends and level across. */
export const BROWS_ANIMAL_THICK = brow('animal-thick', 'Thick', 'Heavy and blunt.',
  (sign, side) => `<path id="brow${side}" data-name="${side} eyebrow" d="M${at(sign, 16)} 78 L${at(sign, 50)} 74 L${at(sign, 50)} 84 L${at(sign, 16)} 88 Z" fill="${HAIR}" />`,
  { x: 70, y: 74, width: 100, height: 14 }, ['animal', 'thick', 'heavy']);

/**
 * The only pair lifted at the *outer* end rather than the inner: open,
 * friendly. It is an arch and not a straight slant, and the difference is the
 * whole expression -- a brow that runs in a hard line from a low inner end to
 * a high outer one is the cartoon shape for cross, which is not what the dog
 * wearing it is meant to look like.
 */
export const BROWS_ANIMAL_FRIENDLY_RAISED = brow('animal-friendly-raised', 'Friendly raised', 'Raised at the outer end: open and friendly.',
  (sign, side) => `<path id="brow${side}" data-name="${side} eyebrow" d="M${at(sign, 16)} 84 Q${at(sign, 33)} 73 ${at(sign, 50)} 78" fill="none" stroke="${HAIR}" stroke-width="4.5" stroke-linecap="round" />`,
  { x: 68, y: 72, width: 104, height: 15 }, ['animal', 'raised', 'friendly'], 'stroke');

/** Tipped in at the inner end, which is the whole of what worry looks like. */
export const BROWS_ANIMAL_WORRIED = brow('animal-worried', 'Worried', 'Curved and tipped in at the inner end.',
  (sign, side) => `<path id="brow${side}" data-name="${side} eyebrow" d="M${at(sign, 16)} 72 Q${at(sign, 33)} 78 ${at(sign, 50)} 84" fill="none" stroke="${HAIR}" stroke-width="4" stroke-linecap="round" />`,
  { x: 68, y: 70, width: 104, height: 16 }, ['animal', 'worried', 'curved'], 'stroke');

export const ANIMAL_BROWS = Object.freeze([
  BROWS_ANIMAL_THIN_SOFT, BROWS_ANIMAL_FIRM, BROWS_ANIMAL_THICK, BROWS_ANIMAL_FRIENDLY_RAISED, BROWS_ANIMAL_WORRIED
]);

/* ── Whiskers ──────────────────────────────────────────────────────────
 * Accessories at `nose.center`, fanned from the cheek pads. "None" is not a
 * drawing: it is a preset that names none.
 */
const whiskers = (slug, name, description, draw, box, tags) => Object.freeze({
  id: `accessory.${slug}`, category: 'accessory', name, description, origin: 'builtin',
  artwork: `<g id="${slug}" data-name="${name}"><path id="accessory" data-name="${name}" d="${[-1, 1].map(draw).join(' ')}" fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round" /></g>`,
  roles: Object.freeze({ element: 'accessory' }),
  capabilities: Object.freeze([]),
  // They sit on the snout, so they sweep with it.
  turn: Object.freeze({ element: Object.freeze({ depth: 0.85, side: null, narrow: true }) }),
  paletteRoles: Object.freeze({ accessory: Object.freeze({ stroke: 'outline' }) }),
  referenceBox: Object.freeze(box),
  mountPoint: 'nose.center',
  slot: 'whiskers', morphologies: Object.freeze(['muzzle']), tags: Object.freeze(tags),
  palette: Object.freeze(['outline'])
});

export const WHISKERS_THREE_STRAIGHT = whiskers('whiskers-three-straight', 'Three straight', 'Three straight whiskers a side.',
  (sign) => [[-4, 44], [1, 46], [6, 43]].map(([rise, reach]) => `M${at(sign, 30)} ${160 + rise} L${at(sign, 30 + reach)} ${154 + rise * 1.6}`).join(' '),
  { x: 46, y: 150, width: 148, height: 22 }, ['cat', 'feline', 'three', 'straight']);

export const WHISKERS_TWO_SOFT = whiskers('whiskers-two-soft', 'Two soft', 'Two soft curved whiskers a side.',
  (sign) => [[-2, 38], [5, 36]].map(([rise, reach]) => `M${at(sign, 28)} ${162 + rise} Q${at(sign, 28 + reach * 0.6)} ${158 + rise} ${at(sign, 28 + reach)} ${150 + rise * 1.4}`).join(' '),
  { x: 54, y: 148, width: 132, height: 22 }, ['fox', 'soft', 'two', 'curved']);

export const WHISKERS_LONG_CURVED = whiskers('whiskers-long-curved', 'Long curved', 'Three long whiskers a side, sweeping wide.',
  (sign) => [[-5, 54], [1, 56], [7, 52]].map(([rise, reach]) => `M${at(sign, 30)} ${160 + rise} Q${at(sign, 30 + reach * 0.55)} ${155 + rise} ${at(sign, 30 + reach)} ${150 + rise * 1.5}`).join(' '),
  { x: 34, y: 146, width: 172, height: 26 }, ['wolf', 'long', 'curved']);

export const WHISKERS_SUBTLE_SHORT = whiskers('whiskers-subtle-short', 'Subtle short', 'Two short fine whiskers a side.',
  (sign) => [[-1, 26], [5, 24]].map(([rise, reach]) => `M${at(sign, 24)} ${160 + rise} L${at(sign, 24 + reach)} ${155 + rise}`).join(' '),
  { x: 70, y: 154, width: 100, height: 16 }, ['rabbit', 'subtle', 'short']);

export const ANIMAL_WHISKERS = Object.freeze([WHISKERS_THREE_STRAIGHT, WHISKERS_TWO_SOFT, WHISKERS_LONG_CURVED, WHISKERS_SUBTLE_SHORT]);
