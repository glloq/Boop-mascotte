/**
 * Facial hair: a moustache under the nose, a goatee under the lip, a beard
 * around the chin, sideburns at the temples. Four mount points, so any of
 * them go together, each its own part of the rig (docs/FACE_PART_LIBRARY.md,
 * "Several at once"). Drawn over the template's face: the nose at 148, the
 * lip at 176, the chin at 210, the temples at 26 and 214.
 */
const HAIR = '#a6603c';

/**
 * Where each of these sits when the head turns (V3-02; docs/HEAD_POSE_2_5D.md,
 * "Which parts turn"). The role is `facialHair` for every one of them, so the
 * role table could never tell a moustache from sideburns: a moustache is a
 * centred feature almost as far forward as the nose it sits under, and
 * sideburns are a pair down the temples, no more forward than the hair. Each
 * drawing therefore says so itself.
 */
const facialHair = (slug, name, description, shape, { mountPoint, box, turn }) => Object.freeze({
  id: `facialhair.${slug}`, category: 'facialHair', name, description, origin: 'builtin',
  turn: Object.freeze({ facialHair: Object.freeze(turn) }),
  artwork: `<g id="facial-hair-${slug}" data-name="Facial hair">${shape}</g>`,
  roles: Object.freeze({ facialHair: 'facialHair' }),
  capabilities: Object.freeze([]),
  paletteRoles: Object.freeze({ facialHair: Object.freeze({ fill: 'hair' }) }),
  referenceBox: Object.freeze(box),
  mountPoint,
  palette: Object.freeze(['hair'])
});

export const MOUSTACHE = facialHair('moustache', 'Moustache', 'A moustache under the nose.',
  `<path id="facialHair" data-name="Moustache" d="M92 166 Q106 156 120 164 Q134 156 148 166 Q134 170 120 167 Q106 170 92 166 Z" fill="${HAIR}" />`,
  { mountPoint: 'nose.center', box: { x: 92, y: 156, width: 56, height: 14 } , turn: { depth: 0.88, side: null, narrow: true } });
export const LARGE_MOUSTACHE = facialHair('large-moustache', 'Large moustache', 'A wide handlebar moustache.',
  `<path id="facialHair" data-name="Large moustache" d="M78 170 Q98 150 120 164 Q142 150 162 170 Q152 180 134 174 Q120 170 106 174 Q88 180 78 170 Z" fill="${HAIR}" />`,
  { mountPoint: 'nose.center', box: { x: 78, y: 150, width: 84, height: 30 } , turn: { depth: 0.88, side: null, narrow: true } });
export const GOATEE = facialHair('goatee', 'Goatee', 'A tuft under the lip.',
  `<path id="facialHair" data-name="Goatee" d="M108 192 Q120 188 132 192 L128 208 Q120 214 112 208 Z" fill="${HAIR}" />`,
  { mountPoint: 'mouth.center', box: { x: 108, y: 188, width: 24, height: 26 } , turn: { depth: 0.85, side: null, narrow: true } });
export const BEARD = facialHair('beard', 'Beard', 'A full beard around the chin.',
  `<path id="facialHair" data-name="Beard" d="M40 150 Q44 200 80 214 Q120 226 160 214 Q196 200 200 150 Q184 190 150 194 Q120 192 90 194 Q56 190 40 150 Z" fill="${HAIR}" />`,
  { mountPoint: 'head.bottom', box: { x: 40, y: 150, width: 160, height: 76 } , turn: { depth: 0.5, side: null, narrow: true } });
export const SIDEBURNS = facialHair('sideburns', 'Sideburns', 'Sideburns down the temples.',
  `<path id="facialHair" data-name="Sideburns" d="M30 104 L44 100 L46 148 Q36 152 32 146 Z M210 104 L196 100 L194 148 Q204 152 208 146 Z" fill="${HAIR}" />`,
  { mountPoint: 'ears', box: { x: 30, y: 100, width: 180, height: 52 } , turn: { depth: 0.3, side: null } });

export const FACIAL_HAIR = Object.freeze([MOUSTACHE, LARGE_MOUSTACHE, GOATEE, BEARD, SIDEBURNS]);
