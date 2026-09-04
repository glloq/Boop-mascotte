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
export function handPath({ curl = {}, at = { x: 0, y: 0 }, mirror = false, scale = 1 } = {}) {
  const flip = mirror ? -1 : 1;
  const size = Number(scale) > 0 ? Number(scale) : 1;
  const place = (point) => `${round(at.x + point.x * flip * size)} ${round(at.y + point.y * size)}`;
  // Mirroring flips x, so the outline has to be walked the other way round or
  // the path would turn inside out.
  const digits = mirror ? [...HAND_DIGITS].reverse() : [...HAND_DIGITS];
  const wristLeft = { x: -HAND_PALM.halfWidth, y: HAND_PALM.wrist };
  const wristRight = { x: HAND_PALM.halfWidth, y: HAND_PALM.wrist };

  const parts = [`M ${place(mirror ? wristRight : wristLeft)}`];
  for (const digit of digits) {
    const posed = curl[digit.id];
    const amount = Math.max(0, Math.min(1, Number(typeof posed === 'object' ? posed?.curl : posed) || 0));
    // A pose may also point a digit somewhere else -- a thumbs-up is a thumb
    // that turns, not one that folds. It changes no command, so the outline
    // still matches the rest shape point for point.
    const turn = Number(typeof posed === 'object' ? posed?.turn : 0) || 0;
    // A curled digit is shorter and turned in: at mascot size a folded finger
    // reads as a stub, and that is exactly what a cartoon fist is.
    const angle = rad(digit.angle + turn * flip + amount * CURL_TURN * (digit.angle <= 0 ? 1 : -1));
    const length = digit.length * (1 - CURL_FOLD * amount);
    const direction = { x: Math.sin(angle), y: -Math.cos(angle) };
    const normal = { x: -direction.y, y: direction.x };
    const tip = { x: digit.base.x + direction.x * length, y: digit.base.y + direction.y * length };
    const side = (point, sign) => ({ x: point.x + normal.x * digit.width * sign, y: point.y + normal.y * digit.width * sign });
    // Left and right of the digit are the viewer's, so they swap when mirrored
    // and the walk keeps going the same way round the outline.
    const near = mirror ? 1 : -1, far = -near;
    parts.push(`L ${place(side(digit.base, near))}`);
    parts.push(`L ${place(side(tip, near))}`);
    parts.push(`A ${round(digit.width * size)} ${round(digit.width * size)} 0 0 1 ${place(side(tip, far))}`);
    parts.push(`L ${place(side(digit.base, far))}`);
  }
  parts.push(`L ${place(mirror ? wristLeft : wristRight)}`);
  parts.push('Z');
  return parts.join(' ');
}

/** Every pose the generated hand ships with, as curls. */
export const HAND_POSE_CURLS = Object.freeze({
  open: Object.freeze({}),
  fist: Object.freeze({ thumb: 0.75, index: 1, middle: 1, ring: 1 }),
  point: Object.freeze({ thumb: 0.7, index: 0, middle: 1, ring: 1 }),
  peace: Object.freeze({ thumb: 0.8, index: 0, middle: 0, ring: 1 }),
  thumbsUp: Object.freeze({ thumb: Object.freeze({ curl: 0, turn: 66 }), index: 1, middle: 1, ring: 1 })
});

export const HAND_SKIN = '#f6d6ad';
export const HAND_LINE = '#9a6544';

export const handElementId = (side) => (side === 'right' ? 'handRight' : 'handLeft');

/** The hand is drawn for a 240-wide artboard, and scaled with anything else. */
const HAND_SCALE = 0.82;
export const handScale = ({ width = 240 } = {}) => (Number(width) > 0 ? Number(width) : 240) / 240 * HAND_SCALE;

/**
 * Where a hand hangs: down in the corner of the artboard, clear of a face that
 * fills most of it, and far enough inside that a full reach stays visible.
 */
export function handRestPoint(side, { width = 240, height = 240 } = {}) {
  const inset = Math.round(width * 0.12);
  return { x: side === 'right' ? width - inset : inset, y: Math.round(height * 0.88) };
}

/**
 * One hand, open or posed, in artboard coordinates.
 *
 * Every caller goes through here — the artwork, the rest outline a shape key
 * measures against, and the poses themselves — so a pose can never be drawn at
 * a different size or place from the hand it deforms.
 */
export function handShape(side, pose = 'open', { at = null, box = {} } = {}) {
  return handPath({
    curl: HAND_POSE_CURLS[pose] || {},
    at: at || handRestPoint(side, box),
    mirror: side === 'right',
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
