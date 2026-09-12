/**
 * Accessories: glasses on the eyes, a hat on top, an earring on either ear, a
 * bow tie under the chin. Each mounts somewhere of its own, so they go
 * together, each its own part of the rig (docs/FACE_PART_LIBRARY.md, "Several
 * at once"). A hat sits in front of the hair; the rest sit where they are
 * painted, on top of the face.
 *
 * An earring is the one of them that belongs to a part rather than to the
 * face: it hangs on an ear, so it names that ear as its `host` and is drawn
 * inside it (docs/FACE_PART_LIBRARY.md, "Hosted on a part"). The two of them
 * are two accessories, because two ears are two places to hang one.
 */
// Not the pupil's colour: a colour belongs to the first token seeded with it, so an accessory painted like the pupils would have no swatch of its own.
const PRIMARY = '#33424f', SECONDARY = '#c8a24a';

/**
 * Where each of these sits when the head turns (V3-02; docs/HEAD_POSE_2_5D.md,
 * "Which parts turn"). Every accessory plays the one role `element`, so the
 * role table could never hold an answer for them: a hat is skull-mounted and
 * narrows with the outline, glasses are a centred feature just in front of the
 * eyes, and an earring hangs off an ear and has to sweep round with it. Each
 * drawing says which it is.
 *
 * A drawing that turns declares no `depth`: parallax is the stand-in for a
 * rotation, and the turn has just done the rotation properly, so letting both
 * fire would displace the piece twice (`runtime/runtime.js`, "Parallax is
 * driven by the authored depth alone").
 */
const accessory = (slug, name, description, shape, { mountPoint, box, depth = null, host = null, paletteRoles, turn }) => Object.freeze({
  id: `accessory.${slug}`, category: 'accessory', name, description, origin: 'builtin',
  turn: Object.freeze({ element: Object.freeze(turn) }),
  artwork: `<g id="accessory-${slug}" data-name="${name}">${shape}</g>`,
  roles: Object.freeze({ element: 'accessory' }),
  capabilities: Object.freeze([]),
  paletteRoles: Object.freeze(Object.fromEntries(Object.entries(paletteRoles).map(([id, roles]) => [id, Object.freeze({ ...roles })]))),
  referenceBox: Object.freeze(box),
  mountPoint,
  host: host ? Object.freeze({ ...host }) : null,
  depth
  // No `palette`: derived from `paletteRoles`, so the glasses claim the one
  // colour they are drawn in rather than a second nothing paints.
});

export const GLASSES = accessory('glasses', 'Glasses', 'Round glasses on the eyes.',
  `<path id="accessory" data-name="Glasses" d="M55 113 A28 26 0 1 0 111 113 A28 26 0 1 0 55 113 Z M129 113 A28 26 0 1 0 185 113 A28 26 0 1 0 129 113 Z M111 111 Q120 104 129 111 M27 108 L55 113 M213 108 L185 113" fill="none" stroke="${PRIMARY}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`,
  { mountPoint: 'eyes', box: { x: 27, y: 87, width: 186, height: 52 }, turn: { depth: 0.7, side: null, narrow: true }, paletteRoles: { accessory: { stroke: 'accessoryPrimary' } } });
export const SQUARE_GLASSES = accessory('square-glasses', 'Square glasses', 'Square glasses on the eyes.',
  `<path id="accessory" data-name="Square glasses" d="M57 93 L109 93 L109 133 L57 133 Z M131 93 L183 93 L183 133 L131 133 Z M109 111 Q120 106 131 111 M27 108 L57 113 M213 108 L183 113" fill="none" stroke="${PRIMARY}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`,
  { mountPoint: 'eyes', box: { x: 27, y: 93, width: 186, height: 40 }, turn: { depth: 0.7, side: null, narrow: true }, paletteRoles: { accessory: { stroke: 'accessoryPrimary' } } });
// A top hat is a **tall** crown on a brim, and it stands over the head rather
// than on it: 78 units of crown above a skull whose top sits at y 22. It was
// flattened to 36 once, to fit a page that ended at the origin -- which is the
// page being wrong about hats, not the hat being wrong about the page. The
// artboard keeps headroom for it now (`core/sample/templates/face-artwork.js`).
export const HAT = accessory('hat', 'Hat', 'A top hat.',
  `<path id="accessory" data-name="Hat" d="M40 42 L200 42 L200 34 Q120 20 40 34 Z M66 36 L66 -30 Q120 -42 174 -30 L174 36 Z" fill="${PRIMARY}" stroke="${SECONDARY}" stroke-width="3" stroke-linejoin="round" />`,
  { mountPoint: 'head.top', box: { x: 40, y: -42, width: 160, height: 84 }, turn: { depth: 0.2, side: null, squash: true }, paletteRoles: { accessory: { fill: 'accessoryPrimary', stroke: 'accessorySecondary' } } });
// Drawn inside the ear, so what it says about the turn is what the ear
// already says: a profile is still worth declaring, because a face whose ears
// are a pair of lone shapes has nothing to draw it inside and the earring is a
// sibling there, turning on its own word (V3-02).
export const EARRING = accessory('earring', 'Left earring', 'A ring on the left ear.',
  `<circle id="accessory" data-name="Earring" cx="27" cy="144" r="6" fill="none" stroke="${SECONDARY}" stroke-width="3" />`,
  { mountPoint: 'ear.left', host: { part: 'ears', role: 'leftEar' }, box: { x: 21, y: 138, width: 12, height: 12 }, turn: { depth: 0.15, side: 'left', ear: true, sweeps: true, tilt: 0.35 }, paletteRoles: { accessory: { stroke: 'accessorySecondary' } } });
export const EARRING_RIGHT = accessory('earring-right', 'Right earring', 'A ring on the right ear.',
  `<circle id="accessory" data-name="Earring" cx="213" cy="144" r="6" fill="none" stroke="${SECONDARY}" stroke-width="3" />`,
  { mountPoint: 'ear.right', host: { part: 'ears', role: 'rightEar' }, box: { x: 207, y: 138, width: 12, height: 12 }, turn: { depth: 0.15, side: 'right', ear: true, sweeps: true, tilt: 0.35 }, paletteRoles: { accessory: { stroke: 'accessorySecondary' } } });
export const BOW_TIE = accessory('bow-tie', 'Bow tie', 'A bow tie under the chin.',
  `<path id="accessory" data-name="Bow tie" d="M92 206 L114 216 L114 230 L92 240 Z M148 206 L126 216 L126 230 L148 240 Z M114 217 L126 217 L126 229 L114 229 Z" fill="${PRIMARY}" stroke="${SECONDARY}" stroke-width="2" stroke-linejoin="round" />`,
  { mountPoint: 'head.bottom', box: { x: 92, y: 206, width: 56, height: 34 }, turn: { depth: 0.55, side: null, narrow: true }, paletteRoles: { accessory: { fill: 'accessoryPrimary', stroke: 'accessorySecondary' } } });

export const ACCESSORIES = Object.freeze([GLASSES, SQUARE_GLASSES, HAT, EARRING, EARRING_RIGHT, BOW_TIE]);
