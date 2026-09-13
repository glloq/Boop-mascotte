/**
 * The bird's brows and its beaks.
 *
 * **Brows.** The planche calls row 3 "formes d'yeux / sourcils (à superposer)"
 * — overlay shapes that are half brow and half eye-shape. They are drawn as
 * brows here: a mirrored pair above the eyes, thin and clear of the lid, so
 * they read as expression rather than as a second pair of lids. `browRaise` and
 * `browTilt` are what the category gives and what the five moods need.
 *
 * **Beaks.** The slot that makes a bird, and the first drawings it has ever
 * had. A beak installs as a **mouth** — the slot is what an author picks, the
 * category is what the rig understands — and keeps `mouthOpen`, `smile` and
 * `mouthWidth`, because a beak opens.
 *
 * Each beak is drawn as an **upper and a lower mandible** in one group, meeting
 * on a seam of its own well above the template's lip line — and the group is
 * what the `mouth` role
 * names. `mouthOpen` is a `scaleY` on whatever that role names, so the beak
 * stretches about its own centre and gapes, which is what a beak does where a
 * lip changes shape. Drawing the two mandibles separately is what makes the
 * seam read; it is not an attempt to move them independently, which would need
 * a role the mouth part has not got.
 */
import { ovalPath, roundedTriangle, round } from './shapes.js';

const LINE = '#8a6f4e', HORN = '#c98a3c', DARK = '#5c4a33';
const at = (sign, offset) => round(120 + sign * offset);

/* ── Brows ─────────────────────────────────────────────────────────────
 * Above the eyes at the template's line, drawn from the inner end out, so
 * `browTilt` pivots where a brow actually pivots.
 */
const brow = (slug, name, description, draw, box, tags, paint = 'stroke') => Object.freeze({
  id: `eyebrows.${slug}`, category: 'eyebrows', name, description, origin: 'builtin',
  artwork: `<g id="brows-${slug}" data-name="Brows">${draw(-1, 'Left')}${draw(1, 'Right')}</g>`,
  roles: Object.freeze({ leftBrow: 'browLeft', rightBrow: 'browRight' }),
  capabilities: Object.freeze(['browRaise', 'browTilt']),
  paletteRoles: Object.freeze({ browLeft: Object.freeze({ [paint]: 'outline' }), browRight: Object.freeze({ [paint]: 'outline' }) }),
  referenceBox: Object.freeze(box),
  mountPoint: 'brows',
  slot: 'eyebrows', morphologies: Object.freeze(['beak']), tags: Object.freeze(['bird', ...tags]),
  palette: Object.freeze(['outline'])
});

/** En colère — the only pair low at the inner end. */
export const BROWS_BIRD_ANGRY = brow('bird-angry', 'Angry', 'Heavy and driven down towards the beak.',
  (sign, side) => `<path id="brow${side}" data-name="${side} brow" d="M${at(sign, 12)} 86 L${at(sign, 54)} 70 L${at(sign, 56)} 78 L${at(sign, 14)} 94 Z" fill="${DARK}" />`,
  { x: 62, y: 70, width: 116, height: 24 }, ['angry', 'furrowed'], 'fill');

/** Curieux — the highest of the five, and clear of the eye. */
export const BROWS_BIRD_CURIOUS = brow('bird-curious', 'Curious', 'Lifted high and clear of the eye.',
  (sign, side) => `<path id="brow${side}" data-name="${side} brow" d="M${at(sign, 14)} 74 Q${at(sign, 34)} 64 ${at(sign, 54)} 72" fill="none" stroke="${DARK}" stroke-width="4.5" stroke-linecap="round" />`,
  { x: 64, y: 63, width: 112, height: 14 }, ['curious', 'raised']);

/** Endormis — the flattest, and the closest to the eye. */
export const BROWS_BIRD_RELAXED = brow('bird-relaxed', 'Relaxed', 'Level and close over the eye.',
  (sign, side) => `<path id="brow${side}" data-name="${side} brow" d="M${at(sign, 12)} 82 L${at(sign, 56)} 81" fill="none" stroke="${DARK}" stroke-width="5" stroke-linecap="round" />`,
  { x: 62, y: 78, width: 116, height: 7 }, ['relaxed', 'level']);

/** Joyeux — the only pair arched rather than straight. */
export const BROWS_BIRD_HAPPY = brow('bird-happy', 'Happy', 'Two soft arcs, lifted in the middle.',
  (sign, side) => `<path id="brow${side}" data-name="${side} brow" d="M${at(sign, 14)} 80 Q${at(sign, 34)} 68 ${at(sign, 54)} 79" fill="none" stroke="${DARK}" stroke-width="4.5" stroke-linecap="round" />`,
  { x: 64, y: 67, width: 112, height: 15 }, ['happy', 'curved']);

/** Perçants — the only pair with a corner in it. */
export const BROWS_BIRD_SHARP = brow('bird-sharp', 'Sharp', 'Angular, with a hard corner at the outer end.',
  (sign, side) => `<path id="brow${side}" data-name="${side} brow" d="M${at(sign, 12)} 78 L${at(sign, 40)} 72 L${at(sign, 56)} 82" fill="none" stroke="${DARK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />`,
  { x: 62, y: 69, width: 116, height: 16 }, ['sharp', 'angular']);

export const BIRD_BROWS = Object.freeze([
  BROWS_BIRD_ANGRY, BROWS_BIRD_CURIOUS, BROWS_BIRD_RELAXED, BROWS_BIRD_HAPPY, BROWS_BIRD_SHARP
]);

/* ── Beaks ─────────────────────────────────────────────────────────────
 * The seam is at 158, and that is **not** the template's lip line at 176.
 *
 * A bird's beak is not where a person's mouth is: it starts just under the eyes
 * and takes the middle of the face, where a human mouth sits low and small. The
 * fit keeps the offset from the anchor to the box centre (MASC-09), so drawing
 * above `mouth.center` is exactly how a part says "higher than a mouth" and
 * costs nothing — the beak lands where it was drawn, on the template and on
 * anything else.
 *
 * The upper mandible is above the seam, the lower below, and the group is what
 * the `mouth` role names.
 */
const SEAM = 158;

const beak = (slug, name, description, upper, lower, box, { tags, token = 'accessoryPrimary' }) => Object.freeze({
  id: `mouth.${slug}`, category: 'mouth', name, description, origin: 'builtin',
  // The `mouth` role is the **whole beak**, as a shipped mouth's role is its
  // whole path: `mouthOpen` is a `scaleY` on whatever the role names, and a
  // beak stretched vertically about the seam is a beak gaping. The two
  // mandibles are separate paths inside it so the seam reads as a seam, not so
  // that they move apart on their own — which would need a role the mouth part
  // does not have, and a control nobody asked for.
  // The lower mandible is painted first and the upper over it, because that is
  // how a beak closes: the upper caps the lower. It only shows on the parrot,
  // whose hook reaches past the seam; on the other five the lower sits entirely
  // below it and the order makes no difference.
  artwork: `<g id="mouth" data-name="Beak">`
    + `<path id="beakLower" data-name="Lower mandible" d="${lower}" fill="${HORN}" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round" />`
    + `<path id="beakUpper" data-name="Upper mandible" d="${upper}" fill="${HORN}" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round" /></g>`,
  roles: Object.freeze({ mouth: 'mouth' }),
  capabilities: Object.freeze(['mouthOpen', 'smile', 'mouthWidth']),
  paletteRoles: Object.freeze({ beakUpper: Object.freeze({ fill: token, stroke: 'outline' }), beakLower: Object.freeze({ fill: token, stroke: 'outline' }) }),
  referenceBox: Object.freeze(box),
  mountPoint: 'mouth.center',
  slot: 'beak', morphologies: Object.freeze(['beak']), tags: Object.freeze(['bird', ...tags]),
  palette: Object.freeze([token, 'outline'])
});

/** Bec hibou — the shortest, and the only round-shouldered one. */
export const BEAK_OWL = beak('beak-owl', 'Owl beak', 'Short and rounded, hooking down to a small point.',
  `M96 ${SEAM - 24} Q120 ${SEAM - 32} 144 ${SEAM - 24} Q142 ${SEAM - 4} 120 ${SEAM} Q98 ${SEAM - 4} 96 ${SEAM - 24} Z`,
  `M101 ${SEAM} Q120 ${SEAM + 20} 139 ${SEAM} Q120 ${SEAM + 8} 101 ${SEAM} Z`,
  { x: 94, y: 124, width: 52, height: 56 }, { tags: ['owl', 'short', 'hooked'] });

/** Bec canard — the only bill on the sheet, and the only one wider than it is deep. */
export const BEAK_DUCK = beak('beak-duck', 'Duck beak', 'Flat and wide, rounded at the end.',
  `M74 ${SEAM - 26} Q120 ${SEAM - 36} 166 ${SEAM - 26} Q170 ${SEAM - 6} 120 ${SEAM} Q70 ${SEAM - 6} 74 ${SEAM - 26} Z`,
  `M80 ${SEAM} Q120 ${SEAM + 22} 160 ${SEAM} Q120 ${SEAM + 9} 80 ${SEAM} Z`,
  { x: 68, y: 120, width: 104, height: 62 }, { tags: ['duck', 'flat', 'wide'] });

/** Bec perroquet — the deepest, and the only one drawn as a true hook. */
export const BEAK_PARROT = beak('beak-parrot', 'Parrot beak', 'A deep curved hook, the upper mandible capping the lower.',
  `M94 ${SEAM - 26} Q120 ${SEAM - 36} 146 ${SEAM - 26} Q150 ${SEAM - 2} 134 ${SEAM + 20} Q120 ${SEAM + 36} 106 ${SEAM + 20} Q90 ${SEAM - 2} 94 ${SEAM - 26} Z`,
  `M102 ${SEAM - 2} Q120 ${SEAM + 16} 138 ${SEAM - 2} Q120 ${SEAM + 7} 102 ${SEAM - 2} Z`,
  { x: 88, y: 120, width: 64, height: 78 }, { tags: ['parrot', 'curved', 'hooked'] });

/** Bec corbeau — the straightest, and the longest point. */
export const BEAK_CROW = beak('beak-crow', 'Crow beak', 'A straight tapered point of medium length.',
  roundedTriangle([[90, SEAM - 26], [150, SEAM - 26], [120, SEAM + 4]], 4),
  `M99 ${SEAM + 1} Q120 ${SEAM + 22} 141 ${SEAM + 1} Q120 ${SEAM + 9} 99 ${SEAM + 1} Z`,
  { x: 90, y: 130, width: 60, height: 54 }, { tags: ['crow', 'pointed', 'straight'] });

/** Petit bec — the smallest of the six. */
export const BEAK_SMALL = beak('beak-small', 'Small beak', 'A tiny diamond, barely off the face.',
  roundedTriangle([[104, SEAM - 16], [136, SEAM - 16], [120, SEAM]], 3),
  `M109 ${SEAM - 1} Q120 ${SEAM + 12} 131 ${SEAM - 1} Q120 ${SEAM + 5} 109 ${SEAM - 1} Z`,
  { x: 104, y: 140, width: 32, height: 34 }, { tags: ['small', 'neat'] });

/** Bec large — the largest diamond: broader than the small beak, blunter than the crow's. */
export const BEAK_WIDE = beak('beak-wide', 'Wide beak', 'A broad open diamond, friendly rather than sharp.',
  roundedTriangle([[86, SEAM - 22], [154, SEAM - 22], [120, SEAM + 2]], 9),
  `M94 ${SEAM + 1} Q120 ${SEAM + 22} 146 ${SEAM + 1} Q120 ${SEAM + 9} 94 ${SEAM + 1} Z`,
  { x: 86, y: 134, width: 68, height: 48 }, { tags: ['wide', 'friendly', 'blunt'] });

export const BIRD_BEAKS = Object.freeze([
  BEAK_OWL, BEAK_DUCK, BEAK_PARROT, BEAK_CROW, BEAK_SMALL, BEAK_WIDE
]);

export { ovalPath, at, LINE, HORN, DARK };
