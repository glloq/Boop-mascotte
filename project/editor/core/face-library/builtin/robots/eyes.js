/**
 * Robot eyes — **the lit element is the pupil**.
 *
 * MASC-10A asked what a lamp does with `lookX` and `eyeOpen`, and MASC-10B
 * answered half of it by accident: an eye set that brings no `gaze` and no
 * `eyelids` cannot be swapped in over one that does, because the install would
 * take the pupils off the face with it. So a robot eye is a composite like
 * every other eye in this library, and the only question left is what plays
 * each role.
 *
 * ```text
 * socket   the bezel, housing or screen panel the light sits in — clips the lids
 * white    the dark ground inside it            → eyeWhite
 * pupil    the lit element itself               → pupil
 * lids     the housing shutters                 → skin, outline
 * ```
 *
 * Which is not a workaround but the right reading: a robot eye that looks at
 * you *is* a light moving inside its housing, and one that blinks *is* a
 * housing closing over it. `lookX`, `lookY`, `pupilScale` and `eyeOpen` all
 * mean something on a machine, and none of them had to be invented.
 *
 * Built where the shipped sets are built — the eyes at y 113, their centres 83
 * and 157 — so a robot eye and a person's eye fit the same face.
 */
import { boltRing, boxPath, ovalPath, round } from './shapes.js';

const SHELL = '#f5f7fa', LINE = '#33373a';

const CY = 113, SPREAD = 37;
const centre = (side) => 120 + (side === 'Left' ? -SPREAD : SPREAD);

/** The socket: a rounded box for the screen family, a disc for the lamps. */
const socketPath = (side, { rx, ry, radius = null }) =>
  (radius === null ? ovalPath(centre(side), CY, rx, ry) : boxPath(centre(side) - rx, CY - ry, rx * 2, ry * 2, radius));

/** One side: housing, ground, lit element, glint, rim, and the two lids that close it. */
function eye(side, geometry) {
  const { rx, ry, lit, litRy = lit, bulge = 6, depth = 22, bolts = 0, glint = true, ground, light } = geometry;
  const cx = centre(side), left = cx - rx - 8, right = cx + rx + 8;
  const upperEdge = CY - ry, lowerEdge = CY + ry;
  const upper = `M${left} ${round(upperEdge - bulge - depth)} L${right} ${round(upperEdge - bulge - depth)} L${right} ${round(upperEdge - bulge)} Q${cx} ${round(upperEdge + bulge)} ${left} ${round(upperEdge - bulge)} Z`;
  const lower = `M${left} ${round(lowerEdge + bulge + depth)} L${right} ${round(lowerEdge + bulge + depth)} L${right} ${round(lowerEdge + bulge)} Q${cx} ${round(lowerEdge - bulge)} ${left} ${round(lowerEdge + bulge)} Z`;
  const shape = socketPath(side, geometry);
  // The bolts ring the housing from *outside* the clip: they are fasteners on
  // the case, not something seen through the aperture. The role is the outer
  // group, so they still travel with the eye, which is the same arrangement
  // that lets an earring hang inside an ear.
  return `<g id="eye${side}" data-name="${side} eye">`
    + (bolts ? `<path id="bolts${side}" data-name="${side} housing bolts" d="${boltRing(cx, CY, rx + 6, bolts, 2.2)}" fill="${LINE}" />` : '')
    // Named, like every other layer: the template draws nothing anonymous, and
    // an install refuses a `<g>` with no id.
    + `<g id="housing${side}" data-name="${side} eye housing" clip-path="url(#robotSocket${side})">`
    + `<path id="eyeWhite${side}" data-name="${side} eye ground" d="${shape}" fill="${ground}" />`
    + `<path id="pupil${side}" data-name="${side} pupil" d="${ovalPath(cx, CY, lit, litRy)}" fill="${light}" />`
    + (glint ? `<circle id="glint${side}" data-name="${side} eye glint" cx="${round(cx - lit * 0.34)}" cy="${round(CY - litRy * 0.4)}" r="${round(Math.min(lit, litRy) * 0.3)}" fill="${SHELL}" opacity="0.85" />` : '')
    + `<path id="rim${side}" data-name="${side} eye housing" d="${shape}" fill="none" stroke="${LINE}" stroke-width="3" />`
    + `<path id="lidUpper${side}" data-name="${side} upper eyelid" d="${upper}" fill="${SHELL}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" />`
    + `<path id="lidLower${side}" data-name="${side} lower eyelid" d="${lower}" fill="${SHELL}" stroke="${LINE}" stroke-width="2" stroke-linejoin="round" />`
    + '</g></g>';
}

function eyes(slug, name, description, geometry, { tags }) {
  const { rx, ry, bolts = 0 } = geometry;
  // The travel that shuts the eye, and the shipped sets' own arithmetic: from
  // where each lid's curved edge is drawn to the middle, where the two meet.
  const travel = round(ry);
  const clips = ['Left', 'Right'].map((side) => `<clipPath id="robotSocket${side}"><path d="${socketPath(side, { ...geometry, rx: rx + 2, ry: ry + 2 })}" /></clipPath>`).join('');
  const reach = rx + (bolts ? 7 : 0);
  return Object.freeze({
    id: `eyes.robot-${slug}`, category: 'eyes', name, description, origin: 'builtin',
    artwork: `<g id="eyes-robot-${slug}" data-name="Eyes"><defs>${clips}</defs>${eye('Left', geometry)}${eye('Right', geometry)}</g>`,
    roles: Object.freeze({ leftEye: 'eyeLeft', rightEye: 'eyeRight' }),
    capabilities: Object.freeze(['eyeOpen']),
    drivers: Object.freeze({ eyeOpen: Object.freeze({ property: 'scaleY', amplitude: 0.12, offset: 0.88 }) }),
    parts: Object.freeze({
      gaze: Object.freeze({ roles: Object.freeze({ leftPupil: 'pupilLeft', rightPupil: 'pupilRight' }), capabilities: Object.freeze(['lookX', 'lookY', 'pupilScale']) }),
      eyelids: Object.freeze({
        roles: Object.freeze({ leftUpper: 'lidUpperLeft', leftLower: 'lidLowerLeft', rightUpper: 'lidUpperRight', rightLower: 'lidLowerRight' }),
        capabilities: Object.freeze(['eyeOpen']),
        drivers: Object.freeze({ eyeOpen: Object.freeze({ property: 'translateY', amplitude: -travel, offset: travel, roles: Object.freeze({ leftLower: Object.freeze({ amplitude: travel, offset: -travel }), rightLower: Object.freeze({ amplitude: travel, offset: -travel }) }) }) })
      })
    }),
    paletteRoles: Object.freeze(Object.fromEntries(['Left', 'Right'].flatMap((side) => [
      [`eyeWhite${side}`, Object.freeze({ fill: 'eyeWhite' })], [`pupil${side}`, Object.freeze({ fill: 'pupil' })], [`rim${side}`, Object.freeze({ stroke: 'outline' })],
      ...(bolts ? [[`bolts${side}`, Object.freeze({ fill: 'outline' })]] : []),
      [`lidUpper${side}`, Object.freeze({ fill: 'skin', stroke: 'outline' })], [`lidLower${side}`, Object.freeze({ fill: 'skin', stroke: 'outline' })]
    ]))),
    // Whole units: a lid shuts to a seam at the eye's own centre, and a box
    // whose edge falls off the half-unit grid moves that centre off every
    // sample a reader takes across it (MASC-10B, `eyes.animal-round-large`).
    referenceBox: Object.freeze({ x: Math.round(120 - SPREAD - reach), y: Math.round(CY - ry - (bolts ? 7 : 0)), width: Math.round((SPREAD + reach) * 2), height: Math.round((ry + (bolts ? 7 : 0)) * 2) }),
    mountPoint: 'eyes',
    slot: 'eyes', morphologies: Object.freeze(['robot']), tags: Object.freeze(['robot', ...tags]),
    palette: Object.freeze(['eyeWhite', 'pupil', 'skin', 'outline'])
  });
}

/**
 * The literal colours below are each family's own palette entry, so the drawing
 * reads right before anybody paints it — `robot-screen` puts cyan on near-black
 * and `robot-toy` puts near-black on white, and the pair of tokens is the same
 * pair either way round. That inversion is the whole difference between a lamp
 * and a cartoon eye, and it costs a palette rather than a drawing.
 */

/** Écran — a lit shape on a dark panel, drawn *on* the screen rather than set into the shell. */
export const EYES_ROBOT_DISPLAY_FRIENDLY = eyes('display-friendly', 'Friendly display', 'Two lit discs on dark panels, drawn on the screen.',
  { rx: 24, ry: 20, radius: 8, lit: 11, ground: '#23272e', light: '#37c9e8' }, { tags: ['screen', 'display', 'lit'] });

/** Rétro — a warm lamp in a round bezel, where the screen family is cold and square. */
export const EYES_ROBOT_RETRO_LED = eyes('retro-led', 'Retro LED', 'Two round lamps in dark bezels.',
  { rx: 20, ry: 20, lit: 12, ground: '#3a3630', light: '#f2c230' }, { tags: ['retro', 'led', 'lamp'] });

/** Industriel — a hard indicator in a bolted housing: the only pair with fasteners on it. */
export const EYES_ROBOT_INDUSTRIAL_LED = eyes('industrial-led', 'Industrial LED', 'Two hard indicator lights in bolted housings.',
  { rx: 17, ry: 17, lit: 9, bolts: 8, glint: false, ground: '#33373a', light: '#e08a24' }, { tags: ['industrial', 'led', 'indicator'] });

/** Jouet — the only pair that reads as an eye rather than as a light, and the only one inverted. */
export const EYES_ROBOT_TOY_EXPRESSIVE = eyes('toy-expressive', 'Toy expressive', 'Two big cartoon eyes with a highlight each.',
  { rx: 22, ry: 24, lit: 13, ground: '#ffffff', light: '#3b4046' }, { tags: ['toy', 'expressive', 'cute'] });

export const ROBOT_EYES = Object.freeze([
  EYES_ROBOT_DISPLAY_FRIENDLY, EYES_ROBOT_RETRO_LED, EYES_ROBOT_INDUSTRIAL_LED, EYES_ROBOT_TOY_EXPRESSIVE
]);
