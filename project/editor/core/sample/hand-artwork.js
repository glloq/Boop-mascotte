/**
 * A cartoon hand, generated rather than imported.
 *
 * "Il va falloir donner une bonne base pour ajouter des mains (avec 4 doigts)
 * sans avoir besoin d'importer de SVG." Hand Setup could rig a hand, but only
 * once someone had drawn one somewhere else and imported it, which is a wall
 * at exactly the wrong moment.
 *
 * One function draws the outline, and the poses are the same function with
 * different fingers. That matters for more than tidiness: a shape key is a
 * per-point delta, so a pose is only usable when its outline has the **same
 * structure** as the rest outline. Generated from one template, that holds by
 * construction — there is no way to author a Fist whose topology does not
 * match the open hand.
 *
 * Four digits: a thumb and three fingers, which is the cartoon standard and
 * what reads as a hand at mascot size.
 */

const round = (value) => Math.round(value * 10) / 10;
const rad = (degrees) => (degrees * Math.PI) / 180;

/** The palm, in the hand's own coordinates: (0, 0) is its middle, y grows down. */
export const HAND_PALM = Object.freeze({ halfWidth: 19, wrist: 23 });

/**
 * Where each digit leaves the palm, where it points and how big it is.
 *
 * Listed the way the outline is walked — left to right across the knuckles —
 * so the thumb comes first. `curl` folds it back into the palm: 0 is straight
 * out, 1 is a fist.
 */
export const HAND_DIGITS = Object.freeze([
  Object.freeze({ id: 'thumb', base: { x: -16, y: 6 }, angle: -74, length: 15, width: 6.5 }),
  Object.freeze({ id: 'index', base: { x: -10, y: -12 }, angle: -17, length: 21, width: 6 }),
  Object.freeze({ id: 'middle', base: { x: 1, y: -15 }, angle: 0, length: 24, width: 6 }),
  Object.freeze({ id: 'ring', base: { x: 12, y: -12 }, angle: 16, length: 20, width: 6 })
]);

/** How much of a digit a full curl folds away. */
const CURL_FOLD = 0.78;
/** And how far it swings towards the palm on the way. */
const CURL_TURN = 18;

/**
 * The hand outline.
 *
 * @param {object} options
 * @param {Record<string, number>} options.curl per-digit curl, 0…1
 * @param {{x: number, y: number}} options.at   where the palm sits on the artboard
 * @param {boolean} options.mirror              the other hand: the thumb on the other side
 * @returns {string} an SVG path, always with the same commands in the same order
 */
/**
 * Where one digit is, in the hand's own coordinates.
 *
 * The outline walks this, and so does the handle that grabs a single finger:
 * one function, so a fingertip handle can never sit somewhere the finger is
 * not.
 *
 * @param {object} digit an entry of `HAND_DIGITS`
 * @param {number|{curl,turn,lift,stretch}} posed how this pose shapes it
 */
function digitGeometry(digit, posed) {
  const shaped = posed && typeof posed === 'object' ? posed : { curl: posed };
  const amount = Math.max(0, Math.min(1, Number(shaped.curl) || 0));
  // A pose may also point a digit somewhere else, or slide it along the palm
  // -- a thumbs-up is a thumb that turns and rides higher, not one that folds.
  // Neither changes a command, so the outline still matches the rest shape
  // point for point, which is what a shape key needs.
  const turn = Number(shaped.turn) || 0;
  const lift = Number(shaped.lift) || 0;
  const stretch = Number(shaped.stretch) || 0;
  // A curled digit is shorter and turned in: at mascot size a folded finger
  // reads as a stub, and that is exactly what a cartoon fist is.
  // The turn is in the hand's own coordinates, and mirroring already flips
  // those: applying `flip` here as well sent the other thumb pointing down.
  const angle = rad(digit.angle + turn + amount * CURL_TURN * (digit.angle <= 0 ? 1 : -1));
  const length = digit.length * (1 - CURL_FOLD * amount) * (1 + stretch);
  const direction = { x: Math.sin(angle), y: -Math.cos(angle) };
  const base = { x: digit.base.x + direction.x * lift, y: digit.base.y + direction.y * lift };
  return {
    direction, base,
    normal: { x: -direction.y, y: direction.x },
    tip: { x: base.x + direction.x * length, y: base.y + direction.y * length }
  };
}

export function handPath({ curl = {}, at = { x: 0, y: 0 }, mirror = false, scale = 1, back = false } = {}) {
  // `back` turns the hand over: a flat cartoon hand seen from the other side is
  // the same outline with the thumb on the other edge, which is a mirror about
  // the palm. Same commands in the same order, so it is a shape key like any
  // other pose rather than a second drawing.
  const turned = Boolean(mirror) !== Boolean(back);
  const flip = turned ? -1 : 1;
  const size = Number(scale) > 0 ? Number(scale) : 1;
  const place = (point) => `${round(at.x + point.x * flip * size)} ${round(at.y + point.y * size)}`;
  // Mirroring flips x, so the outline has to be walked the other way round or
  // the path would turn inside out.
  const digits = turned ? [...HAND_DIGITS].reverse() : [...HAND_DIGITS];
  const wristLeft = { x: -HAND_PALM.halfWidth, y: HAND_PALM.wrist };
  const wristRight = { x: HAND_PALM.halfWidth, y: HAND_PALM.wrist };

  const parts = [`M ${place(turned ? wristRight : wristLeft)}`];
  for (const digit of digits) {
    const { base, tip, normal } = digitGeometry(digit, curl[digit.id]);
    const side = (point, sign) => ({ x: point.x + normal.x * digit.width * sign, y: point.y + normal.y * digit.width * sign });
    // Left and right of the digit are the viewer's, so they swap when mirrored
    // and the walk keeps going the same way round the outline.
    const near = turned ? 1 : -1, far = -near;
    parts.push(`L ${place(side(base, near))}`);
    parts.push(`L ${place(side(tip, near))}`);
    parts.push(`A ${round(digit.width * size)} ${round(digit.width * size)} 0 0 1 ${place(side(tip, far))}`);
    parts.push(`L ${place(side(base, far))}`);
  }
  parts.push(`L ${place(turned ? wristLeft : wristRight)}`);
  parts.push('Z');
  return parts.join(' ');
}

/**
 * The poses the hand ships with.
 *
 * A digit is either a number (how curled it is) or `{ curl, turn, lift, stretch }`
 * when the pose points it somewhere else, slides it along the palm, or makes it
 * reach further.
 */
export const HAND_POSE_CURLS = Object.freeze({
  open: Object.freeze({}),
  fist: Object.freeze({ thumb: 0.75, index: 1, middle: 1, ring: 1 }),
  point: Object.freeze({ thumb: 0.7, index: 0, middle: 1, ring: 1 }),
  peace: Object.freeze({ thumb: 0.8, index: Object.freeze({ curl: 0, turn: -12 }), middle: Object.freeze({ curl: 0, turn: 12 }), ring: 1 }),
  // The thumb rides up the side of the fist rather than folding into it.
  thumbsUp: Object.freeze({ thumb: Object.freeze({ curl: 0, turn: 40, lift: 4, stretch: 0.7 }), index: 1, middle: 1, ring: 1 }),
  // Fingers fanned: what a hand does when it waves.
  spread: Object.freeze({ thumb: Object.freeze({ curl: 0, turn: -14 }), index: Object.freeze({ curl: 0, turn: -14 }), middle: 0, ring: Object.freeze({ curl: 0, turn: 14 }) }),
  // And barely held, which is how a hand hangs when nothing is happening.
  relax: Object.freeze({ thumb: 0.3, index: 0.35, middle: 0.3, ring: 0.4 })
});

/** Each digit on its own, for the four curl parameters a full rig exposes. */
export const handDigitCurl = (id, amount = 1) => Object.freeze({ [id]: amount });

/**
 * How far the hand is turned at rest, per side.
 *
 * The outline is drawn with the fingers up and the wrist below, which is the
 * one orientation a hand beside a mascot never has: hanging by the body, the
 * fingers point **down**. Half a turn does that, and it also carries the thumb
 * across to the inner edge -- thumbs towards the middle, which is how a pair of
 * hands reads as a pair rather than as two left hands. The extra 20 degrees
 * fans them outwards so they do not sit parallel like a doll's.
 */
export const HAND_REST_TILT = Object.freeze({ left: 200, right: 160 });

export const HAND_SKIN = '#f6d6ad';
export const HAND_LINE = '#9a6544';

export const handElementId = (side) => (side === 'right' ? 'handRight' : 'handLeft');

/** The hand is drawn for a 240-wide artboard, and scaled with anything else. */
const HAND_SCALE = 0.72;
export const handScale = ({ width = 240 } = {}) => (Number(width) > 0 ? Number(width) : 240) / 240 * HAND_SCALE;

/**
 * The artboard the artwork is drawn on, so hands land beside the mascot and
 * not on it — and so a handle on a fingertip lands on the same fingertip.
 */
export function artboardBox(state = {}) {
  const match = /viewBox="([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"/.exec(state.svgMarkup || '');
  if (!match) return { width: 240, height: 240 };
  return { width: Number(match[3]) || 240, height: Number(match[4]) || 240 };
}

/**
 * Where a hand hangs: down in the corner of the artboard, clear of a face that
 * fills most of it, and far enough inside that a full reach stays visible.
 */
export function handRestPoint(side, { width = 240, height = 240 } = {}) {
  const inset = Math.round(width * 0.2);
  // Below the drawing rather than across it: `handsArtboard` makes the room,
  // and the anchor is not the lowest point of the hand -- it hangs *below*
  // where it is held, so an anchor on the very edge puts the fingertips off it.
  return { x: side === 'right' ? width - inset : inset, y: Math.round(height * 0.8) };
}

/**
 * One hand, open or posed, in artboard coordinates.
 *
 * Every caller goes through here — the artwork, the rest outline a shape key
 * measures against, and the poses themselves — so a pose can never be drawn at
 * a different size or place from the hand it deforms.
 */
export function handShape(side, pose = 'open', { at = null, box = {}, curl = null, back = false } = {}) {
  return handPath({
    // `curl` overrides the named pose, which is how one digit is bent on its own.
    curl: curl || HAND_POSE_CURLS[pose] || {},
    at: at || handRestPoint(side, box),
    mirror: side === 'right',
    back,
    scale: handScale(box)
  });
}

/** The artwork for one hand: one path, so a pose is one shape key. */
export function handArtwork(side, { at = null, box = {} } = {}) {
  const id = handElementId(side);
  return `<path id="${id}" data-name="${side === 'right' ? 'Right hand' : 'Left hand'}" d="${handShape(side, 'open', { at, box })}" fill="${HAND_SKIN}" stroke="${HAND_LINE}" stroke-width="3" stroke-linejoin="round" />`;
}

/** Both hands, in paint order. */
export function handsArtwork({ box = {} } = {}) {
  return `<g id="hands" data-name="Hands">${handArtwork('left', { box })}${handArtwork('right', { box })}</g>`;
}

/** The same hand in a pose, for the shape key that reaches it. */
export const handPosePath = (side, pose, options = {}) => handShape(side, pose, options);

/**
 * A digit's fingertip on the artboard, for the handle that bends that finger.
 *
 * Same geometry as the outline, placed the same way, so the handle sits on the
 * fingertip at every pose and every size.
 */
export function handDigitTip(side, digitId, { at = null, box = {}, curl = null, back = false } = {}) {
  const digit = HAND_DIGITS.find((item) => item.id === digitId);
  if (!digit) return null;
  const anchor = at || handRestPoint(side, box);
  const size = handScale(box);
  const flip = (side === 'right') !== Boolean(back) ? -1 : 1;
  const { tip } = digitGeometry(digit, (curl || {})[digitId]);
  return { x: round(anchor.x + tip.x * flip * size), y: round(anchor.y + tip.y * size) };
}

/** Every digit closed at once: the grip, as one continuous control. */
export const HAND_GRIP_CURL = Object.freeze({ thumb: 0.75, index: 1, middle: 1, ring: 1 });
