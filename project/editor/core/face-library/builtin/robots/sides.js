/**
 * Robot side modules — the planche's *Modules latéraux*, installed as `ears`.
 *
 * The pilot's first mapping decision (MASC-11A), and the reason it went this
 * way: a module where an ear goes takes `earWiggle` for nothing, and under
 * `panels` it would have been flat decoration with no control at all. A speaker
 * cone that twitches is worth a slot line; one that cannot is worth nothing.
 *
 * Drawn where the shipped pairs are drawn — at the sides of the head at y 118 —
 * and behind the shell, so the inner half of each module tucks under the case
 * and only what stands proud of it shows. That is what makes one read as bolted
 * on rather than as a sticker, and it is why they sit further out than a
 * person's ears do: a shell is wider than a skull, and a module that cleared a
 * skull would disappear behind a case.
 *
 * Each side is a `<g>` wrapper, as the shipped pairs are, so an earring still
 * has somewhere to hang and the thing that wiggles is the thing that carries it.
 */
import { boltRing, boxPath, ovalPath, round } from './shapes.js';

const SHELL = '#f5f7fa', SEAM = '#d7dee6', LINE = '#33373a';
const at = (sign, offset) => round(120 + sign * offset);
const CY = 118;

const sides = (slug, name, description, draw, box, { tags, parts }) => Object.freeze({
  id: `ears.robot-${slug}`, category: 'ears', name, description, origin: 'builtin',
  artwork: `<g id="ears-robot-${slug}" data-name="Side modules">`
    + `<g id="earLeft" data-name="Left side module">${draw(-1, 'Left')}</g>`
    + `<g id="earRight" data-name="Right side module">${draw(1, 'Right')}</g></g>`,
  roles: Object.freeze({ leftEar: 'earLeft', rightEar: 'earRight' }),
  capabilities: Object.freeze(['earWiggle']),
  // Where an animal's ears stand on the crown and sweep right round, these sit
  // at the sides of the head exactly where a person's ears do — so they take
  // the reading the shipped pairs take, and say nothing.
  paletteRoles: Object.freeze(Object.fromEntries(['Left', 'Right'].flatMap((side) => parts.map((part) => [`ear${side}${part.id}`, Object.freeze(part.paint)])))),
  referenceBox: Object.freeze(box),
  mountPoint: 'ears',
  palette: Object.freeze([...new Set(parts.flatMap((part) => Object.values(part.paint)))]),
  slot: 'ears', morphologies: Object.freeze(['robot']), tags: Object.freeze(['robot', ...tags])
});

const SHAPE = { id: 'Shape', paint: { fill: 'skin', stroke: 'outline' } };
const INNER = { id: 'Inner', paint: { fill: 'skinShadow' } };
const LIT = { id: 'Lit', paint: { fill: 'pupil' } };
const BOLTS = { id: 'Bolts', paint: { fill: 'outline' } };

/** Écran — a lit ring around a dark centre: the only pair that is lit rather than mechanical. */
export const EARS_ROBOT_SCREEN_ROUND = sides('screen-round', 'Screen side module', 'A round module a side, a lit ring around a dark centre.',
  (sign, side) => {
    const cx = at(sign, 98);
    return `<path id="ear${side}Shape" data-name="${side} module" d="${ovalPath(cx, CY, 17, 17)}" fill="${SHELL}" stroke="${LINE}" stroke-width="3.5" />`
      + `<path id="ear${side}Lit" data-name="${side} module light" d="${ovalPath(cx, CY, 10, 10)}" fill="#37c9e8" />`
      + `<path id="ear${side}Inner" data-name="${side} module centre" d="${ovalPath(cx, CY, 5, 5)}" fill="${SEAM}" />`;
  },
  { x: 5, y: 101, width: 230, height: 34 }, { tags: ['screen', 'round', 'lit'], parts: [SHAPE, LIT, INNER] });

/** Rétro — a drum on a short post: the only pair mounted on something visible. */
export const EARS_ROBOT_RETRO_ROUND = sides('retro-round', 'Retro side module', 'A drum a side on a short post, like a speaker cone bolted to the caisson.',
  (sign, side) => {
    const cx = at(sign, 100), post = at(sign, 82);
    return `<path id="ear${side}Inner" data-name="${side} module post" d="${boxPath(Math.min(post, cx), CY - 5, Math.abs(cx - post), 10, 3)}" fill="${SEAM}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" />`
      + `<path id="ear${side}Shape" data-name="${side} module" d="${ovalPath(cx, CY, 15, 19)}" fill="${SHELL}" stroke="${LINE}" stroke-width="3.5" />`
      + `<path id="ear${side}Lit" data-name="${side} module cone" d="${ovalPath(cx, CY, 7, 10)}" fill="#d1453f" />`;
  },
  { x: 5, y: 99, width: 230, height: 38 }, { tags: ['retro', 'drum', 'speaker'], parts: [SHAPE, LIT, INNER] });

/** Industriel — a bolted disc flush with the plate: the flattest of the four. */
export const EARS_ROBOT_INDUSTRIAL_BOLT = sides('industrial-bolt', 'Industrial side module', 'A bolted disc a side, flush with the plate and ringed with fasteners.',
  (sign, side) => {
    const cx = at(sign, 96);
    return `<path id="ear${side}Shape" data-name="${side} module" d="${ovalPath(cx, CY, 16, 16)}" fill="${SHELL}" stroke="${LINE}" stroke-width="3.5" />`
      + `<path id="ear${side}Inner" data-name="${side} module hub" d="${ovalPath(cx, CY, 7, 7)}" fill="${SEAM}" />`
      + `<path id="ear${side}Bolts" data-name="${side} module bolts" d="${boltRing(cx, CY, 11.5, 6, 2.2)}" fill="${LINE}" />`;
  },
  { x: 8, y: 102, width: 224, height: 32 }, { tags: ['industrial', 'bolt', 'disc'], parts: [SHAPE, INNER, BOLTS] });

/** Jouet — a ball on a stub: drawn as a toy knob rather than a machined part. */
export const EARS_ROBOT_TOY_COLORFUL = sides('toy-colorful', 'Toy side module', 'A bright knob a side, a ball on a short stub.',
  (sign, side) => {
    const cx = at(sign, 100), stub = at(sign, 84);
    return `<path id="ear${side}Inner" data-name="${side} module stub" d="${boxPath(Math.min(stub, cx), CY - 6, Math.abs(cx - stub), 12, 5)}" fill="${SEAM}" stroke="${LINE}" stroke-width="2.5" stroke-linejoin="round" />`
      + `<path id="ear${side}Shape" data-name="${side} module" d="${ovalPath(cx, CY, 16, 16)}" fill="${SHELL}" stroke="${LINE}" stroke-width="3.5" />`
      + `<path id="ear${side}Lit" data-name="${side} module cap" d="${ovalPath(cx, CY, 7.5, 7.5)}" fill="#3f8fd8" />`;
  },
  { x: 4, y: 102, width: 232, height: 32 }, { tags: ['toy', 'knob', 'bright'], parts: [SHAPE, LIT, INNER] });

export const ROBOT_SIDES = Object.freeze([
  EARS_ROBOT_SCREEN_ROUND, EARS_ROBOT_RETRO_ROUND, EARS_ROBOT_INDUSTRIAL_BOLT, EARS_ROBOT_TOY_COLORFUL
]);
