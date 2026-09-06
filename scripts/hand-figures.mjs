#!/usr/bin/env node
/**
 * The figures of `docs/HAND_REPRESENTATIONS_STUDY.md`, regenerated.
 *
 * ```sh
 * node scripts/hand-figures.mjs                 # writes docs/figures/hand-*.svg
 * node scripts/hand-figures.mjs --lang fr --out /tmp/figures
 * ```
 *
 * Two generators live here, and neither is wired into the editor:
 *
 * 1. the **current** hand — `handPath()` from `core/sample/hand-artwork.js`,
 *    the one outline the editor draws today — plus three knobs that never add
 *    or remove a command, asked for the views the study wants. Every one keeps
 *    the layout and none of them is drawable; that sheet is the evidence;
 * 2. a **glove** hand made of parts — a soft palm, four bezier tubes with round
 *    tips, a cuff, fold lines that appear where a finger bends — aimed at the
 *    classic four-fingered cartoon glove sheets. Every part keeps a fixed
 *    command layout in every pose, so each is a shape-key target the runtime
 *    already deforms. This is the seed of the study's stage 1.
 *
 * Pure geometry and strings; no DOM. Node ≥ 22.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { HAND_DIGITS, HAND_PALM, HAND_POSE_CURLS, handPath } from '../project/editor/core/sample/hand-artwork.js';
import { parsePath, pathsCompatible, serializePath } from '../project/runtime/path-vector.js';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const LANG = option('--lang', 'en');
const OUT = option('--out', fileURLToPath(new URL('../docs/figures/', import.meta.url)));
mkdirSync(OUT, { recursive: true });

/* ── Shared kit ────────────────────────────────────────────────────────────── */
const rad = (d) => (d * Math.PI) / 180;
const r1 = (v) => Math.round(v * 10) / 10;
const P = (x, y) => ({ x, y });
const add = (a, b) => P(a.x + b.x, a.y + b.y);
const sub = (a, b) => P(a.x - b.x, a.y - b.y);
const mul = (a, k) => P(a.x * k, a.y * k);
const perp = (a) => P(-a.y, a.x);
const rot = (a, t) => P(a.x * Math.cos(t) - a.y * Math.sin(t), a.x * Math.sin(t) + a.y * Math.cos(t));
const label = (text, y = 80) => `<text y="${y}" text-anchor="middle" font-family="JetBrains Mono, ui-monospace, monospace" font-size="11" fill="currentColor">${text}</text>`;
const svgFile = (name, width, height, body) => {
  writeFileSync(`${OUT}/${name}`, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="color:#333">\n${body}\n</svg>`);
  console.log('wrote', `${OUT}/${name}`);
};
/** Blend two path strings of the same layout, which is what a shape key does. */
const blendPaths = (a, b, t) => {
  const pa = parsePath(a), pb = parsePath(b);
  return serializePath(pa.commands, Float64Array.from(pa.values, (v, k) => v + (pb.values[k] - v) * t));
};

/* ════════════════════════════════════════════════════════════════════════════
 * 1. The current outline, asked for a profile
 * ════════════════════════════════════════════════════════════════════════════ */
const CURL_FOLD = 0.78, CURL_TURN = 18;

/** `hand-artwork.js`'s digit, plus `shift` (sideways along the knuckles) and `width` (a scale). */
function outlineDigit(digit, posed) {
  const s = posed && typeof posed === 'object' ? posed : { curl: posed };
  const amount = Math.max(0, Math.min(1, Number(s.curl) || 0));
  const turn = Number(s.turn) || 0, lift = Number(s.lift) || 0, stretch = Number(s.stretch) || 0, shift = Number(s.shift) || 0;
  const widthScale = s.width === undefined ? 1 : Math.max(0, Number(s.width));
  const angle = rad(digit.angle + turn + amount * CURL_TURN * (digit.angle <= 0 ? 1 : -1));
  const length = digit.length * (1 - CURL_FOLD * amount) * (1 + stretch);
  const direction = P(Math.sin(angle), -Math.cos(angle));
  const base = P(digit.base.x + shift + direction.x * lift, digit.base.y + direction.y * lift);
  return { base, width: digit.width * widthScale, normal: perp(direction), tip: add(base, mul(direction, length)) };
}

/** `handPath()` with a palm width and skew: the same 19 commands, whatever it is asked for. */
function outlinePath({ curl = {}, palm = {}, at = P(0, 0), back = false } = {}) {
  const flip = back ? -1 : 1;
  const pw = palm.width === undefined ? 1 : Number(palm.width), skew = Number(palm.skew) || 0;
  const place = (p) => `${r1(at.x + p.x * flip)} ${r1(at.y + p.y)}`;
  const digits = back ? [...HAND_DIGITS].reverse() : [...HAND_DIGITS];
  const wristL = P(-HAND_PALM.halfWidth * pw + skew, HAND_PALM.wrist), wristR = P(HAND_PALM.halfWidth * pw + skew, HAND_PALM.wrist);
  const parts = [`M ${place(back ? wristR : wristL)}`];
  for (const digit of digits) {
    const { base, tip, normal, width } = outlineDigit(digit, curl[digit.id]);
    const side = (p, sign) => add(p, mul(normal, width * sign));
    const near = back ? 1 : -1, far = -near;
    parts.push(`L ${place(side(base, near))}`, `L ${place(side(tip, near))}`, `A ${r1(width)} ${r1(width)} 0 0 1 ${place(side(tip, far))}`, `L ${place(side(base, far))}`);
  }
  parts.push(`L ${place(back ? wristL : wristR)}`, 'Z');
  return parts.join(' ');
}

const OUTLINE_VIEWS = {
  side: { palm: { width: 0.42, skew: 2 }, curl: { thumb: { curl: 0.15, turn: 30, shift: 8, lift: 2, width: 0.85 }, index: { curl: 0, turn: 4, shift: 6, width: 0.9 }, middle: { curl: 0, turn: 6, shift: -3, lift: -1, width: 0.55, stretch: -0.06 }, ring: { curl: 0, turn: 8, shift: -11, lift: -2, width: 0.3, stretch: -0.14 } } },
  pointSide: { palm: { width: 0.45, skew: 2 }, curl: { thumb: { curl: 0.45, turn: 40, shift: 8, lift: 1, width: 0.85 }, index: { curl: 0, turn: 2, shift: 6, width: 0.95 }, middle: { curl: 1, shift: -4, width: 0.6 }, ring: { curl: 1, shift: -12, width: 0.35 } } },
  thumbsUpSide: { palm: { width: 0.5, skew: 1 }, curl: { thumb: { curl: 0, turn: 66, lift: 5, stretch: 0.25, shift: 6, width: 0.95 }, index: { curl: 1, shift: 6, width: 0.95 }, middle: { curl: 1, shift: -4, width: 0.6 }, ring: { curl: 1, shift: -12, width: 0.35 } } },
  fistSide: { palm: { width: 0.5, skew: 1 }, curl: { thumb: { curl: 0.8, turn: 55, shift: 9, lift: 2, width: 0.9 }, index: { curl: 1, shift: 6, width: 0.95 }, middle: { curl: 1, shift: -4, width: 0.6 }, ring: { curl: 1, shift: -12, width: 0.35 } } },
  pinch: { palm: { width: 0.9 }, curl: { thumb: { curl: 0.1, turn: 46, lift: 4, stretch: 0.15 }, index: { curl: 0.35, turn: -30 }, middle: 0.9, ring: 1 } },
  stop: { palm: { width: 1 }, curl: { thumb: { curl: 0, turn: -6 }, index: { curl: 0, turn: 6, shift: 2 }, middle: { curl: 0, turn: 0 }, ring: { curl: 0, turn: -6, shift: -2 } } }
};

function outlineSheet() {
  const at = P(0, 0);
  const rest = handPath({ at });
  const cells = [];
  const add_ = (name, d) => cells.push({ name, d, ok: pathsCompatible(rest, d) });
  for (const pose of Object.keys(HAND_POSE_CURLS)) add_(pose, handPath({ at, curl: HAND_POSE_CURLS[pose] }));
  add_('back', handPath({ at, back: true }));
  for (const [id, view] of Object.entries(OUTLINE_VIEWS)) add_(id, outlinePath({ at, ...view }));
  add_('flip @0.5', blendPaths(rest, handPath({ at, back: true }), 0.5));
  add_('side @0.5', blendPaths(rest, outlinePath({ at, ...OUTLINE_VIEWS.side }), 0.5));
  const both = (a, b) => { const pa = parsePath(rest), pb = parsePath(a), pc = parsePath(b); return serializePath(pa.commands, Float64Array.from(pa.values, (v, k) => pb.values[k] + pc.values[k] - v)); };
  add_('side+fist', both(outlinePath({ at, ...OUTLINE_VIEWS.side }), handPath({ at, curl: HAND_POSE_CURLS.fist })));
  add_('side+point', both(outlinePath({ at, ...OUTLINE_VIEWS.side }), handPath({ at, curl: HAND_POSE_CURLS.point })));
  const CELL = 142, ROW = 176, COLS = 6, S = 1.9;
  const body = cells.map((cell, index) => `<g transform="translate(${(index % COLS) * CELL + CELL / 2} ${Math.floor(index / COLS) * ROW + 92})">
    <path d="${cell.d}" transform="scale(${S})" fill="#f6d6ad" stroke="#9a6544" stroke-width="${3 / S}" stroke-linejoin="round"/>${label(cell.name, 64)}</g>`).join('\n');
  svgFile('hand-views-single-outline.svg', COLS * CELL, Math.ceil(cells.length / COLS) * ROW, body);
  return cells;
}

/* ════════════════════════════════════════════════════════════════════════════
 * 2. A glove hand, as parts
 * ════════════════════════════════════════════════════════════════════════════ */

/** Cubic segments through `points` (Catmull-Rom). A fixed point count is a fixed layout. */
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

/**
 * One digit: a bent tube with a round tip, open at the base so its root melts
 * into the palm. Twelve points → `M C×11`, in every pose.
 *
 *   curl  0…1  shortens it and swells the knuckle — a finger folded away from
 *              the viewer, which is what a fist shows
 *   bend  °    in-plane curvature — the ring of an OK, a thumb hooked over a fist
 */
function digitTube({ base, angle, length, width, curl = 0, bend = 0, taper = 0.9, place }) {
  const c = Math.max(0, Math.min(1, curl));
  const L = length * (1 - 0.6 * c), W = width * (1 + 0.16 * c), theta = rad(bend);
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
  const points = [...left, shoulder(-1), add(tip.p, mul(tip.tan, W)), shoulder(1), ...right.reverse()];
  // A fold across the knuckle, only once the finger is well bent: 3 points → `M C C`.
  const k = centre(0.4), reach = half(0.4) * 0.64;
  const fold = catmull([sub(k.p, mul(perp(k.tan), reach)), add(k.p, mul(k.tan, W * 0.14)), add(k.p, mul(perp(k.tan), reach))], { place });
  return { path: catmull(points, { place, tension: 0.62 }), fold, foldOpacity: Math.max(0, Math.min(1, (c - 0.45) / 0.35)), tip: tip.p };
}

/** The palm: nine points round a soft blob, `M C×9 Z`. */
function palmBlob({ hw = 19.5, top = -14, bottom = 22, cx = 0, arch = 3, place }) {
  return catmull([
    P(cx - hw * 0.8, bottom), P(cx - hw, bottom - 9), P(cx - hw * 0.97, top + 7), P(cx - hw * 0.62, top - 0.5),
    P(cx, top - arch), P(cx + hw * 0.62, top - 0.5), P(cx + hw * 0.97, top + 7), P(cx + hw, bottom - 9), P(cx + hw * 0.8, bottom)
  ], { closed: true, tension: 0.55, place });
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

/** Palm towards the viewer: three fat fingers on an arched knuckle line, the thumb off the side. */
const FRONT = {
  palm: { hw: 19.5, top: -14, bottom: 22, arch: 3 },
  digits: {
    thumb: { base: P(-16, 3), angle: -64, length: 16, width: 7.4, taper: 0.92 },
    index: { base: P(-11.5, -13), angle: -10, length: 21, width: 7 },
    middle: { base: P(0.5, -15.5), angle: 1, length: 24, width: 7.1 },
    ring: { base: P(12, -13), angle: 12, length: 20, width: 6.8 }
  },
  order: ['palm', 'ring', 'middle', 'index', 'thumb', 'cuff'],
  heel: 1
};

/** Profile, thumb towards the viewer: a narrow palm, the fingers leaving its front edge one above the other. */
const PROFILE = {
  palm: { hw: 10.5, top: -12, bottom: 22, arch: 2, cx: -1 },
  digits: {
    thumb: { base: P(-2, -8), angle: -8, length: 16, width: 6.9, taper: 0.92 },
    index: { base: P(4, -12), angle: 2, length: 22, width: 6.9 },
    middle: { base: P(7.5, -6.5), angle: 9, length: 20, width: 6.6 },
    ring: { base: P(10.5, -1), angle: 16, length: 17, width: 6.3 }
  },
  order: ['palm', 'ring', 'middle', 'index', 'thumb', 'cuff'],
  heel: 0
};

function posed(view, pose = {}) {
  const digits = {};
  for (const [id, digit] of Object.entries(view.digits)) digits[id] = { ...digit, ...(pose.digits?.[id] || {}) };
  return { ...view, ...pose, digits, palm: { ...view.palm, ...(pose.palm || {}) }, order: pose.order || view.order, heel: pose.heel ?? view.heel };
}

/**
 * Every part of one hand as a path, in paint order.
 * @returns {{ parts: {id, d, kind, opacity}[], all: Record<string, {d}>, tips: Record<string, {x,y}> }}
 */
export function gloveHand(view, pose = {}, { at = P(0, 0), mirror = false, scale = 1 } = {}) {
  const table = posed(view, pose);
  const flip = mirror ? -1 : 1;
  const place = (p) => `${r1(at.x + p.x * flip * scale)} ${r1(at.y + p.y * scale)}`;
  const parts = {}, tips = {};
  parts.palm = { id: 'palm', kind: 'fill', d: palmBlob({ ...table.palm, place }) };
  parts.cuff = { id: 'cuff', kind: 'fill', d: cuff({ hw: table.palm.hw, y: table.palm.bottom - 3, cx: table.palm.cx || 0, place, flare: table.palm.hw < 13 ? 1.5 : 1.14 }) };
  for (const [id, digit] of Object.entries(table.digits)) {
    const tube = digitTube({ ...digit, place });
    parts[id] = { id, kind: 'fill', d: tube.path };
    parts[`${id}Fold`] = { id: `${id}Fold`, kind: 'line', d: tube.fold, opacity: tube.foldOpacity };
    tips[id] = tube.tip;
  }
  // The heel of the thumb: one soft line from the thumb root down the palm,
  // shown only when the palm faces the viewer.
  const b = table.digits.thumb.base;
  parts.heel = { id: 'heel', kind: 'line', opacity: table.heel, d: catmull([add(b, P(5, 0.5)), add(b, P(7.5, 7.5)), add(b, P(8.5, 15))], { place, tension: 0.5 }) };
  const painted = [];
  for (const id of table.order) {
    painted.push(parts[id]);
    if (id === 'palm') painted.push(parts.heel);
    if (parts[`${id}Fold`]) painted.push(parts[`${id}Fold`]);
  }
  return { parts: painted, all: parts, tips };
}

/* Poses, as tables of numbers. */
const K = { curl: 1 };
/** Knuckle bumps stacked down the front edge of a profile fist. */
const PROFILE_FIST = {
  index: { ...K, angle: 86, base: P(6, -10), width: 7 },
  middle: { ...K, angle: 90, base: P(7, -2.5), width: 6.8 },
  ring: { ...K, angle: 94, base: P(7, 5), width: 6.5 }
};
/** The thumb barring a knuckle fist. */
const THUMB_ACROSS = { base: P(-17, 2), angle: 86, length: 19, width: 8, curl: 0.2, bend: 8 };
/** Tip of a tube, for aiming one digit at another. */
const tubeTip = (digit) => digitTube({ ...digit, place: (q) => `${q.x} ${q.y}` }).tip;
/** The angle and bend that bring a digit's tip closest to `target`. */
function aimed(digit, target, { angles, bends }) {
  let best = null;
  for (let a = angles[0]; a <= angles[1]; a += 2) for (let b = bends[0]; b <= bends[1]; b += 4) {
    const tip = tubeTip({ ...digit, angle: a, bend: b });
    const d = Math.hypot(tip.x - target.x, tip.y - target.y);
    if (!best || d < best.d) best = { a, b, d };
  }
  return { ...digit, angle: best.a, bend: best.b };
}
const OK_THUMB = { angle: -52, length: 15, bend: 52, base: P(-16, 1), width: 7.2 };
const OK_INDEX = aimed({ base: P(-11, -13), length: 26, width: 7 }, tubeTip(OK_THUMB), { angles: [-70, 10], bends: [-230, -60] });
const PINCH_THUMB = { angle: -46, length: 16, bend: 36, base: P(-16, 1), width: 7.2 };
const PINCH_INDEX = aimed({ base: P(-11.5, -13), length: 25, width: 7 }, tubeTip(PINCH_THUMB), { angles: [-70, 10], bends: [-230, 0] });

const LABELS = {
  en: { open: 'open (palm)', wave: 'back of the hand', stop: 'stop', fist: 'fist', point: 'index up', peace: 'peace', ok: 'OK', pinch: 'pinch', side: 'profile, open', pointSide: 'profile, pointing', thumbsUp: 'thumbs up (profile)', fistSide: 'fist (profile)', sideAway: 'profile, thumb hidden', hold: 'holding a rod', curl: 'curl', facing: 'facing' },
  fr: { open: 'ouverte (paume)', wave: 'dos de la main', stop: 'stop', fist: 'poing', point: 'index levé', peace: 'victoire', ok: 'OK', pinch: 'pincer', side: 'profil ouvert', pointSide: 'profil, index pointé', thumbsUp: 'pouce levé (profil)', fistSide: 'poing (profil)', sideAway: 'profil, pouce caché', hold: 'tient un bâton', curl: 'curl', facing: 'facing' }
}[LANG] || LABELS.en;

export const GLOVE_POSES = [
  { id: 'open', view: FRONT, pose: {} },
  { id: 'wave', view: FRONT, mirror: true, pose: { heel: 0, digits: { index: { angle: -16 }, ring: { angle: 18 }, thumb: { angle: -72 } } } },
  { id: 'stop', view: FRONT, pose: { digits: { index: { angle: 1, base: P(-12.8, -13) }, middle: { angle: 0 }, ring: { angle: -1, base: P(13, -13) }, thumb: { angle: -44, length: 15 } } } },
  { id: 'fist', view: FRONT, pose: { heel: 0, palm: { top: -10 }, digits: { index: { ...K, base: P(-12, -10) }, middle: { ...K, base: P(0, -12) }, ring: { ...K, base: P(12, -10) }, thumb: THUMB_ACROSS } } },
  { id: 'point', view: FRONT, pose: { heel: 0, digits: { index: { angle: -4, length: 24 }, middle: { ...K, base: P(1, -13) }, ring: { ...K, base: P(12, -11) }, thumb: { ...THUMB_ACROSS, base: P(-17, -1), length: 20 } } } },
  { id: 'peace', view: FRONT, pose: { heel: 0, digits: { index: { angle: -18, length: 24 }, middle: { angle: 14, length: 25 }, ring: { ...K, base: P(12, -11) }, thumb: { ...THUMB_ACROSS, base: P(-17, -1), length: 19 } } } },
  { id: 'ok', view: FRONT, pose: { heel: 0, order: ['palm', 'ring', 'middle', 'thumb', 'index', 'cuff'], digits: { thumb: OK_THUMB, index: OK_INDEX, middle: { angle: 6 }, ring: { angle: 18 } } } },
  { id: 'pinch', view: FRONT, pose: { heel: 0, digits: { thumb: PINCH_THUMB, index: PINCH_INDEX, middle: { ...K, base: P(1, -13) }, ring: { ...K, base: P(12, -11) } } } },
  { id: 'side', view: PROFILE, pose: {} },
  { id: 'pointSide', view: PROFILE, rotate: 90, pose: { digits: { index: { angle: 2, length: 24 }, middle: { ...K, angle: 88, base: P(7.5, -4), width: 6.8 }, ring: { ...K, angle: 92, base: P(7.5, 3.5), width: 6.6 }, thumb: { angle: -8, length: 13, curl: 0.3, base: P(-3, -10), bend: 10 } } } },
  { id: 'thumbsUp', view: PROFILE, pose: { palm: { hw: 11.5 }, digits: { ...PROFILE_FIST, thumb: { angle: -4, length: 19, base: P(-4, -13), width: 7.4, bend: -4 } } } },
  { id: 'fistSide', view: PROFILE, pose: { palm: { hw: 11.5 }, digits: { ...PROFILE_FIST, thumb: { angle: 92, length: 18, curl: 0.2, base: P(-7, -12), bend: 12, width: 7.2 } } } },
  { id: 'sideAway', view: PROFILE, mirror: true, pose: { order: ['thumb', 'palm', 'ring', 'middle', 'index', 'cuff'], digits: { thumb: { base: P(-1, -6), angle: -40 } } } },
  { id: 'hold', view: PROFILE, rod: true, pose: { palm: { hw: 11.5 }, digits: { ...PROFILE_FIST, thumb: { angle: 88, length: 17, curl: 0.2, base: P(-6, -13), bend: 16, width: 7.2 } } } }
];

/* Painting. */
export const STYLE = {
  glove: { fill: '#ffffff', line: '#1b1b1b', width: 3.1, fold: 2.2 },
  skin: { fill: '#f6d6ad', line: '#7a4e33', width: 3.1, fold: 2.2 }
};
function paintPart(part, s) {
  if (part.kind === 'fill') return `<path d="${part.d}" fill="${s.fill}" stroke="${s.line}" stroke-width="${s.width}" stroke-linejoin="round" stroke-linecap="round"/>`;
  return part.opacity > 0.02 ? `<path d="${part.d}" fill="none" stroke="${s.line}" stroke-width="${s.fold}" stroke-linecap="round" opacity="${r1(part.opacity)}"/>` : '';
}
function paintHand(hand, style, { rod = false } = {}) {
  const s = STYLE[style];
  const [palm, ...others] = hand.parts;
  // A held object sits between the palm and the fingers that close on it.
  const held = rod ? `<rect x="0.5" y="-40" width="9.5" height="76" rx="4.75" fill="#d9c39a" stroke="${s.line}" stroke-width="${s.width}"/>` : '';
  return paintPart(palm, s) + held + others.map((part) => paintPart(part, s)).join('');
}

const CELL = 150, ROW = 190, S = 1.55;
function gloveSheet(entries, style, file, cols) {
  const body = entries.map((entry, index) => {
    const hand = gloveHand(entry.view, entry.pose, { mirror: Boolean(entry.mirror) });
    return `<g transform="translate(${(index % cols) * CELL + CELL / 2} ${Math.floor(index / cols) * ROW + 96})"><g transform="scale(${S}) rotate(${entry.rotate || 0})">${paintHand(hand, style, { rod: entry.rod })}</g>${label(LABELS[entry.id])}</g>`;
  }).join('\n');
  svgFile(file, cols * CELL, Math.ceil(entries.length / cols) * ROW, body);
}

function blendHands(a, b, t) {
  return { parts: a.parts.map((part, i) => ({ ...part, d: blendPaths(part.d, b.parts[i].d, t), opacity: (part.opacity ?? 1) + ((b.parts[i].opacity ?? 1) - (part.opacity ?? 1)) * t })) };
}
function rampSheet() {
  const curl = [0, 0.25, 0.5, 0.75, 1].map((c) => ({ name: `${LABELS.curl} ${c}`, hand: gloveHand(FRONT, { heel: 0, digits: { index: { curl: c }, middle: { curl: c }, ring: { curl: c } } }) }));
  const open = gloveHand(FRONT, { heel: 0 }), side = gloveHand(PROFILE, {});
  const facing = [0, 0.33, 0.66, 1].map((t) => ({ name: `${LABELS.facing} ${t}`, hand: t === 0 ? open : t === 1 ? side : blendHands(open, side, t) }));
  const all = [...curl, ...facing];
  const body = all.map((entry, index) => `<g transform="translate(${index * CELL + CELL / 2} 96)"><g transform="scale(${S})">${paintHand(entry.hand, 'glove')}</g>${label(entry.name)}</g>`).join('\n');
  svgFile('hand-glove-ramps.svg', all.length * CELL, ROW, body);
}

/* ── Checks, then the files ────────────────────────────────────────────────── */
const outlineCells = outlineSheet();
console.log(`outline: ${outlineCells.filter((c) => c.ok).length}/${outlineCells.length} views keep the single outline's layout`);
const rest = gloveHand(FRONT).all, restProfile = gloveHand(PROFILE).all;
for (const entry of GLOVE_POSES) {
  const base = entry.view === FRONT ? rest : restProfile;
  const hand = gloveHand(entry.view, entry.pose);
  const bad = Object.keys(hand.all).filter((id) => !pathsCompatible(base[id].d, hand.all[id].d));
  if (bad.length) throw new Error(`${entry.id}: layout changed on ${bad.join(', ')}`);
}
const across = Object.keys(rest).filter((id) => !pathsCompatible(rest[id].d, restProfile[id].d));
if (across.length) throw new Error(`front and profile differ on ${across.join(', ')}`);
console.log(`glove: every part keeps its layout in ${GLOVE_POSES.length} poses; front and profile share every layout`);
console.log(`glove layouts — palm ${parsePath(rest.palm.d).signature} · digit ${parsePath(rest.index.d).signature} · cuff ${parsePath(rest.cuff.d).signature}`);
gloveSheet(GLOVE_POSES, 'glove', 'hand-glove.svg', 7);
gloveSheet(GLOVE_POSES.filter((p) => ['open', 'fist', 'thumbsUp', 'pointSide', 'ok'].includes(p.id)), 'skin', 'hand-glove-skin.svg', 5);
rampSheet();
