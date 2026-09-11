/**
 * Accessories: glasses on the eyes, a hat on top, an earring on the left
 * ear, a bow tie under the chin. Each mounts somewhere of its own, so they
 * go together, each its own part of the rig (docs/FACE_PART_LIBRARY.md,
 * "Several at once"). A hat sits in front of the hair; the rest sit where
 * they are painted, on top of the face.
 */
// Not the pupil's colour: a colour belongs to the first token seeded with it, so an accessory painted like the pupils would have no swatch of its own.
const PRIMARY = '#33424f', SECONDARY = '#c8a24a';

const accessory = (slug, name, description, shape, { mountPoint, box, depth = null, paletteRoles }) => Object.freeze({
  id: `accessory.${slug}`, category: 'accessory', name, description, origin: 'builtin',
  artwork: `<g id="accessory-${slug}" data-name="${name}">${shape}</g>`,
  roles: Object.freeze({ element: 'accessory' }),
  capabilities: Object.freeze([]),
  paletteRoles: Object.freeze(Object.fromEntries(Object.entries(paletteRoles).map(([id, roles]) => [id, Object.freeze({ ...roles })]))),
  referenceBox: Object.freeze(box),
  mountPoint,
  depth,
  palette: Object.freeze(['accessoryPrimary', 'accessorySecondary'])
});

export const GLASSES = accessory('glasses', 'Glasses', 'Round glasses on the eyes.',
  `<path id="accessory" data-name="Glasses" d="M55 113 A28 26 0 1 0 111 113 A28 26 0 1 0 55 113 Z M129 113 A28 26 0 1 0 185 113 A28 26 0 1 0 129 113 Z M111 111 Q120 104 129 111 M27 108 L55 113 M213 108 L185 113" fill="none" stroke="${PRIMARY}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`,
  { mountPoint: 'eyes', box: { x: 27, y: 87, width: 186, height: 52 }, depth: 0.6, paletteRoles: { accessory: { stroke: 'accessoryPrimary' } } });
export const SQUARE_GLASSES = accessory('square-glasses', 'Square glasses', 'Square glasses on the eyes.',
  `<path id="accessory" data-name="Square glasses" d="M57 93 L109 93 L109 133 L57 133 Z M131 93 L183 93 L183 133 L131 133 Z M109 111 Q120 106 131 111 M27 108 L57 113 M213 108 L183 113" fill="none" stroke="${PRIMARY}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />`,
  { mountPoint: 'eyes', box: { x: 27, y: 93, width: 186, height: 40 }, depth: 0.6, paletteRoles: { accessory: { stroke: 'accessoryPrimary' } } });
export const HAT = accessory('hat', 'Hat', 'A top hat.',
  `<path id="accessory" data-name="Hat" d="M40 42 L200 42 L200 34 Q120 20 40 34 Z M66 36 L66 -30 Q120 -42 174 -30 L174 36 Z" fill="${PRIMARY}" stroke="${SECONDARY}" stroke-width="3" stroke-linejoin="round" />`,
  { mountPoint: 'head.top', box: { x: 40, y: -42, width: 160, height: 84 }, depth: 0.8, paletteRoles: { accessory: { fill: 'accessoryPrimary', stroke: 'accessorySecondary' } } });
export const EARRING = accessory('earring', 'Earring', 'A ring on the left ear.',
  `<circle id="accessory" data-name="Earring" cx="27" cy="144" r="6" fill="none" stroke="${SECONDARY}" stroke-width="3" />`,
  { mountPoint: 'ear.left', box: { x: 21, y: 138, width: 12, height: 12 }, paletteRoles: { accessory: { stroke: 'accessorySecondary' } } });
export const BOW_TIE = accessory('bow-tie', 'Bow tie', 'A bow tie under the chin.',
  `<path id="accessory" data-name="Bow tie" d="M92 208 L114 218 L114 232 L92 242 Z M148 208 L126 218 L126 232 L148 242 Z M114 219 L126 219 L126 231 L114 231 Z" fill="${PRIMARY}" stroke="${SECONDARY}" stroke-width="2" stroke-linejoin="round" />`,
  { mountPoint: 'head.bottom', box: { x: 92, y: 208, width: 56, height: 34 }, paletteRoles: { accessory: { fill: 'accessoryPrimary', stroke: 'accessorySecondary' } } });

export const ACCESSORIES = Object.freeze([GLASSES, SQUARE_GLASSES, HAT, EARRING, BOW_TIE]);
