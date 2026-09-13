/**
 * Animal eyes — **with their pupils inside them**.
 *
 * "6 styles d'yeux (pupilles intégrées)": the sheet says out loud what this
 * library already does. A pair of eyes is a *composite* — it names the gaze and
 * the eyelids under `parts` — because a standalone pupils card has never
 * existed and no preset may name one. So a slit pupil is not a separate
 * drawing, it is another eye set, and the three here are the three
 * combinations the recipes ask for:
 *
 * ```text
 * animal-round-large   round pupils     dog · bear · rabbit
 * animal-round-slit    vertical pupils  cat
 * animal-almond-alert  round pupils     fox · wolf
 * ```
 *
 * Built the way the shipped sets are built (`builtin/eyes.js`): a socket clip,
 * a white, a pupil, a glint, an outline, and two lids drawn open and parked
 * outside the socket, so the artwork on its own is a face with its eyes open
 * and closing is the movement.
 */
import { ovalPath, round } from './shapes.js';

const SKIN = '#f9d9b0', LINE = '#a4674a', WHITE = '#ffffff', PUPIL = '#2f3a43';
const CY = 113;
/** How far each eye sits from the face's middle: the template's own 83 and 157. */
const SPREAD = 37;
const centre = (side, { spread = SPREAD }) => 120 + (side === 'Left' ? -spread : spread);

/**
 * The white of one eye, and the clip that holds the lids to it.
 *
 * A round eye is an ellipse; an almond is the same ellipse with its inner
 * corner pulled down and its outer corner lifted, which is the whole of what
 * makes a fox look awake next to a dog.
 */
function whiteShape(side, geometry) {
  const { rx, ry, almond = 0 } = geometry;
  const cx = centre(side, geometry), out = side === 'Left' ? -1 : 1;
  if (!almond) return ovalPath(cx, CY, rx, ry);
  const lift = ry * almond, tip = rx * 1.04;
  const p = (x, y) => `${round(x)} ${round(y)}`;
  return `M${p(cx - out * tip, CY + lift * 0.5)}`
    + ` C${p(cx - out * rx * 0.6, CY - ry * 0.95)} ${p(cx + out * rx * 0.5, CY - ry)} ${p(cx + out * tip, CY - lift)}`
    + ` C${p(cx + out * rx * 0.5, CY + ry * 0.9)} ${p(cx - out * rx * 0.6, CY + ry)} ${p(cx - out * tip, CY + lift * 0.5)} Z`;
}

/** One side: white, pupil, glint, outline, and the two lids that close it. */
function eye(side, geometry) {
  const { rx, ry, pupil, pupilRy = pupil, bulge = 6, depth = 22, rest = 0, shut = false } = geometry;
  const arch = shut;
  const cx = centre(side, geometry), left = cx - rx - 8, right = cx + rx + 8;
  // A shut eye is both lids already at the seam, not just the upper one: park
  // the lower there too and the pair meets along one curve at rest.
  const upperEdge = CY - ry + (shut ? ry : rest), lowerEdge = CY + ry - (shut ? ry : 0);
  // A lid hangs: its edge sits lower in the middle than at the corners. An
  // arched one does the opposite -- the corners drop and the middle lifts --
  // which is the whole of what a shut eye smiling looks like. Both are the
  // same quadratic with the control point mirrored about the edge, so the
  // ends land in the same place and the seam still closes on the corner.
  const edge = arch ? round(upperEdge + bulge) : round(upperEdge - bulge);
  const pull = arch ? round(upperEdge - bulge * 3) : round(upperEdge + bulge);
  const upper = `M${left} ${round(upperEdge - bulge - depth)} L${right} ${round(upperEdge - bulge - depth)} L${right} ${edge} Q${cx} ${pull} ${left} ${edge} Z`;
  // Shut, the lower lid takes the upper's own edge rather than its own: the
  // two coincide along one curve, so what shows is a single arched line and
  // not a sliver of pupil between two nearly-parallel ones.
  const lowerTop = arch ? [edge, pull] : [round(lowerEdge + bulge), round(lowerEdge - bulge)];
  const lower = `M${left} ${round(lowerEdge + bulge + depth)} L${right} ${round(lowerEdge + bulge + depth)} L${right} ${lowerTop[0]} Q${cx} ${lowerTop[1]} ${left} ${lowerTop[0]} Z`;
  const white = whiteShape(side, geometry);
  return `<g id="eye${side}" data-name="${side} eye" clip-path="url(#socket${side})">`
    + `<path id="eyeWhite${side}" data-name="${side} eye white" d="${white}" fill="${WHITE}" />`
    + `<path id="pupil${side}" data-name="${side} pupil" d="${ovalPath(cx, CY, pupil, pupilRy)}" fill="${PUPIL}" />`
    + `<circle id="glint${side}" data-name="${side} eye glint" cx="${round(cx - pupil * 0.35)}" cy="${round(CY - pupilRy * 0.42)}" r="${round(Math.min(pupil, pupilRy) * 0.36)}" fill="${WHITE}" opacity="0.9" />`
    + `<path id="rim${side}" data-name="${side} eye outline" d="${white}" fill="none" stroke="${LINE}" stroke-width="3" />`
    + `<path id="lidUpper${side}" data-name="${side} upper eyelid" d="${upper}" fill="${SKIN}" stroke="${LINE}" stroke-width="3" stroke-linejoin="round" />`
    + `<path id="lidLower${side}" data-name="${side} lower eyelid" d="${lower}" fill="${SKIN}" stroke="${LINE}" stroke-width="2" stroke-linejoin="round" />`
    + '</g>';
}

function eyes(slug, name, description, geometry, { tags }) {
  const { rx, ry, rest = 0, spread = SPREAD, shut = false } = geometry;
  // How far a lid travels to shut the eye: from where its curved edge is drawn
  // to the middle, where the two meet. The shipped sets' own arithmetic.
  const upperTravel = round(ry - rest), lowerTravel = round(ry);
  const clips = ['Left', 'Right'].map((side) => `<clipPath id="socket${side}"><path d="${whiteShape(side, { ...geometry, rx: rx + 2, ry: ry + 2 })}" /></clipPath>`).join('');
  return Object.freeze({
    id: `eyes.${slug}`, category: 'eyes', name, description, origin: 'builtin',
    artwork: `<g id="eyes-${slug}" data-name="Eyes"><defs>${clips}</defs>${eye('Left', geometry)}${eye('Right', geometry)}</g>`,
    roles: Object.freeze({ leftEye: 'eyeLeft', rightEye: 'eyeRight' }),
    // A shut eye claims nothing it cannot do. It still *holds* the gaze and the
    // eyelids -- an eye set that brought neither could not be swapped in over
    // one that does, because the install would take the pupils off the face
    // with it -- but there is no blink left in a pair of lids already met, and
    // saying otherwise would put a control in the UI that moves nothing.
    capabilities: Object.freeze(shut ? [] : ['eyeOpen']),
    ...(shut ? {} : { drivers: Object.freeze({ eyeOpen: Object.freeze({ property: 'scaleY', amplitude: 0.12, offset: 0.88 }) }) }),
    parts: Object.freeze({
      gaze: Object.freeze({ roles: Object.freeze({ leftPupil: 'pupilLeft', rightPupil: 'pupilRight' }), capabilities: Object.freeze(shut ? [] : ['lookX', 'lookY', 'pupilScale']) }),
      eyelids: Object.freeze({
        roles: Object.freeze({ leftUpper: 'lidUpperLeft', leftLower: 'lidLowerLeft', rightUpper: 'lidUpperRight', rightLower: 'lidLowerRight' }),
        capabilities: Object.freeze(shut ? [] : ['eyeOpen']),
        ...(shut ? {} : { drivers: Object.freeze({ eyeOpen: Object.freeze({ property: 'translateY', amplitude: -upperTravel, offset: upperTravel, roles: Object.freeze({ leftLower: Object.freeze({ amplitude: lowerTravel, offset: -lowerTravel }), rightLower: Object.freeze({ amplitude: lowerTravel, offset: -lowerTravel }) }) }) }) })
      })
    }),
    paletteRoles: Object.freeze(Object.fromEntries(['Left', 'Right'].flatMap((side) => [
      [`eyeWhite${side}`, Object.freeze({ fill: 'eyeWhite' })], [`pupil${side}`, Object.freeze({ fill: 'pupil' })], [`rim${side}`, Object.freeze({ stroke: 'outline' })],
      [`lidUpper${side}`, Object.freeze({ fill: 'skin', stroke: 'outline' })], [`lidLower${side}`, Object.freeze({ fill: 'skin', stroke: 'outline' })]
    ]))),
    // Whole units, and deliberately: a lid shuts to a seam at the eye's own
    // centre, and a box whose edge falls off the half-unit grid moves that
    // centre off every sample a reader takes across it. The shipped sets get
    // this for free by using `rx` itself; the almond's tip is 4% wider than
    // `rx`, so this rounds rather than inheriting the accident.
    referenceBox: Object.freeze({ x: Math.round(120 - spread - rx * 1.04), y: Math.round(CY - ry), width: Math.round(spread * 2 + rx * 2.08), height: Math.round(ry * 2) }),
    mountPoint: 'eyes',
    slot: 'eyes', morphologies: Object.freeze(['muzzle']), tags: Object.freeze(tags),
    palette: Object.freeze(['eyeWhite', 'pupil', 'skin', 'outline'])
  });
}

export const EYES_ANIMAL_ROUND_LARGE = eyes('animal-round-large', 'Big round', 'Big round eyes with a large round pupil.',
  { rx: 22, ry: 24, pupil: 12 }, { tags: ['animal', 'large', 'round', 'friendly'] });

export const EYES_ANIMAL_ROUND_SLIT = eyes('animal-round-slit', 'Big round, slit', 'The same big eye with a vertical slit pupil.',
  { rx: 22, ry: 24, pupil: 5.5, pupilRy: 17 }, { tags: ['cat', 'feline', 'large', 'slit'] });

export const EYES_ANIMAL_ALMOND_ALERT = eyes('animal-almond-alert', 'Alert almond', 'Almond eyes tilted up at the outer corner.',
  { rx: 23, ry: 17, pupil: 9.5, almond: 0.34, bulge: 5, depth: 20 }, { tags: ['animal', 'almond', 'alert'] });

/** Small and set wide, with a pupil that fills most of the eye: a bear's. */
export const EYES_ANIMAL_SMALL_CUTE = eyes('animal-small-cute', 'Small and cute', 'Small round eyes set wide, with a large pupil each.',
  { rx: 15, ry: 16, pupil: 10, spread: 42, bulge: 5, depth: 18 }, { tags: ['animal', 'small', 'cute'] });

/**
 * Sleepy: the same big round eye with its upper lid drawn low at rest, which
 * is what `rest` is for -- the lid starts part of the way down and has that
 * much less to travel when `eyeOpen` shuts it.
 */
export const EYES_ANIMAL_SLEEPY = eyes('animal-sleepy', 'Sleepy', 'Heavy lids half over the eye, a narrow pupil beneath.',
  { rx: 21, ry: 22, pupil: 8, pupilRy: 9, rest: 13 }, { tags: ['animal', 'sleepy', 'heavy'] });

/**
 * Happy: the one pair drawn **shut**, and MASC-10A's open question answered.
 *
 * The question was what an eye already closed does with `eyeOpen` and with the
 * pupils it is supposed to own. Making it a bare pair of arcs is the tempting
 * answer and the wrong one: an eye set is the part that *holds* the gaze and
 * the eyelids, so one that brings neither cannot be swapped in over one that
 * does -- the install refuses it, and rightly, because it would take the
 * pupils off the face.
 *
 * So it is an ordinary eye set with its upper lid resting all the way down
 * (`rest` at the full `ry`) and arched rather than hanging. Everything is
 * there: whites, pupils, both lids. `eyeOpen` still shuts it -- the lower lid
 * comes up to the seam -- and the upper simply has no further to go, which is
 * what "already closed" means rather than something the rig has to be told.
 */
export const EYES_ANIMAL_HAPPY = eyes('animal-happy', 'Happy', 'Two closed upward arcs: an eye that is already smiling.',
  { rx: 22, ry: 20, pupil: 10, shut: true, bulge: 8 }, { tags: ['animal', 'happy', 'closed'] });

export const ANIMAL_EYES = Object.freeze([
  EYES_ANIMAL_ROUND_LARGE, EYES_ANIMAL_ROUND_SLIT, EYES_ANIMAL_ALMOND_ALERT,
  EYES_ANIMAL_SMALL_CUTE, EYES_ANIMAL_SLEEPY, EYES_ANIMAL_HAPPY
]);
