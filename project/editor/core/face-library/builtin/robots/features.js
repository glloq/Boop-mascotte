/**
 * The robot's visors and its speakers: the two rows that keep a machine's face
 * running on the controls a person's face runs on.
 *
 * A visor above the eyes is a brow — it raises and it tilts, which are exactly
 * the two controls `eyebrows` already carries — and a speaker is a mouth:
 * `mouthOpen`, `smile` and `mouthWidth` mean the same thing on a grille as on a
 * lip, which is why no new control is added anywhere in this pack.
 *
 * Drawn on the template's own lines: the brows at 81, the mouth at 176.
 */
import { barField, boltRing, boxPath, dotField, ovalPath, round } from './shapes.js';

const SHELL = '#f5f7fa', SEAM = '#d7dee6', LINE = '#33373a', GROUND = '#23272e';
const at = (sign, offset) => round(120 + sign * offset);

/* ── Visors ────────────────────────────────────────────────────────────
 * A pair, mirrored, as every brow in the library is. The industrial one is a
 * single heavy visor on the planche, and it is still drawn as two halves that
 * meet at the middle (MASC-11A): `eyebrows` needs `leftBrow` and `rightBrow` so
 * the two can raise independently, and a visor that raises as one piece is two
 * halves that happen to move together — which is what `browRaise` does anyway.
 */
const visor = (slug, name, description, draw, box, { tags, parts }) => Object.freeze({
  id: `eyebrows.robot-${slug}`, category: 'eyebrows', name, description, origin: 'builtin',
  artwork: `<g id="brows-robot-${slug}" data-name="Visor">${draw(-1, 'Left')}${draw(1, 'Right')}</g>`,
  roles: Object.freeze({ leftBrow: 'browLeft', rightBrow: 'browRight' }),
  capabilities: Object.freeze(['browRaise', 'browTilt']),
  paletteRoles: Object.freeze(Object.fromEntries(['Left', 'Right'].flatMap((side) => parts.map((part) => [`brow${side}${part.id}`, Object.freeze(part.paint)])))),
  referenceBox: Object.freeze(box),
  mountPoint: 'brows',
  palette: Object.freeze([...new Set(parts.flatMap((part) => Object.values(part.paint)))]),
  slot: 'eyebrows', morphologies: Object.freeze(['robot']), tags: Object.freeze(['robot', ...tags])
});

const PLATE = { id: '', paint: { fill: 'skinShadow', stroke: 'outline' } };

/**
 * Écran — a lit bar, and the one place the planche had to be read rather than
 * copied. It draws a dark bar, which is right on paper and invisible on the
 * shell this family actually has: the whole face is a dark screen, and a dark
 * bar on it is nothing at all. On a screen, what reads is what is lit — so the
 * brow takes `pupil`, the same token as the eyes and the smile, and the family
 * keeps its one rule: everything that moves is light.
 */
export const BROWS_ROBOT_SCREEN_SIMPLE = visor('screen-simple', 'Screen brow', 'A lit bar a side, drawn on the screen.',
  (sign, side) => `<path id="brow${side}" data-name="${side} brow" d="${boxPath(Math.min(at(sign, 14), at(sign, 56)), 76, 42, 7, 3.5)}" fill="#37c9e8" />`,
  { x: 64, y: 76, width: 112, height: 7 }, { tags: ['screen', 'bar', 'lit'], parts: [{ id: '', paint: { fill: 'pupil' } }] });

/** Rétro — a blunt rectangular plate standing proud of the caisson. */
export const BROWS_ROBOT_RETRO_PLATE = visor('retro-plate', 'Retro brow plate', 'A blunt rectangular plate a side, sitting proud of the caisson.',
  (sign, side) => `<path id="brow${side}" data-name="${side} brow" d="${boxPath(Math.min(at(sign, 12), at(sign, 54)), 74, 42, 11, 2)}" fill="${SEAM}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" />`,
  { x: 66, y: 73, width: 108, height: 13 }, { tags: ['retro', 'plate', 'blunt'], parts: [PLATE] });

/** Industriel — a heavy visor with a bolt at the outer end, the two halves meeting at the middle. */
export const BROWS_ROBOT_INDUSTRIAL_VISOR = visor('industrial-visor', 'Industrial visor', 'A heavy bolted visor a side, the two halves meeting over the nose.',
  (sign, side) => {
    const inner = at(sign, 2), outer = at(sign, 58);
    return `<path id="brow${side}" data-name="${side} brow" d="M${inner} 70 L${outer} 74 L${outer} 87 L${inner} 82 Z" fill="${SEAM}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" />`
      + `<path id="brow${side}Bolts" data-name="${side} brow bolts" d="${ovalPath(at(sign, 50), 80.5, 2.6, 2.6)}" fill="${LINE}" />`;
  },
  { x: 60, y: 69, width: 120, height: 19 }, { tags: ['industrial', 'visor', 'heavy'], parts: [{ id: '', paint: { fill: 'skinShadow', stroke: 'outline' } }, { id: 'Bolts', paint: { fill: 'outline' } }] });

/** Jouet — a soft arc, thick in the middle and tapered at both ends. */
export const BROWS_ROBOT_TOY_CUTE = visor('toy-cute', 'Toy brow', 'A soft curved arc a side, tapered at both ends.',
  (sign, side) => `<path id="brow${side}" data-name="${side} brow" d="M${at(sign, 14)} 84 Q${at(sign, 36)} 71 ${at(sign, 58)} 80" fill="none" stroke="${GROUND}" stroke-width="6" stroke-linecap="round" />`,
  { x: 59, y: 72, width: 122, height: 15 }, { tags: ['toy', 'arc', 'soft'], parts: [{ id: '', paint: { stroke: 'outline' } }] });

export const ROBOT_VISORS = Object.freeze([
  BROWS_ROBOT_SCREEN_SIMPLE, BROWS_ROBOT_RETRO_PLATE, BROWS_ROBOT_INDUSTRIAL_VISOR, BROWS_ROBOT_TOY_CUTE
]);

/* ── Mouths ────────────────────────────────────────────────────────────
 * A speaker is a mouth. Drawn on the lip line at 176, and every one of them
 * carries `mouthOpen`, `smile` and `mouthWidth` — the same three a person's
 * mouth carries, because a grille that widens when the mascot speaks is
 * exactly what a grille is for.
 */
const mouth = (slug, name, description, shapes, { roles, capabilities, box, palette, paletteRoles, tags }) => Object.freeze({
  id: `mouth.robot-${slug}`, category: 'mouth', name, description, origin: 'builtin',
  artwork: `<g id="mouth-robot-${slug}" data-name="Mouth">${shapes}</g>`,
  roles: Object.freeze(roles),
  capabilities: Object.freeze(capabilities),
  paletteRoles: Object.freeze(Object.fromEntries(Object.entries(paletteRoles).map(([id, entry]) => [id, Object.freeze({ ...entry })]))),
  referenceBox: Object.freeze(box),
  mountPoint: 'mouth.center',
  slot: 'mouth', morphologies: Object.freeze(['robot']), tags: Object.freeze(['robot', ...tags]),
  palette: Object.freeze(palette)
});

/** Écran — a lit smile inside a dark panel: the only mouth that is lit rather than cut. */
export const MOUTH_ROBOT_DISPLAY = mouth('display', 'Display mouth', 'A dark panel with a lit smile inside it.',
  `<path id="mouth" data-name="Mouth" d="${boxPath(86, 164, 68, 26, 10)}" fill="${GROUND}" />`
  + `<path id="speaker" data-name="Lit smile" d="M99 172 Q120 186 141 172" fill="none" stroke="#37c9e8" stroke-width="4.5" stroke-linecap="round" />`,
  { roles: { mouth: 'mouth' }, capabilities: ['mouthOpen', 'smile', 'mouthWidth'], box: { x: 86, y: 164, width: 68, height: 26 },
    palette: ['mouth', 'pupil'], paletteRoles: { mouth: { fill: 'mouth' }, speaker: { stroke: 'pupil' } }, tags: ['screen', 'display', 'lit'] });

/** Rétro — vertical bars, where the industrial vent runs horizontal. */
export const MOUTH_ROBOT_RETRO_GRILLE = mouth('retro-grille', 'Retro grille', 'A speaker grille of vertical bars in a rounded capsule.',
  `<path id="mouth" data-name="Mouth" d="${boxPath(88, 166, 64, 24, 11)}" fill="${GROUND}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" />`
  + `<path id="speaker" data-name="Grille bars" d="${barField(96, 171, 48, 14, 6)}" fill="${SEAM}" />`,
  { roles: { mouth: 'mouth' }, capabilities: ['mouthOpen', 'smile', 'mouthWidth'], box: { x: 88, y: 166, width: 64, height: 24 },
    palette: ['mouth', 'outline', 'skinShadow'], paletteRoles: { mouth: { fill: 'mouth', stroke: 'outline' }, speaker: { fill: 'skinShadow' } }, tags: ['retro', 'grille', 'speaker'] });

/** Industriel — the heaviest, framed in metal on all four sides, and the only one that runs horizontal. */
export const MOUTH_ROBOT_INDUSTRIAL_VENT = mouth('industrial-vent', 'Industrial vent', 'A machined vent of horizontal louvres in a bolted frame.',
  `<path id="mouth" data-name="Mouth" d="${boxPath(86, 164, 68, 28, 4)}" fill="${GROUND}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" />`
  + `<path id="speaker" data-name="Louvres" d="${barField(93, 169, 54, 18, 4, { horizontal: true, gap: 0.38 })}" fill="${SEAM}" />`
  + `<path id="frame" data-name="Vent bolts" d="${[[91, 169], [149, 169], [91, 187], [149, 187]].map(([bx, by]) => ovalPath(bx, by, 2.2, 2.2)).join(' ')}" fill="${SEAM}" />`,
  { roles: { mouth: 'mouth' }, capabilities: ['mouthOpen', 'smile', 'mouthWidth'], box: { x: 86, y: 164, width: 68, height: 28 },
    palette: ['mouth', 'outline', 'skinShadow'], paletteRoles: { mouth: { fill: 'mouth', stroke: 'outline' }, speaker: { fill: 'skinShadow' }, frame: { fill: 'skinShadow' } }, tags: ['industrial', 'vent', 'louvre'] });

/** Jouet — the only mouth drawn as a line rather than as hardware, and the only one with a tongue. */
export const MOUTH_ROBOT_TOY_SIMPLE = mouth('toy-simple', 'Toy mouth', 'An open, friendly mouth with a tongue in it.',
  `<path id="mouth" data-name="Mouth" d="M98 172 Q120 167 142 172 Q120 194 98 172 Z" fill="${GROUND}" stroke="${LINE}" stroke-width="2.6" stroke-linejoin="round" />`
  + `<path id="tongue" data-name="Tongue" d="M106 181 Q120 177 134 181 Q120 192 106 181 Z" fill="#f39ab4" />`,
  { roles: { mouth: 'mouth', tongue: 'tongue' }, capabilities: ['mouthOpen', 'smile', 'mouthWidth', 'tongue'], box: { x: 98, y: 167, width: 44, height: 25 },
    palette: ['mouth', 'outline', 'tongue'], paletteRoles: { mouth: { fill: 'mouth', stroke: 'outline' }, tongue: { fill: 'tongue' } }, tags: ['toy', 'open', 'friendly'] });

export const ROBOT_MOUTHS = Object.freeze([
  MOUTH_ROBOT_DISPLAY, MOUTH_ROBOT_RETRO_GRILLE, MOUTH_ROBOT_INDUSTRIAL_VENT, MOUTH_ROBOT_TOY_SIMPLE
]);

export { barField, boltRing, dotField, SHELL, SEAM, LINE, GROUND, at };
