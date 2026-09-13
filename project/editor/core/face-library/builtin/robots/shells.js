/**
 * Robot head shells: the bare skull, and nothing on it.
 *
 * "Pièces séparées par type de mascotte" — the planche's own caption, and the
 * same shape the rest of this library has: a shell is the case and the face
 * plate, and every fitting on it (the lights, the grille, the warning stripe)
 * is its own piece.
 *
 * Drawn where the human skulls are drawn — the face's middle at 120, 116 — so a
 * shell and a person's head fit the same face at the same size.
 *
 * **A shell ships no jaw.** Every other head in the library carries a `jaw`
 * part: the same outline drawn twice, at rest and with its chin stretched down
 * by `jawOpen`. A bolted plate does not stretch, and pretending otherwise would
 * put a control in the UI that makes a machine look like it is chewing. So
 * `jawOpen` moves nothing on a robot face — which is what a rigid head means,
 * rather than something the rig has to be told.
 */
import { boltRing, boxPath, ovalPath, round, unionBox } from './shapes.js';

const SHELL = '#f5f7fa', SEAM = '#d7dee6', LINE = '#33373a', FACE = '#23272e';

const shell = (slug, name, description, artwork, box, { tags, palette, paletteRoles }) => Object.freeze({
  id: `head.robot-${slug}`, category: 'head', name, description, origin: 'builtin',
  artwork: `<g id="head-robot-${slug}" data-name="Head">${artwork}</g>`,
  roles: Object.freeze({ head: 'skull' }),
  capabilities: Object.freeze(['headX', 'headY', 'headTilt']),
  paletteRoles: Object.freeze(paletteRoles),
  referenceBox: Object.freeze(box),
  mountPoint: 'head.center',
  palette: Object.freeze(palette),
  slot: 'head', morphologies: Object.freeze(['robot']), tags: Object.freeze(['robot', ...tags])
});

/**
 * Écran — one dark screen for a face.
 *
 * The whole front is the display: a pale case with a deep inset panel that the
 * eyes and the mouth are drawn *on* rather than set into. The only shell whose
 * face is one continuous surface.
 */
const SCREEN_CASE = { x: 26, y: 38, width: 188, height: 156 };
const SCREEN_FACE = { x: 42, y: 52, width: 156, height: 128 };
export const HEAD_ROBOT_SCREEN_ROUNDED = shell('screen-rounded', 'Screen shell', 'A wide rounded case whose whole face is a dark screen.',
  `<path id="skull" data-name="Skull" d="${boxPath(SCREEN_CASE.x, SCREEN_CASE.y, SCREEN_CASE.width, SCREEN_CASE.height, 34)}" fill="${SHELL}" stroke="${LINE}" stroke-width="4" stroke-linejoin="round" />`
  + `<path id="screen" data-name="Screen" d="${boxPath(SCREEN_FACE.x, SCREEN_FACE.y, SCREEN_FACE.width, SCREEN_FACE.height, 24)}" fill="${FACE}" />`,
  unionBox(SCREEN_CASE, SCREEN_FACE),
  { tags: ['screen', 'rounded', 'modern'], palette: ['skin', 'outline', 'eyeWhite'],
    paletteRoles: { skull: Object.freeze({ fill: 'skin', stroke: 'outline' }), screen: Object.freeze({ fill: 'eyeWhite' }) } });

/**
 * Rétro — a square caisson with a seam across the crown.
 *
 * Square where the others are round, and the only shell with a visible panel
 * join. The planche draws it cream, sage and red: one silhouette, three
 * colours, so one drawing and three palettes.
 */
const RETRO_CASE = { x: 32, y: 40, width: 176, height: 156 };
export const HEAD_ROBOT_RETRO_SQUARE = shell('retro-square', 'Retro shell', 'A square caisson with soft corners and a panel seam across the top.',
  `<path id="skull" data-name="Skull" d="${boxPath(RETRO_CASE.x, RETRO_CASE.y, RETRO_CASE.width, RETRO_CASE.height, 16)}" fill="${SHELL}" stroke="${LINE}" stroke-width="4" stroke-linejoin="round" />`
  + `<path id="seam" data-name="Panel seam" d="M40 62 L200 62" fill="none" stroke="${SEAM}" stroke-width="3" stroke-linecap="round" />`
  + `<path id="rivets" data-name="Rivets" d="${ovalPath(46, 52, 3.4, 3.4)} ${ovalPath(194, 52, 3.4, 3.4)} ${ovalPath(46, 184, 3.4, 3.4)} ${ovalPath(194, 184, 3.4, 3.4)}" fill="${SEAM}" />`,
  RETRO_CASE,
  { tags: ['retro', 'square', 'vintage'], palette: ['skin', 'outline', 'skinShadow'],
    paletteRoles: { skull: Object.freeze({ fill: 'skin', stroke: 'outline' }), seam: Object.freeze({ stroke: 'skinShadow' }), rivets: Object.freeze({ fill: 'skinShadow' }) } });

/**
 * Industriel — a bolted plate with a carrying handle.
 *
 * The only shell with fasteners and the only one you could pick up. Heavier and
 * squarer than the retro caisson, and the bolts are one path rather than
 * sixteen elements: a role names one element, and sixteen bolts that each moved
 * on their own would be sixteen things to rig for no expressive gain.
 */
const PLATE = { x: 30, y: 44, width: 180, height: 152 };
const HANDLE = { x: 94, y: 22, width: 52, height: 24 };
export const HEAD_ROBOT_INDUSTRIAL_PLATE = shell('industrial-plate', 'Industrial shell', 'A bolted metal plate with a carrying handle across the crown.',
  `<path id="handle" data-name="Handle" d="M${HANDLE.x} ${HANDLE.y + HANDLE.height} L${HANDLE.x} ${HANDLE.y + 9} C${HANDLE.x} ${HANDLE.y - 3} ${HANDLE.x + HANDLE.width} ${HANDLE.y - 3} ${HANDLE.x + HANDLE.width} ${HANDLE.y + 9} L${HANDLE.x + HANDLE.width} ${HANDLE.y + HANDLE.height}" fill="none" stroke="${LINE}" stroke-width="9" stroke-linecap="round" />`
  + `<path id="skull" data-name="Skull" d="${boxPath(PLATE.x, PLATE.y, PLATE.width, PLATE.height, 10)}" fill="${SHELL}" stroke="${LINE}" stroke-width="4" stroke-linejoin="round" />`
  + `<path id="bolts" data-name="Bolts" d="${[[44, 58], [196, 58], [44, 182], [196, 182]].map(([bx, by]) => ovalPath(bx, by, 4.2, 4.2)).join(' ')}" fill="${SEAM}" />`,
  unionBox(PLATE, { ...HANDLE, y: HANDLE.y - 6, height: HANDLE.height + 6 }),
  { tags: ['industrial', 'plate', 'robust'], palette: ['skin', 'outline', 'skinShadow'],
    paletteRoles: { skull: Object.freeze({ fill: 'skin', stroke: 'outline' }), handle: Object.freeze({ stroke: 'outline' }), bolts: Object.freeze({ fill: 'skinShadow' }) } });

/**
 * Jouet — the friendliest silhouette of the four.
 *
 * Round with a wide pale face plate, and the only shell with no hard corner
 * anywhere. Three colours on the planche, one shape: one drawing.
 */
const TOY_CASE = { x: 28, y: 36, width: 184, height: 160 };
const TOY_FACE = { x: 48, y: 54, width: 144, height: 124 };
export const HEAD_ROBOT_TOY_ROUND = shell('toy-round', 'Toy shell', 'A soft round shell with a wide pale face plate.',
  `<path id="skull" data-name="Skull" d="${boxPath(TOY_CASE.x, TOY_CASE.y, TOY_CASE.width, TOY_CASE.height, 58)}" fill="${SHELL}" stroke="${LINE}" stroke-width="4" stroke-linejoin="round" />`
  + `<path id="screen" data-name="Face plate" d="${boxPath(TOY_FACE.x, TOY_FACE.y, TOY_FACE.width, TOY_FACE.height, 48)}" fill="${SEAM}" />`,
  unionBox(TOY_CASE, TOY_FACE),
  { tags: ['toy', 'round', 'soft'], palette: ['skin', 'outline', 'skinShadow'],
    paletteRoles: { skull: Object.freeze({ fill: 'skin', stroke: 'outline' }), screen: Object.freeze({ fill: 'skinShadow' }) } });

export const ROBOT_SHELLS = Object.freeze([
  HEAD_ROBOT_SCREEN_ROUNDED, HEAD_ROBOT_RETRO_SQUARE, HEAD_ROBOT_INDUSTRIAL_PLATE, HEAD_ROBOT_TOY_ROUND
]);

export { boltRing, round };
