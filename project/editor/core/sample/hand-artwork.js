/**
 * A cartoon glove hand, generated rather than imported, as parts
 * (docs/HAND_REPRESENTATIONS_STUDY.md).
 *
 * ```text
 * handLeft  (g)                  paint order, back → front
 *  ├─ handLeftPalm     M C×9 Z  + M C C     the palm, and the heel of the thumb
 *  ├─ handLeftRing     M C×10   + M C C  ─┐ bezier tubes with a round tip, open
 *  ├─ handLeftMiddle   M C×10   + M C C   │ at the base so the root melts into
 *  ├─ handLeftIndex    M C×10   + M C C   │ the palm; the second sub-path is the
 *  ├─ handLeftThumb    M C×10   + M C C  ─┘ fold across a bent knuckle
 *  └─ handLeftCuff     M L C L C L C L C Z  the band at the wrist
 * ```
 *
 * The hand used to be **one outline**, and that outline could not draw a side
 * view, a finger separation, an OK sign or a turn that passes through a
 * profile: every digit was visited once, left to right, so nothing could
 * overlap and no line could sit inside the silhouette. Six parts can, and the
 * look follows the classic four-fingered glove sheets: fat fingers with a round
 * tip, a soft palm, a cuff, one even line.
 *
 * Every curve is a Catmull-Rom spline through a **fixed number of points**, so
 * a pose can move the points anywhere and the command list never changes. That
 * is what a shape key needs, and it holds by construction: there is no way to
 * author a Fist whose layout does not match the open hand.
 *
 * A **view** is a full table — the palm towards the viewer, or a profile with
 * the thumb towards the viewer — and a **pose** is a sparse override of one:
 * `fist` is `{ curl: 1 }` on three digits and a thumb across. Views and poses
 * are numbers, so the pose editor edits them and this file draws the result.
 *
 * Pure geometry and strings; no DOM. Coordinates are the hand's own: (0, 0) is
 * the middle of the palm, fingers point up, y grows down towards the wrist.
 */
import { parsePath } from '../../../runtime/path-vector.js';

/* ── A small vector kit ────────────────────────────────────────────────────── */
const rad = (degrees) => (degrees * Math.PI) / 180;
const r1 = (value) => Math.round(value * 10) / 10;
const P = (x, y) => ({ x, y });
const add = (a, b) => P(a.x + b.x, a.y + b.y);
const sub = (a, b) => P(a.x - b.x, a.y - b.y);
const mul = (a, k) => P(a.x * k, a.y * k);
const perp = (a) => P(-a.y, a.x);
const rot = (a, t) => P(a.x * Math.cos(t) - a.y * Math.sin(t), a.x * Math.sin(t) + a.y * Math.cos(t));
const mix = (a, b, t) => P(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));

/**
 * Cubic segments through `points` (uniform Catmull-Rom). A fixed point count
 * is a fixed layout whatever the points do, which is all a shape key asks.
 */
function catmull(points, { closed = false, tension = 0.5, place }) {
  const n = points.length;
  const at = (i) => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
  const parts = [`M ${place(points[0])}`];
  for (let i = 0; i < (closed ? n : n - 1); i += 1) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    parts.push(`C ${place(add(p1, mul(sub(p2, p0), tension / 3)))} ${place(sub(p2, mul(sub(p3, p1), tension / 3)))} ${place(p2)}`);
  }
  if (closed) parts.push('Z');
  return parts.join(' ');
}

/* ── The parts ─────────────────────────────────────────────────────────────── */

/** How much a full curl shortens a digit, and how much the knuckle swells. */
const CURL_SHORTEN = 0.6, CURL_SWELL = 0.16;
/** The fold across a knuckle starts to show here, and is fully drawn here. */
const FOLD_FROM = 0.45, FOLD_SPAN = 0.35;

/**
 * One digit: a bent tube with a round tip, open at the base so its root melts
 * into the palm, then the fold across its knuckle as a second sub-path.
 *
 *   curl  0…1  shortens the tube and swells the knuckle — a finger folded away
 *              from the viewer, which is what a fist shows
 *   bend  °    in-plane curvature — the ring of an OK, a thumb hooked over a fist
 *
 * Eleven points make the tube (`M C×10`) and three the fold (`M C C`). At rest
 * the fold's three points sit **on** the tube's own outline, under its stroke,
 * so it is invisible; as the finger bends they slide across the knuckle. One
 * path, one layout, and no opacity to wire: the fold is part of the pose.
 */
function digitTube({ base, angle, length, width, curl = 0, bend = 0, taper = 0.9, place }) {
  const c = clamp01(curl);
  const L = length * (1 - CURL_SHORTEN * c), W = width * (1 + CURL_SWELL * c), theta = rad(bend);
  const dir0 = P(Math.sin(rad(angle)), -Math.cos(rad(angle)));
  const centre = (t) => {
    if (Math.abs(theta) < 1e-6) return { p: add(base, mul(dir0, L * t)), tan: dir0 };
    const R = L / Math.abs(theta), o = add(base, mul(perp(dir0), Math.sign(theta) * R));
    return { p: add(o, rot(sub(base, o), theta * t)), tan: rot(dir0, theta * t) };
  };
  const half = (t) => W * (taper + (1 - taper) * Math.min(1, t * 1.6));
  const ts = [0, 0.33, 0.66, 1];
  const left = ts.map((t) => { const { p, tan } = centre(t); return sub(p, mul(perp(tan), half(t))); });
  const right = ts.map((t) => { const { p, tan } = centre(t); return add(p, mul(perp(tan), half(t))); });
  const tip = centre(1);
  const shoulder = (sign) => add(add(tip.p, mul(perp(tip.tan), W * 0.84 * sign)), mul(tip.tan, W * 0.5));
  const outline = [...left, shoulder(-1), add(tip.p, mul(tip.tan, W)), shoulder(1), ...right.reverse()];
  // The fold: hidden on the left edge, drawn across the knuckle once bent.
  const k = centre(0.4), reach = half(0.4) * 0.64;
  const hidden = sub(k.p, mul(perp(k.tan), half(0.4)));
  const shown = [sub(k.p, mul(perp(k.tan), reach)), add(k.p, mul(k.tan, W * 0.14)), add(k.p, mul(perp(k.tan), reach))];
  const f = clamp01((c - FOLD_FROM) / FOLD_SPAN);
  const fold = shown.map((point) => mix(hidden, point, f));
  return { path: `${catmull(outline, { place, tension: 0.62 })} ${catmull(fold, { place })}`, tip: tip.p };
}

/**
 * The palm: nine points round a soft blob (`M C×9 Z`), then the heel of the
 * thumb as a second sub-path (`M C C`) — one soft line from the thumb root down
 * the palm, shown when the palm faces the viewer and folded onto the outline
 * otherwise, the way a digit's fold is.
 */
function palmBlob({ hw, top, bottom, cx = 0, arch = 3, heel = 1, thumbBase, place }) {
  const pts = [
    P(cx - hw * 0.8, bottom), P(cx - hw, bottom - 9), P(cx - hw * 0.97, top + 7), P(cx - hw * 0.62, top - 0.5),
    P(cx, top - arch), P(cx + hw * 0.62, top - 0.5), P(cx + hw * 0.97, top + 7), P(cx + hw, bottom - 9), P(cx + hw * 0.8, bottom)
  ];
  const b = thumbBase || P(cx - hw * 0.82, 3);
  const shown = [add(b, P(5, 0.5)), add(b, P(7.5, 7.5)), add(b, P(8.5, 15))];
  const hidden = pts[2];
  const crease = shown.map((point) => mix(hidden, point, clamp01(heel)));
  return `${catmull(pts, { closed: true, tension: 0.55, place })} ${catmull(crease, { place })}`;
}

/** The cuff: a rounded band at the wrist, `M L C L C L C L C Z`. */
function cuff({ hw, y, height = 13, flare = 1.14, cx = 0, place }) {
  const w = hw * flare, r = 5.4, top = y, bot = y + height, k = 0.5523 * r;
  return [
    `M ${place(P(cx - w + r, top))}`, `L ${place(P(cx + w - r, top))}`,
    `C ${place(P(cx + w - r + k, top))} ${place(P(cx + w, top + r - k))} ${place(P(cx + w, top + r))}`,
    `L ${place(P(cx + w, bot - r))}`,
    `C ${place(P(cx + w, bot - r + k))} ${place(P(cx + w - r + k, bot))} ${place(P(cx + w - r, bot))}`,
    `L ${place(P(cx - w + r, bot))}`,
    `C ${place(P(cx - w + r - k, bot))} ${place(P(cx - w, bot - r + k))} ${place(P(cx - w, bot - r))}`,
    `L ${place(P(cx - w, top + r))}`,
    `C ${place(P(cx - w, top + r - k))} ${place(P(cx - w + r - k, top))} ${place(P(cx - w + r, top))}`, 'Z'
  ].join(' ');
}

/* ── Views ─────────────────────────────────────────────────────────────────── */

/** The parts of a hand, in the paint order of the palm view (back to front). */
export const HAND_PART_IDS = Object.freeze(['palm', 'ring', 'middle', 'index', 'thumb', 'cuff']);

/** Four digits: a thumb and three fingers, which is the cartoon standard. */
export const HAND_DIGITS = Object.freeze([
  Object.freeze({ id: 'thumb', name: 'Thumb' }), Object.freeze({ id: 'index', name: 'Index' }),
  Object.freeze({ id: 'middle', name: 'Middle' }), Object.freeze({ id: 'ring', name: 'Ring' })
]);

/** Palm towards the viewer: three fat fingers on an arched knuckle line, the thumb off the side. */
const FRONT = Object.freeze({
  palm: { hw: 19.5, top: -14, bottom: 22, arch: 3, cx: 0 },
  digits: {
    thumb: { base: P(-16, 3), angle: -64, length: 16, width: 7.4, taper: 0.92 },
    index: { base: P(-11.5, -13), angle: -10, length: 21, width: 7 },
    middle: { base: P(0.5, -15.5), angle: 1, length: 24, width: 7.1 },
    ring: { base: P(12, -13), angle: 12, length: 20, width: 6.8 }
  },
  order: HAND_PART_IDS,
  heel: 1
});

/** Profile, thumb towards the viewer: a narrow palm, the fingers leaving its front edge one above the other. */
const PROFILE = Object.freeze({
  palm: { hw: 10.5, top: -12, bottom: 22, arch: 2, cx: -1 },
  digits: {
    thumb: { base: P(-2, -8), angle: -8, length: 16, width: 6.9, taper: 0.92 },
    index: { base: P(4, -12), angle: 2, length: 22, width: 6.9 },
    middle: { base: P(7.5, -6.5), angle: 9, length: 20, width: 6.6 },
    ring: { base: P(10.5, -1), angle: 16, length: 17, width: 6.3 }
  },
  order: HAND_PART_IDS,
  heel: 0
});

export const HAND_VIEWS = Object.freeze({ front: FRONT, profile: PROFILE });

/** A pose is a sparse override of a view. Resolve one against the other. */
export function handPoseTable(view = 'front', pose = null) {
  const base = HAND_VIEWS[view] || FRONT;
  const digits = {};
  for (const [id, digit] of Object.entries(base.digits)) digits[id] = { ...digit, ...(pose?.digits?.[id] || {}) };
  return {
    palm: { ...base.palm, ...(pose?.palm || {}) },
    digits,
    order: Array.isArray(pose?.order) && pose.order.length ? pose.order : base.order,
    heel: pose?.heel ?? base.heel
  };
}

/* ── Aiming ────────────────────────────────────────────────────────────────── */

/** Where a digit's tip lands, in the hand's own coordinates. */
export const digitTip = (digit) => digitTube({ ...digit, place: (q) => `${q.x} ${q.y}` }).tip;

/**
 * The angle and bend that bring a digit's tip closest to `target` — what makes
 * an OK a ring and a pinch a pinch, and what the pose editor's *Touch the
 * thumb* does. A grid search: cheap, exact enough, and it never fails.
 */
export function aimDigit(digit, target, { angles = [-70, 10], bends = [-230, 60] } = {}) {
  let best = null;
  for (let a = angles[0]; a <= angles[1]; a += 2) for (let b = bends[0]; b <= bends[1]; b += 4) {
    const tip = digitTip({ ...digit, angle: a, bend: b });
    const d = Math.hypot(tip.x - target.x, tip.y - target.y);
    if (!best || d < best.d) best = { a, b, d };
  }
  return { ...digit, angle: best.a, bend: best.b };
}

/* ── Poses, as tables of numbers ───────────────────────────────────────────── */
const K = Object.freeze({ curl: 1 });
/** The thumb barring a knuckle fist. */
const THUMB_ACROSS = Object.freeze({ base: P(-17, 2), angle: 86, length: 19, width: 8, curl: 0.2, bend: 8 });
const OK_THUMB = Object.freeze({ angle: -52, length: 15, bend: 52, base: P(-16, 1), width: 7.2 });
const OK_INDEX = Object.freeze(aimDigit({ base: P(-11, -13), length: 26, width: 7 }, digitTip(OK_THUMB), { angles: [-70, 10], bends: [-230, -60] }));
const PINCH_THUMB = Object.freeze({ angle: -46, length: 16, bend: 36, base: P(-16, 1), width: 7.2 });
const PINCH_INDEX = Object.freeze(aimDigit({ base: P(-11.5, -13), length: 25, width: 7 }, digitTip(PINCH_THUMB), { angles: [-70, 10], bends: [-230, 0] }));

/**
 * The poses the generated hand ships with, palm towards the viewer. Each is
 * an override of `HAND_VIEWS.front`; the keys are the pose ids.
 */
export const HAND_POSE_TABLES = Object.freeze({
  fist: { heel: 0, palm: { top: -10 }, digits: { index: { ...K, base: P(-12, -10) }, middle: { ...K, base: P(0, -12) }, ring: { ...K, base: P(12, -10) }, thumb: THUMB_ACROSS } },
  point: { heel: 0, digits: { index: { angle: -4, length: 24 }, middle: { ...K, base: P(1, -13) }, ring: { ...K, base: P(12, -11) }, thumb: { ...THUMB_ACROSS, base: P(-17, -1), length: 20 } } },
  peace: { heel: 0, digits: { index: { angle: -18, length: 24 }, middle: { angle: 14, length: 25 }, ring: { ...K, base: P(12, -11) }, thumb: { ...THUMB_ACROSS, base: P(-17, -1), length: 19 } } },
  thumbsUp: { heel: 0, digits: { thumb: { angle: -30, length: 20, width: 7.6, bend: -6, base: P(-15, -2) }, index: { ...K, base: P(-12, -10) }, middle: { ...K, base: P(0, -12) }, ring: { ...K, base: P(12, -10) } } },
  spread: { digits: { thumb: { angle: -74 }, index: { angle: -20 }, middle: { angle: 0 }, ring: { angle: 22 } } },
  relax: { heel: 0, digits: { thumb: { curl: 0.25 }, index: { curl: 0.3 }, middle: { curl: 0.28 }, ring: { curl: 0.35 } } },
  ok: { heel: 0, order: ['palm', 'ring', 'middle', 'thumb', 'index', 'cuff'], digits: { thumb: OK_THUMB, index: OK_INDEX, middle: { angle: 6 }, ring: { angle: 18 } } },
  pinch: { heel: 0, digits: { thumb: PINCH_THUMB, index: PINCH_INDEX, middle: { ...K, base: P(1, -13) }, ring: { ...K, base: P(12, -11) } } },
  stop: { digits: { index: { angle: 1, base: P(-12.8, -13) }, middle: { angle: 0 }, ring: { angle: -1, base: P(13, -13) }, thumb: { angle: -44, length: 15 } } }
});

/** Knuckle bumps stacked down the front edge of a profile fist. */
const PROFILE_FIST = Object.freeze({
  index: { ...K, angle: 86, base: P(6, -10), width: 7 },
  middle: { ...K, angle: 90, base: P(7, -2.5), width: 6.8 },
  ring: { ...K, angle: 94, base: P(7, 5), width: 6.5 }
});

/** The same poses seen in profile, where a profile has its own drawing. */
export const HAND_PROFILE_POSE_TABLES = Object.freeze({
  fist: { palm: { hw: 11.5 }, digits: { ...PROFILE_FIST, thumb: { angle: 92, length: 18, curl: 0.2, base: P(-7, -12), bend: 12, width: 7.2 } } },
  point: { digits: { index: { angle: 2, length: 24 }, middle: { ...K, angle: 88, base: P(7.5, -4), width: 6.8 }, ring: { ...K, angle: 92, base: P(7.5, 3.5), width: 6.6 }, thumb: { angle: -8, length: 13, curl: 0.3, base: P(-3, -10), bend: 10 } } },
  thumbsUp: { palm: { hw: 11.5 }, digits: { ...PROFILE_FIST, thumb: { angle: -4, length: 19, base: P(-4, -13), width: 7.4, bend: -4 } } }
});

/** Every digit closed at once: the grip, as one continuous control. */
export const HAND_GRIP_TABLE = Object.freeze({ digits: { thumb: { curl: 0.6 }, index: K, middle: K, ring: K } });
/** One digit bent on its own. */
export const handDigitCurlTable = (digitId, amount = 1) => ({ digits: { [digitId]: { curl: amount } } });

/* ── Style ─────────────────────────────────────────────────────────────────── */

/**
 * The look is a token, not a drawing: the same parts in the classic white
 * glove with a black line, or in the skin and brown line the face uses.
 */
export const HAND_STYLES = Object.freeze({
  glove: Object.freeze({ id: 'glove', name: 'Cartoon gloves', fill: '#ffffff', line: '#1b1b1b', width: 3.1 }),
  skin: Object.freeze({ id: 'skin', name: 'Skin', fill: '#f6d6ad', line: '#7a4e33', width: 3.1 })
});
export const HAND_DEFAULT_STYLE = 'glove';
export const HAND_SKIN = HAND_STYLES.skin.fill;
export const HAND_LINE = HAND_STYLES.skin.line;

/* ── Placing a hand on the artboard ────────────────────────────────────────── */

export const handElementId = (side) => (side === 'right' ? 'handRight' : 'handLeft');
const capital = (word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
/** `handLeftPalm`, `handRightThumb`… — the group's id, then the part. */
export const handPartId = (side, part) => `${handElementId(side)}${capital(part)}`;
export const HAND_PART_NAMES = Object.freeze({ palm: 'Palm', thumb: 'Thumb', index: 'Index', middle: 'Middle', ring: 'Ring', cuff: 'Cuff' });

/**
 * How far the hand is turned at rest, per side.
 *
 * The parts are drawn with the fingers up and the wrist below, which is the
 * one orientation a hand beside a mascot never has: hanging by the body, the
 * fingers point **down**. Half a turn does that, and it also carries the thumb
 * across to the inner edge — thumbs towards the middle, which is how a pair of
 * hands reads as a pair rather than as two left hands. The extra 20 degrees
 * fans them outwards so they do not sit parallel like a doll's.
 */
export const HAND_REST_TILT = Object.freeze({ left: 200, right: 160 });

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
  return { x: side === 'right' ? width - inset : inset, y: Math.round(height * 0.8) };
}

/**
 * Every part of one hand, as paths in artboard coordinates.
 *
 * Every caller goes through here — the artwork, the rest outlines the shape
 * keys measure against, the poses, the fingertips — so a pose can never be
 * drawn at a different size or place from the hand it deforms.
 *
 * @param {'left'|'right'} side  the right hand is the left one mirrored
 * @param {object} options
 * @param {'front'|'profile'} [options.view]
 * @param {object} [options.pose]       a sparse override of the view (`HAND_POSE_TABLES.fist`)
 * @param {{x,y}} [options.at]          where the middle of the palm sits on the artboard
 * @param {{width,height}} [options.box] the artboard, for the size
 * @param {number} [options.scale]      overrides the artboard size, for a preview
 * @returns {{ order: string[], paths: Record<string,string>, tips: Record<string,{x,y}> }}
 */
export function handParts(side, { view = 'front', pose = null, at = null, box = {}, scale = null } = {}) {
  const table = handPoseTable(view, pose);
  const origin = at || handRestPoint(side, box);
  const size = Number(scale) > 0 ? Number(scale) : handScale(box);
  const flip = side === 'right' ? -1 : 1;
  const place = (p) => `${r1(origin.x + p.x * flip * size)} ${r1(origin.y + p.y * size)}`;
  const paths = {}, tips = {};
  paths.palm = palmBlob({ ...table.palm, heel: table.heel, thumbBase: table.digits.thumb.base, place });
  paths.cuff = cuff({ hw: table.palm.hw, y: table.palm.bottom - 3, cx: table.palm.cx || 0, flare: table.palm.hw < 13 ? 1.5 : 1.14, place });
  for (const digit of HAND_DIGITS) {
    const tube = digitTube({ ...table.digits[digit.id], place });
    paths[digit.id] = tube.path;
    tips[digit.id] = { x: r1(origin.x + tube.tip.x * flip * size), y: r1(origin.y + tube.tip.y * size) };
  }
  return { order: [...table.order], paths, tips };
}

/**
 * How much room the hand takes, as a radius around the middle of its palm in
 * its own drawing units. Read off the parts rather than guessed, and a radius
 * rather than a box because the pair hangs tilted.
 */
export const HAND_LOCAL_RADIUS = (() => {
  const { paths } = handParts('left', { at: { x: 0, y: 0 }, scale: 1 });
  let radius = 0;
  for (const d of Object.values(paths)) {
    const { values } = parsePath(d);
    for (let i = 0; i + 1 < values.length; i += 2) radius = Math.max(radius, Math.hypot(values[i], values[i + 1]));
  }
  return radius;
})();

/**
 * A digit's fingertip on the artboard, for the handle that bends that finger
 * and the attachment point that names it. Same geometry as the drawing, placed
 * the same way, so it is on the finger at every pose and every size.
 *
 * @param {Record<string, number>|null} curl per-digit curl, as the live values give it
 */
export function handDigitTip(side, digitId, { at = null, box = {}, curl = null, view = 'front' } = {}) {
  if (!HAND_DIGITS.some((digit) => digit.id === digitId)) return null;
  const amount = Number(curl?.[digitId]) || 0;
  return handParts(side, { view, at, box, pose: amount ? handDigitCurlTable(digitId, amount) : null }).tips[digitId];
}

/**
 * Where a generated hand is grabbed to move it: the middle of its cuff, in the
 * artwork's own coordinates. The anchor sits at the middle of the palm, and a
 * handle on top of it would take every drag meant for the other; a glove is
 * held by the cuff anyway.
 */
export function handWristPoint(side, { at = null, box = {} } = {}) {
  const origin = at || handRestPoint(side, box);
  const palm = FRONT.palm;
  return { x: r1(origin.x), y: r1(origin.y + (palm.bottom - 3 + 6.5) * handScale(box)) };
}

/* ── Markup ────────────────────────────────────────────────────────────────── */

const partMarkup = (side, part, d, style, size) =>
  `<path id="${handPartId(side, part)}" data-name="${HAND_PART_NAMES[part]}" d="${d}" fill="${style.fill}" stroke="${style.line}" stroke-width="${r1(style.width * size)}" stroke-linejoin="round" stroke-linecap="round" />`;

/**
 * The artwork for one hand: a group of parts, so a pose is a key per part and
 * a view can paint the thumb behind the palm.
 */
export function handArtwork(side, { at = null, box = {}, style = HAND_DEFAULT_STYLE } = {}) {
  const look = HAND_STYLES[style] || HAND_STYLES[HAND_DEFAULT_STYLE];
  const { order, paths } = handParts(side, { at, box });
  const size = handScale(box);
  return `<g id="${handElementId(side)}" data-name="${side === 'right' ? 'Right hand' : 'Left hand'}">${order.map((part) => partMarkup(side, part, paths[part], look, size)).join('')}</g>`;
}

/** Both hands, in paint order. */
export function handsArtwork({ box = {}, style = HAND_DEFAULT_STYLE } = {}) {
  return `<g id="hands" data-name="Hands">${handArtwork('left', { box, style })}${handArtwork('right', { box, style })}</g>`;
}
