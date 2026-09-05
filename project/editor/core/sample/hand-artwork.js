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
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

/**
 * The palm, in the hand's own coordinates: (0, 0) is its middle, y grows down.
 *
 * `wristHalf` is narrower than `halfWidth`, which is the whole difference
 * between a hand and a mitten: the palm widens from the wrist to the knuckles,
 * and the heel of it curves rather than turning a corner.
 */
export const HAND_PALM = Object.freeze({ halfWidth: 20, wrist: 24, wristHalf: 14 });

/**
 * Where each digit leaves the palm, where it points and how big it is.
 *
 * Listed the way the outline is walked — left to right across the knuckles —
 * so the thumb comes first. `curl` folds it back into the palm: 0 is straight
 * out, 1 is a fist.
 */
export const HAND_DIGITS = Object.freeze([
  Object.freeze({ id: 'thumb', base: { x: -17, y: 7 }, angle: -76, length: 16, width: 8 }),
  Object.freeze({ id: 'index', base: { x: -10, y: -13 }, angle: -17, length: 22, width: 6.4 }),
  Object.freeze({ id: 'middle', base: { x: 1, y: -16 }, angle: 0, length: 25, width: 6.4 }),
  Object.freeze({ id: 'ring', base: { x: 12, y: -13 }, angle: 16, length: 21, width: 6 })
]);

/**
 * How much narrower a digit is at the tip than at the knuckle.
 *
 * "doigts épais, simples, arrondis, légèrement coniques" — the taper is the
 * cheapest of those and the one that was missing: parallel-sided fingers read
 * as pipes, and a pipe with a domed end reads as a glove rather than a hand.
 */
const DIGIT_TAPER = 0.84;

/**
 * The yaw of the hand itself (docs/MASCOT_DESIGN.md §6).
 *
 * A hand that only translates and rotates in the plane can point at things but
 * can never *face* anywhere, and the brief is explicit about it: "la rotation
 * d'une main doit se lire par la silhouette et l'orientation du pouce, pas par
 * simple translation."
 *
 * So `turn` is a yaw about the hand's own vertical axis, and it does to a hand
 * exactly what the head turn does to a face — the half going away compresses,
 * the half coming forward eases out, and the landmark that sticks out of the
 * plane swings. On a hand that landmark is the thumb, which is why it gets
 * numbers of its own: towards the viewer it opens away from the palm and keeps
 * its length, away from the viewer it folds across the palm and loses a third
 * of it. Positive `turn` sends the little-finger side away, the same sign
 * convention the head uses.
 */
export const HAND_TURN = Object.freeze({
  far: 0.34, near: 0.1, width: 0.26, splay: 7, thumbSwing: 16, thumbReach: 0.2, thumbFold: 0.12, thumbLift: 3
});

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
function digitGeometry(digit, posed, handTurn = 0) {
  const shaped = posed && typeof posed === 'object' ? posed : { curl: posed };
  const yaw = clamp(handTurn, -1, 1);
  const away = digit.base.x * yaw > 0;
  const swing = Math.abs(yaw);
  // The half of the hand going away foreshortens, the half coming forward
  // opens out -- across the palm and across each digit, so the silhouette
  // changes rather than the whole outline sliding.
  const across = away ? 1 - HAND_TURN.far * swing : 1 + HAND_TURN.near * swing;
  const thumb = digit.id === 'thumb';
  const yawTurn = thumb ? -HAND_TURN.thumbSwing * yaw : HAND_TURN.splay * yaw;
  const yawStretch = thumb ? HAND_TURN.thumbReach * yaw - HAND_TURN.thumbFold * swing : 0;
  // The thumb also rides up the palm as it opens, which is what keeps the web
  // between it and the index a curve instead of a notch.
  const yawLift = thumb ? HAND_TURN.thumbLift * yaw : 0;
  const amount = Math.max(0, Math.min(1, Number(shaped.curl) || 0));
  // A pose may also point a digit somewhere else, or slide it along the palm
  // -- a thumbs-up is a thumb that turns and rides higher, not one that folds.
  // Neither changes a command, so the outline still matches the rest shape
  // point for point, which is what a shape key needs.
  const turn = (Number(shaped.turn) || 0) + yawTurn;
  const lift = (Number(shaped.lift) || 0) + yawLift;
  const stretch = (Number(shaped.stretch) || 0) + yawStretch;
  // A curled digit is shorter and turned in: at mascot size a folded finger
  // reads as a stub, and that is exactly what a cartoon fist is.
  // The turn is in the hand's own coordinates, and mirroring already flips
  // those: applying `flip` here as well sent the other thumb pointing down.
  const angle = rad(digit.angle + turn + amount * CURL_TURN * (digit.angle <= 0 ? 1 : -1));
  const length = digit.length * (1 - CURL_FOLD * amount) * (1 + stretch);
  const direction = { x: Math.sin(angle), y: -Math.cos(angle) };
  const base = { x: digit.base.x * across + direction.x * lift, y: digit.base.y + direction.y * lift };
  return {
    direction, base,
    normal: { x: -direction.y, y: direction.x },
    width: digit.width * (away ? 1 - HAND_TURN.width * swing : 1 + HAND_TURN.near * swing),
    tip: { x: base.x + direction.x * length, y: base.y + direction.y * length }
  };
}

export function handPath({ curl = {}, at = { x: 0, y: 0 }, mirror = false, scale = 1, back = false, turn = 0 } = {}) {
  // `back` turns the hand over: a flat cartoon hand seen from the other side is
  // the same outline with the thumb on the other edge, which is a mirror about
  // the palm. Same commands in the same order, so it is a shape key like any
  // other pose rather than a second drawing.
  const turned = Boolean(mirror) !== Boolean(back);
  const flip = turned ? -1 : 1;
  const size = Number(scale) > 0 ? Number(scale) : 1;
  const yaw = clamp(turn, -1, 1);
  const swing = Math.abs(yaw);
  const place = (p) => `${round(at.x + p.x * flip * size)} ${round(at.y + p.y * size)}`;
  // Mirroring flips x, so the outline has to be walked the other way round or
  // the path would turn inside out.
  const digits = turned ? [...HAND_DIGITS].reverse() : [...HAND_DIGITS];
  // The palm yaws with the digits: its two edges are foreshortened
  // independently, which is what makes the hand read as facing somewhere
  // rather than as a flat shape that got narrower.
  const edge = (x) => x * (x * yaw > 0 ? 1 - HAND_TURN.far * swing : 1 + HAND_TURN.near * swing);
  const wristLeft = { x: edge(-HAND_PALM.wristHalf), y: HAND_PALM.wrist };
  const wristRight = { x: edge(HAND_PALM.wristHalf), y: HAND_PALM.wrist };
  const heelLeft = { x: edge(-HAND_PALM.halfWidth - 2), y: 10 };
  const heelRight = { x: edge(HAND_PALM.halfWidth + 2), y: 10 };
  const start = turned ? wristRight : wristLeft;
  const end = turned ? wristLeft : wristRight;
  const heelStart = turned ? heelRight : heelLeft;
  const heelEnd = turned ? heelLeft : heelRight;

  // Left and right of a digit are the viewer's, so they swap when mirrored and
  // the walk keeps going the same way round the outline.
  const near = turned ? 1 : -1, far = -near;
  const shape = (digit) => {
    const geometry = digitGeometry(digit, curl[digit.id], yaw);
    const side = (p, sign, width) => ({ x: p.x + geometry.normal.x * width * sign, y: p.y + geometry.normal.y * width * sign });
    // Conical: the knuckle is the widest part of a finger and the tip the
    // narrowest, which is most of what tells a finger from a peg.
    return { geometry, base: (sign) => side(geometry.base, sign, geometry.width), tip: (sign) => side(geometry.tip, sign, geometry.width * DIGIT_TAPER) };
  };

  const first = shape(digits[0]);
  const parts = [`M ${place(start)}`, `Q ${place(heelStart)} ${place(first.base(near))}`];
  digits.forEach((digit, index) => {
    const { geometry, base, tip } = index === 0 ? first : shape(digit);
    if (index > 0) parts.push(`L ${place(base(near))}`);
    parts.push(`L ${place(tip(near))}`);
    parts.push(`A ${round(geometry.width * DIGIT_TAPER * size)} ${round(geometry.width * DIGIT_TAPER * size)} 0 0 1 ${place(tip(far))}`);
    parts.push(`L ${place(base(far))}`);
  });
  parts.push(`Q ${place(heelEnd)} ${place(end)}`);
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
  relax: Object.freeze({ thumb: 0.3, index: 0.35, middle: 0.3, ring: 0.4 }),
  // Offering something on an open palm: barely closed, fanned a little, thumb
  // out of the way. One of the brief's priority gestures, and the one the pose
  // list had no answer for -- "présenter" is not a fist and it is not a wave.
  present: Object.freeze({
    thumb: Object.freeze({ curl: 0.15, turn: -18 }), index: Object.freeze({ curl: 0.22, turn: -10 }),
    middle: 0.2, ring: Object.freeze({ curl: 0.26, turn: 10 })
  })
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
export const HAND_LINE = '#8f5c3c';

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
export function handShape(side, pose = 'open', { at = null, box = {}, curl = null, back = false, turn = 0 } = {}) {
  return handPath({
    // `curl` overrides the named pose, which is how one digit is bent on its own.
    curl: curl || HAND_POSE_CURLS[pose] || {},
    at: at || handRestPoint(side, box),
    mirror: side === 'right',
    back,
    turn,
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

/** The same hand yawed, for the two shape keys that let it face somewhere. */
export const handTurnPath = (side, turn, options = {}) => handShape(side, 'open', { ...options, turn });

/**
 * A digit's fingertip on the artboard, for the handle that bends that finger.
 *
 * Same geometry as the outline, placed the same way, so the handle sits on the
 * fingertip at every pose and every size.
 */
export function handDigitTip(side, digitId, { at = null, box = {}, curl = null, back = false, turn = 0 } = {}) {
  const digit = HAND_DIGITS.find((item) => item.id === digitId);
  if (!digit) return null;
  const anchor = at || handRestPoint(side, box);
  const size = handScale(box);
  const flip = (side === 'right') !== Boolean(back) ? -1 : 1;
  const { tip } = digitGeometry(digit, (curl || {})[digitId], turn);
  return { x: round(anchor.x + tip.x * flip * size), y: round(anchor.y + tip.y * size) };
}

/** Every digit closed at once: the grip, as one continuous control. */
export const HAND_GRIP_CURL = Object.freeze({ thumb: 0.75, index: 1, middle: 1, ring: 1 });
