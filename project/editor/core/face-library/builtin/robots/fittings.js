/**
 * The two slots that make a robot a robot: the antenna on the crown and the
 * panel on the shell.
 *
 * Both are `accessory` to the rig and rows of their own on screen, exactly as a
 * muzzle and a pair of whiskers are. They have been in `FACE_SLOTS` since
 * MASC-01 and empty ever since; these are the first drawings either has had,
 * and between them they are what turns `robot` on in the Type row.
 *
 * The anchors are the candidates MASC-09 proposed (docs/FACE_ASSET_AUTHORING.md):
 *
 * ```text
 * antenna  head.top     120, 22   — above the crown, into the artboard's headroom
 * panels   head.center  120, 116  — on the shell, the same anchor the shell uses
 * ```
 *
 * The panel sharing its anchor with the head is the muzzle's problem inverted,
 * and it costs nothing: an accessory installed with nothing before it lands
 * last in its group, which is on top of the shell — where a panel wants to be.
 */
import { barField, boltRing, boxPath, dotField, ovalPath, round, starPath } from './shapes.js';

const SHELL = '#f5f7fa', SEAM = '#d7dee6', LINE = '#33373a';
const at = (sign, offset) => round(120 + sign * offset);

const fitting = (slot, mountPoint, depth) => (slug, name, description, artwork, box, { tags, palette, paletteRoles }) => Object.freeze({
  id: `accessory.${slug}`, category: 'accessory', name, description, origin: 'builtin',
  artwork: `<g id="${slug}" data-name="${name}">${artwork}</g>`,
  roles: Object.freeze({ element: 'accessory' }),
  capabilities: Object.freeze([]),
  // An accessory that says nothing about the 2.5D turn does not turn at all,
  // and there is no row in the role table that could ever answer for one. An
  // antenna stands well off the crown and sweeps round like an ear; a panel is
  // flush with the shell and barely moves relative to it.
  turn: Object.freeze({ element: Object.freeze({ depth, side: null, narrow: true }) }),
  paletteRoles: Object.freeze(Object.fromEntries(Object.entries(paletteRoles).map(([id, entry]) => [id, Object.freeze({ ...entry })]))),
  referenceBox: Object.freeze(box),
  mountPoint,
  slot, morphologies: Object.freeze(['robot']), tags: Object.freeze(['robot', ...tags]),
  palette: Object.freeze(palette)
});

/* ── Antennae ──────────────────────────────────────────────────────────
 * On the crown, above the shell, standing into the 60 units of headroom the
 * artboard keeps above y 0 — the same headroom the hat's crown uses.
 */
const antenna = fitting('antenna', 'head.top', 0.35);

const stalk = (x1, y1, x2, y2, width = 5) => `M${x1} ${y1} L${x2} ${y2}`;

/** Écran — one short stalk with a lit ball: the plainest of the four. */
export const ANTENNA_SINGLE_SHORT = antenna('antenna-single-short', 'Single short antenna', 'One short stalk with a lit ball on it.',
  `<path id="accessory" data-name="Stalk" d="${stalk(120, 40, 120, 8)}" fill="none" stroke="${LINE}" stroke-width="5" stroke-linecap="round" />`
  + `<path id="tip" data-name="Tip" d="${ovalPath(120, 2, 10, 10)}" fill="#37c9e8" stroke="${LINE}" stroke-width="3" />`,
  { x: 107, y: -11, width: 26, height: 51 },
  { tags: ['screen', 'antenna', 'single'], palette: ['outline', 'accessoryPrimary'],
    paletteRoles: { accessory: { stroke: 'outline' }, tip: { fill: 'accessoryPrimary', stroke: 'outline' } } });

/** Rétro — the only family with two balls: a U of stalks off one mast. */
export const ANTENNA_RETRO_MULTI = antenna('antenna-retro-multi', 'Retro multi antenna', 'A two-balled U on a short mast.',
  `<path id="accessory" data-name="Mast" d="${stalk(120, 42, 120, 22)} M${at(-1, 20)} 22 L${at(1, 20)} 22 M${at(-1, 20)} 22 L${at(-1, 20)} 6 M${at(1, 20)} 22 L${at(1, 20)} 6" fill="none" stroke="${LINE}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />`
  + `<path id="tip" data-name="Tips" d="${ovalPath(at(-1, 20), 0, 9, 9)} ${ovalPath(at(1, 20), 0, 9, 9)}" fill="#d1453f" stroke="${LINE}" stroke-width="3" />`,
  { x: 88, y: -12, width: 64, height: 54 },
  { tags: ['retro', 'antenna', 'multi'], palette: ['outline', 'accessoryPrimary'],
    paletteRoles: { accessory: { stroke: 'outline' }, tip: { fill: 'accessoryPrimary', stroke: 'outline' } } });

/** Industriel — the only family with no ball at all: it is a post, not an aerial. */
export const ANTENNA_INDUSTRIAL_ROBUST = antenna('antenna-industrial-robust', 'Industrial antenna', 'A stubby bolted post with a segmented collar.',
  `<path id="accessory" data-name="Post" d="${boxPath(112, 6, 16, 38, 3)}" fill="${SHELL}" stroke="${LINE}" stroke-width="3.5" stroke-linejoin="round" />`
  + `<path id="tip" data-name="Collar" d="${boxPath(104, 12, 32, 7, 2)} ${boxPath(104, 24, 32, 7, 2)}" fill="${SEAM}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" />`
  + `<path id="bolts" data-name="Base bolts" d="${ovalPath(114, 40, 2.4, 2.4)} ${ovalPath(126, 40, 2.4, 2.4)}" fill="${LINE}" />`,
  { x: 102, y: 4, width: 36, height: 40 },
  { tags: ['industrial', 'antenna', 'post'], palette: ['skin', 'outline', 'accessorySecondary'],
    paletteRoles: { accessory: { fill: 'skin', stroke: 'outline' }, tip: { fill: 'accessorySecondary', stroke: 'outline' }, bolts: { fill: 'outline' } } });

/** Jouet — the only family whose tip is a star. */
export const ANTENNA_TOY_FUN = antenna('antenna-toy-fun', 'Toy antenna', 'A star on a soft stalk.',
  `<path id="accessory" data-name="Stalk" d="${stalk(120, 42, 120, 12)}" fill="none" stroke="${LINE}" stroke-width="5.5" stroke-linecap="round" />`
  + `<path id="tip" data-name="Star" d="${starPath(120, 2, 15)}" fill="#f5c93f" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" />`,
  { x: 103, y: -15, width: 34, height: 57 },
  { tags: ['toy', 'antenna', 'star'], palette: ['outline', 'accessorySecondary'],
    paletteRoles: { accessory: { stroke: 'outline' }, tip: { fill: 'accessorySecondary', stroke: 'outline' } } });

export const ROBOT_ANTENNAE = Object.freeze([
  ANTENNA_SINGLE_SHORT, ANTENNA_RETRO_MULTI, ANTENNA_INDUSTRIAL_ROBUST, ANTENNA_TOY_FUN
]);

/* ── Panels ────────────────────────────────────────────────────────────
 * On the shell, low and to one side of the mouth, where a chest plate would be
 * on a body and where a maker's plate is on a machine. Drawn small and off the
 * centre line so the mouth keeps the middle.
 */
const panel = fitting('panels', 'head.center', 0.08);
const PANEL_Y = 140;

/** Écran — the only panel that is itself lit. */
export const PANELS_LIGHT_PANEL = panel('panels-light-panel', 'Light panel', 'A pale inset panel with a lit indicator on it.',
  `<path id="accessory" data-name="Panel" d="${boxPath(48, PANEL_Y, 34, 22, 6)}" fill="${SEAM}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" />`
  + `<path id="detail" data-name="Indicator" d="${ovalPath(59, PANEL_Y + 11, 4, 4)} ${ovalPath(71, PANEL_Y + 11, 4, 4)}" fill="#37c9e8" />`,
  { x: 48, y: PANEL_Y, width: 34, height: 22 },
  { tags: ['screen', 'panel', 'indicator'], palette: ['skinShadow', 'outline', 'accessoryPrimary'],
    paletteRoles: { accessory: { fill: 'skinShadow', stroke: 'outline' }, detail: { fill: 'accessoryPrimary' } } });

/** Rétro — the only panel with a dial on it. */
export const PANELS_RETRO_BUTTONS = panel('panels-retro-buttons', 'Retro buttons', 'A gauge dial beside three coloured buttons.',
  `<path id="accessory" data-name="Panel" d="${boxPath(46, PANEL_Y - 2, 40, 26, 4)}" fill="${SEAM}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" />`
  + `<path id="detail" data-name="Dial" d="${ovalPath(58, PANEL_Y + 11, 8, 8)}" fill="${SHELL}" stroke="${LINE}" stroke-width="2" />`
  + `<path id="needle" data-name="Needle" d="M58 ${PANEL_Y + 11} L63 ${PANEL_Y + 6}" fill="none" stroke="${LINE}" stroke-width="2" stroke-linecap="round" />`
  + `<path id="buttons" data-name="Buttons" d="${ovalPath(76, PANEL_Y + 5, 3.4, 3.4)} ${ovalPath(76, PANEL_Y + 16, 3.4, 3.4)}" fill="#d1453f" />`,
  { x: 46, y: PANEL_Y - 2, width: 40, height: 26 },
  { tags: ['retro', 'panel', 'buttons'], palette: ['skinShadow', 'outline', 'skin', 'accessoryPrimary'],
    paletteRoles: { accessory: { fill: 'skinShadow', stroke: 'outline' }, detail: { fill: 'skin', stroke: 'outline' }, needle: { stroke: 'outline' }, buttons: { fill: 'accessoryPrimary' } } });

/** Industriel — the only panel that carries a marking rather than a fitting. */
export const PANELS_WARNING_STRIPE = panel('panels-warning-stripe', 'Warning stripe', 'A yellow-and-black hazard stripe on a bolted plate.',
  `<path id="accessory" data-name="Panel" d="${boxPath(44, PANEL_Y, 44, 22, 2)}" fill="#f0c02c" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" />`
  + `<path id="detail" data-name="Hazard stripe" d="${barField(48, PANEL_Y + 4, 36, 14, 4, { gap: 0.5, radius: 0 })}" fill="${LINE}" />`
  + `<path id="bolts" data-name="Plate bolts" d="${ovalPath(48, PANEL_Y + 3, 1.8, 1.8)} ${ovalPath(84, PANEL_Y + 19, 1.8, 1.8)}" fill="${LINE}" />`,
  { x: 44, y: PANEL_Y, width: 44, height: 22 },
  { tags: ['industrial', 'panel', 'hazard'], palette: ['accessoryPrimary', 'outline'],
    paletteRoles: { accessory: { fill: 'accessoryPrimary', stroke: 'outline' }, detail: { fill: 'outline' }, bolts: { fill: 'outline' } } });

/** Jouet — drawn as a badge rather than as instrumentation. */
export const PANELS_TOY_BUTTONS = panel('panels-toy-buttons', 'Toy buttons', 'A star badge over three coloured dots.',
  `<path id="accessory" data-name="Badge" d="${boxPath(48, PANEL_Y, 38, 24, 11)}" fill="${SEAM}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" />`
  + `<path id="detail" data-name="Star" d="${starPath(60, PANEL_Y + 12, 8)}" fill="#f5c93f" stroke="${LINE}" stroke-width="1.8" stroke-linejoin="round" />`
  + `<path id="dots" data-name="Dots" d="${ovalPath(76, PANEL_Y + 7, 3.4, 3.4)} ${ovalPath(76, PANEL_Y + 17, 3.4, 3.4)}" fill="#e04a48" />`,
  { x: 48, y: PANEL_Y, width: 38, height: 24 },
  { tags: ['toy', 'panel', 'badge'], palette: ['skinShadow', 'outline', 'accessorySecondary', 'accessoryPrimary'],
    paletteRoles: { accessory: { fill: 'skinShadow', stroke: 'outline' }, detail: { fill: 'accessorySecondary', stroke: 'outline' }, dots: { fill: 'accessoryPrimary' } } });

export const ROBOT_PANELS = Object.freeze([
  PANELS_LIGHT_PANEL, PANELS_RETRO_BUTTONS, PANELS_WARNING_STRIPE, PANELS_TOY_BUTTONS
]);

export { boltRing, dotField };
