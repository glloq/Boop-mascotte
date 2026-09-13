/**
 * Bird eyes — with their pupils inside them, for the third time.
 *
 * "6 styles d'yeux d'oiseaux (pupilles intégrées)": the same caption the animal
 * planche carried, and the same answer. An eye set is a composite — it names
 * the gaze and the eyelids under `parts` — because a standalone pupils card has
 * never existed and no preset may name one.
 *
 * Built the way every shipped set is built (`builtin/eyes.js`): a socket clip,
 * a white, a pupil, a glint, an outline, and two lids drawn open and parked
 * outside the socket, so the artwork on its own is a face with its eyes open
 * and closing is the movement.
 *
 * A bird's eye is rounder and brighter than a person's — the whole family is
 * disc pupils in big round whites — and what tells the six apart is size, lid
 * height and how much white shows around the pupil.
 *
 * ```text
 * round-large  the owl's stare: the largest of the six
 * soft         round and gentle, a size down
 * bright       a small pupil in a large white: wide awake
 * sleepy       the same eye with its lids resting low
 * happy        big dark pupils, two highlights each
 * piercing     narrowed at the inner corner: intent rather than sweet
 * ```
 */
import { ovalPath, round } from './shapes.js';

const FEATHER = '#f0e2cd', LINE = '#8a6f4e', WHITE = '#ffffff', PUPIL = '#3a2c1e';
const CY = 113, SPREAD = 37;
const centre = (side) => 120 + (side === 'Left' ? -SPREAD : SPREAD);

/**
 * The white of one eye, and the clip that holds the lids to it.
 *
 * A round eye is an ellipse; a narrowed one is the same ellipse with its inner
 * corner pulled down, which is the whole of what makes a crow look intent next
 * to a duck.
 */
function whiteShape(side, { rx, ry, narrow = 0 }) {
  const cx = centre(side), out = side === 'Left' ? -1 : 1;
  if (!narrow) return ovalPath(cx, CY, rx, ry);
  const drop = ry * narrow;
  const p = (x, y) => `${round(x)} ${round(y)}`;
  return `M${p(cx - out * rx, CY + drop)}`
    + ` C${p(cx - out * rx * 0.6, CY - ry * 0.98)} ${p(cx + out * rx * 0.55, CY - ry)} ${p(cx + out * rx, CY - drop * 0.4)}`
    + ` C${p(cx + out * rx * 0.55, CY + ry)} ${p(cx - out * rx * 0.6, CY + ry * 0.92)} ${p(cx - out * rx, CY + drop)} Z`;
}

/** One side: white, pupil, glint(s), outline, and the two lids that close it. */
function eye(side, geometry) {
  const { rx, ry, pupil, bulge = 6, depth = 22, rest = 0, glints = 1 } = geometry;
  const cx = centre(side), left = cx - rx - 8, right = cx + rx + 8;
  const upperEdge = CY - ry + rest, lowerEdge = CY + ry;
  const upper = `M${left} ${round(upperEdge - bulge - depth)} L${right} ${round(upperEdge - bulge - depth)} L${right} ${round(upperEdge - bulge)} Q${cx} ${round(upperEdge + bulge)} ${left} ${round(upperEdge - bulge)} Z`;
  const lower = `M${left} ${round(lowerEdge + bulge + depth)} L${right} ${round(lowerEdge + bulge + depth)} L${right} ${round(lowerEdge + bulge)} Q${cx} ${round(lowerEdge - bulge)} ${left} ${round(lowerEdge + bulge)} Z`;
  const white = whiteShape(side, geometry);
  const glint = (index) => {
    const size = pupil * (index ? 0.2 : 0.32), offsetX = index ? pupil * 0.42 : -pupil * 0.36;
    return `<circle id="glint${side}${index || ''}" data-name="${side} eye glint ${index + 1}" cx="${round(cx + offsetX)}" cy="${round(CY - pupil * (index ? 0.1 : 0.42))}" r="${round(size)}" fill="${WHITE}" opacity="0.92" />`;
  };
  return `<g id="eye${side}" data-name="${side} eye" clip-path="url(#birdSocket${side})">`
    + `<path id="eyeWhite${side}" data-name="${side} eye white" d="${white}" fill="${WHITE}" />`
    + `<path id="pupil${side}" data-name="${side} pupil" d="${ovalPath(cx, CY, pupil, pupil)}" fill="${PUPIL}" />`
    + Array.from({ length: glints }, (unused, index) => glint(index)).join('')
    + `<path id="rim${side}" data-name="${side} eye outline" d="${white}" fill="none" stroke="${LINE}" stroke-width="3" />`
    + `<path id="lidUpper${side}" data-name="${side} upper eyelid" d="${upper}" fill="${FEATHER}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" />`
    + `<path id="lidLower${side}" data-name="${side} lower eyelid" d="${lower}" fill="${FEATHER}" stroke="${LINE}" stroke-width="2" stroke-linejoin="round" />`
    + '</g>';
}

function eyes(slug, name, description, geometry, { tags }) {
  const { rx, ry, rest = 0 } = geometry;
  // How far a lid travels to shut the eye: from where its curved edge is drawn
  // to the middle, where the two meet. The shipped sets' own arithmetic.
  const upperTravel = round(ry - rest), lowerTravel = round(ry);
  const clips = ['Left', 'Right'].map((side) => `<clipPath id="birdSocket${side}"><path d="${whiteShape(side, { ...geometry, rx: rx + 2, ry: ry + 2 })}" /></clipPath>`).join('');
  return Object.freeze({
    id: `eyes.${slug}`, category: 'eyes', name, description, origin: 'builtin',
    artwork: `<g id="eyes-${slug}" data-name="Eyes"><defs>${clips}</defs>${eye('Left', geometry)}${eye('Right', geometry)}</g>`,
    roles: Object.freeze({ leftEye: 'eyeLeft', rightEye: 'eyeRight' }),
    capabilities: Object.freeze(['eyeOpen']),
    drivers: Object.freeze({ eyeOpen: Object.freeze({ property: 'scaleY', amplitude: 0.12, offset: 0.88 }) }),
    parts: Object.freeze({
      gaze: Object.freeze({ roles: Object.freeze({ leftPupil: 'pupilLeft', rightPupil: 'pupilRight' }), capabilities: Object.freeze(['lookX', 'lookY', 'pupilScale']) }),
      eyelids: Object.freeze({
        roles: Object.freeze({ leftUpper: 'lidUpperLeft', leftLower: 'lidLowerLeft', rightUpper: 'lidUpperRight', rightLower: 'lidLowerRight' }),
        capabilities: Object.freeze(['eyeOpen']),
        drivers: Object.freeze({ eyeOpen: Object.freeze({ property: 'translateY', amplitude: -upperTravel, offset: upperTravel, roles: Object.freeze({ leftLower: Object.freeze({ amplitude: lowerTravel, offset: -lowerTravel }), rightLower: Object.freeze({ amplitude: lowerTravel, offset: -lowerTravel }) }) }) })
      })
    }),
    paletteRoles: Object.freeze(Object.fromEntries(['Left', 'Right'].flatMap((side) => [
      [`eyeWhite${side}`, Object.freeze({ fill: 'eyeWhite' })], [`pupil${side}`, Object.freeze({ fill: 'pupil' })], [`rim${side}`, Object.freeze({ stroke: 'outline' })],
      [`lidUpper${side}`, Object.freeze({ fill: 'skin', stroke: 'outline' })], [`lidLower${side}`, Object.freeze({ fill: 'skin', stroke: 'outline' })]
    ]))),
    // Whole units, and deliberately: a lid shuts to a seam at the eye's own
    // centre, and a box whose edge falls off the half-unit grid moves that
    // centre off every sample a reader takes across it (MASC-10B).
    referenceBox: Object.freeze({ x: Math.round(120 - SPREAD - rx), y: Math.round(CY - ry), width: Math.round((SPREAD + rx) * 2), height: Math.round(ry * 2) }),
    mountPoint: 'eyes',
    slot: 'eyes', morphologies: Object.freeze(['beak']), tags: Object.freeze(['bird', ...tags]),
    palette: Object.freeze(['eyeWhite', 'pupil', 'skin', 'outline'])
  });
}

/** Grands ronds — the owl's stare, and the largest of the six. */
export const EYES_BIRD_ROUND_LARGE = eyes('bird-round-large', 'Big round', 'Very large round eyes with a wide pupil.',
  { rx: 26, ry: 26, pupil: 15 }, { tags: ['large', 'round', 'owl'] });

/** Doux — round and gentle, a size down from the owl's. */
export const EYES_BIRD_SOFT = eyes('bird-soft', 'Soft', 'Round and gentle, with a soft highlight.',
  { rx: 21, ry: 21, pupil: 12 }, { tags: ['soft', 'friendly'] });

/** Vifs — a small pupil in a large white: wide awake. */
export const EYES_BIRD_BRIGHT = eyes('bird-bright', 'Bright', 'Wide awake: a small pupil in a large white.',
  { rx: 23, ry: 23, pupil: 8 }, { tags: ['bright', 'alert'] });

/** Endormis — the same eye with its lids resting low. */
export const EYES_BIRD_SLEEPY = eyes('bird-sleepy', 'Sleepy', 'Heavy lids drawn low over the eye.',
  { rx: 22, ry: 22, pupil: 10, rest: 13 }, { tags: ['sleepy', 'heavy'] });

/** Joyeux — big dark pupils, two highlights each: the only pair with two. */
export const EYES_BIRD_HAPPY = eyes('bird-happy', 'Happy', 'Big dark pupils with two highlights each.',
  { rx: 24, ry: 25, pupil: 16, glints: 2 }, { tags: ['happy', 'cute'] });

/** Perçants — narrowed at the inner corner: intent rather than sweet. */
export const EYES_BIRD_PIERCING = eyes('bird-piercing', 'Piercing', 'Narrowed and angled: intent rather than sweet.',
  { rx: 24, ry: 18, pupil: 9, narrow: 0.42, bulge: 5, depth: 20 }, { tags: ['piercing', 'intense'] });

export const BIRD_EYES = Object.freeze([
  EYES_BIRD_ROUND_LARGE, EYES_BIRD_SOFT, EYES_BIRD_BRIGHT, EYES_BIRD_SLEEPY, EYES_BIRD_HAPPY, EYES_BIRD_PIERCING
]);
