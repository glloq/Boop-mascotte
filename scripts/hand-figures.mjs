#!/usr/bin/env node
/**
 * The figures of `docs/HAND_REPRESENTATIONS_STUDY.md`, regenerated.
 *
 * ```sh
 * npm run figures:hands                          # writes docs/figures/hand-*.svg
 * node scripts/hand-figures.mjs --lang fr --out /tmp/figures
 * ```
 *
 * Two generators draw them:
 *
 * 1. the **former** hand — the one outline the editor drew before it drew
 *    parts, kept here as it was, plus three knobs that never add or remove a
 *    command, asked for the views the study wanted. Every one keeps the layout
 *    and none of them is drawable; that sheet is the evidence;
 * 2. the **shipped** hand — `core/sample/hand-artwork.js`, the glove made of
 *    parts the editor draws today, painted from its own tables so the figures
 *    are what a project gets.
 *
 * Pure geometry and strings; no DOM. Node ≥ 22.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  HAND_PART_IDS, HAND_POSE_TABLES, HAND_PROFILE_POSE_TABLES, HAND_STYLES, handDigitCurlTable, handParts
} from '../project/editor/core/sample/hand-artwork.js';
import { parsePath, pathsCompatible, serializePath } from '../project/runtime/path-vector.js';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : fallback; };
const LANG = option('--lang', 'en');
const OUT = option('--out', fileURLToPath(new URL('../docs/figures/', import.meta.url)));
mkdirSync(OUT, { recursive: true });

const rad = (d) => (d * Math.PI) / 180;
const r1 = (v) => Math.round(v * 10) / 10;
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
 * 1. The former outline, asked for a profile
 * ════════════════════════════════════════════════════════════════════════════ */
const OUTLINE_PALM = { halfWidth: 19, wrist: 23 };
const OUTLINE_DIGITS = [
  { id: 'thumb', base: { x: -16, y: 6 }, angle: -74, length: 15, width: 6.5 },
  { id: 'index', base: { x: -10, y: -12 }, angle: -17, length: 21, width: 6 },
  { id: 'middle', base: { x: 1, y: -15 }, angle: 0, length: 24, width: 6 },
  { id: 'ring', base: { x: 12, y: -12 }, angle: 16, length: 20, width: 6 }
];
const OUTLINE_POSES = {
  open: {},
  fist: { thumb: 0.75, index: 1, middle: 1, ring: 1 },
  point: { thumb: 0.7, index: 0, middle: 1, ring: 1 },
  peace: { thumb: 0.8, index: { curl: 0, turn: -12 }, middle: { curl: 0, turn: 12 }, ring: 1 },
  thumbsUp: { thumb: { curl: 0, turn: 40, lift: 4, stretch: 0.7 }, index: 1, middle: 1, ring: 1 },
  spread: { thumb: { curl: 0, turn: -14 }, index: { curl: 0, turn: -14 }, middle: 0, ring: { curl: 0, turn: 14 } },
  relax: { thumb: 0.3, index: 0.35, middle: 0.3, ring: 0.4 }
};
const CURL_FOLD = 0.78, CURL_TURN = 18;

/** The former digit, plus `shift` (sideways along the knuckles) and `width` (a scale). */
function outlineDigit(digit, posed) {
  const s = posed && typeof posed === 'object' ? posed : { curl: posed };
  const amount = Math.max(0, Math.min(1, Number(s.curl) || 0));
  const turn = Number(s.turn) || 0, lift = Number(s.lift) || 0, stretch = Number(s.stretch) || 0, shift = Number(s.shift) || 0;
  const widthScale = s.width === undefined ? 1 : Math.max(0, Number(s.width));
  const angle = rad(digit.angle + turn + amount * CURL_TURN * (digit.angle <= 0 ? 1 : -1));
  const length = digit.length * (1 - CURL_FOLD * amount) * (1 + stretch);
  const direction = { x: Math.sin(angle), y: -Math.cos(angle) };
  const base = { x: digit.base.x + shift + direction.x * lift, y: digit.base.y + direction.y * lift };
  return { base, width: digit.width * widthScale, normal: { x: -direction.y, y: direction.x }, tip: { x: base.x + direction.x * length, y: base.y + direction.y * length } };
}

/** The former `handPath()` with a palm width and skew: the same 19 commands, whatever it is asked for. */
function outlinePath({ curl = {}, palm = {}, back = false } = {}) {
  const flip = back ? -1 : 1;
  const pw = palm.width === undefined ? 1 : Number(palm.width), skew = Number(palm.skew) || 0;
  const place = (p) => `${r1(p.x * flip)} ${r1(p.y)}`;
  const digits = back ? [...OUTLINE_DIGITS].reverse() : [...OUTLINE_DIGITS];
  const wristL = { x: -OUTLINE_PALM.halfWidth * pw + skew, y: OUTLINE_PALM.wrist }, wristR = { x: OUTLINE_PALM.halfWidth * pw + skew, y: OUTLINE_PALM.wrist };
  const parts = [`M ${place(back ? wristR : wristL)}`];
  for (const digit of digits) {
    const { base, tip, normal, width } = outlineDigit(digit, curl[digit.id]);
    const side = (p, sign) => ({ x: p.x + normal.x * width * sign, y: p.y + normal.y * width * sign });
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
  const rest = outlinePath();
  const cells = [];
  const add = (name, d) => cells.push({ name, d, ok: pathsCompatible(rest, d) });
  for (const [pose, curl] of Object.entries(OUTLINE_POSES)) add(pose, outlinePath({ curl }));
  add('back', outlinePath({ back: true }));
  for (const [id, view] of Object.entries(OUTLINE_VIEWS)) add(id, outlinePath(view));
  add('flip @0.5', blendPaths(rest, outlinePath({ back: true }), 0.5));
  add('side @0.5', blendPaths(rest, outlinePath(OUTLINE_VIEWS.side), 0.5));
  const both = (a, b) => { const pa = parsePath(rest), pb = parsePath(a), pc = parsePath(b); return serializePath(pa.commands, Float64Array.from(pa.values, (v, k) => pb.values[k] + pc.values[k] - v)); };
  add('side+fist', both(outlinePath(OUTLINE_VIEWS.side), outlinePath({ curl: OUTLINE_POSES.fist })));
  add('side+point', both(outlinePath(OUTLINE_VIEWS.side), outlinePath({ curl: OUTLINE_POSES.point })));
  const CELL = 142, ROW = 176, COLS = 6, S = 1.9;
  const body = cells.map((cell, index) => `<g transform="translate(${(index % COLS) * CELL + CELL / 2} ${Math.floor(index / COLS) * ROW + 92})">
    <path d="${cell.d}" transform="scale(${S})" fill="#f6d6ad" stroke="#9a6544" stroke-width="${3 / S}" stroke-linejoin="round"/>${label(cell.name, 64)}</g>`).join('\n');
  svgFile('hand-views-single-outline.svg', COLS * CELL, Math.ceil(cells.length / COLS) * ROW, body);
  return cells;
}

/* ════════════════════════════════════════════════════════════════════════════
 * 2. The shipped hand: the parts the editor draws, from its own tables
 * ════════════════════════════════════════════════════════════════════════════ */
const LABELS = {
  en: { open: 'open (palm)', wave: 'back of the hand', stop: 'stop', fist: 'fist', point: 'index up', peace: 'peace', thumbsUp: 'thumbs up', spread: 'spread', relax: 'relax', ok: 'OK', pinch: 'pinch', side: 'profile, open', pointSide: 'profile, pointing', thumbsUpSide: 'thumbs up (profile)', fistSide: 'fist (profile)', sideAway: 'profile, thumb hidden', hold: 'holding a rod', curl: 'curl', facing: 'facing' },
  fr: { open: 'ouverte (paume)', wave: 'dos de la main', stop: 'stop', fist: 'poing', point: 'index levé', peace: 'victoire', thumbsUp: 'pouce levé', spread: 'écartée', relax: 'détendue', ok: 'OK', pinch: 'pincer', side: 'profil ouvert', pointSide: 'profil, index pointé', thumbsUpSide: 'pouce levé (profil)', fistSide: 'poing (profil)', sideAway: 'profil, pouce caché', hold: 'tient un bâton', curl: 'curl', facing: 'facing' }
}[LANG] || LABELS.en;

/** Each cell: a view, a pose table from the editor, and how it is shown. */
const GLOVE_CELLS = [
  { id: 'open', view: 'front' },
  { id: 'wave', view: 'front', mirror: true, pose: { heel: 0, digits: { index: { angle: -16 }, ring: { angle: 18 }, thumb: { angle: -72 } } } },
  { id: 'stop', view: 'front', pose: HAND_POSE_TABLES.stop },
  { id: 'fist', view: 'front', pose: HAND_POSE_TABLES.fist },
  { id: 'point', view: 'front', pose: HAND_POSE_TABLES.point },
  { id: 'peace', view: 'front', pose: HAND_POSE_TABLES.peace },
  { id: 'thumbsUp', view: 'front', pose: HAND_POSE_TABLES.thumbsUp },
  { id: 'ok', view: 'front', pose: HAND_POSE_TABLES.ok },
  { id: 'pinch', view: 'front', pose: HAND_POSE_TABLES.pinch },
  { id: 'spread', view: 'front', pose: HAND_POSE_TABLES.spread },
  { id: 'relax', view: 'front', pose: HAND_POSE_TABLES.relax },
  { id: 'side', view: 'profile' },
  { id: 'pointSide', view: 'profile', pose: HAND_PROFILE_POSE_TABLES.point, rotate: 90 },
  { id: 'thumbsUpSide', view: 'profile', pose: HAND_PROFILE_POSE_TABLES.thumbsUp },
  { id: 'fistSide', view: 'profile', pose: HAND_PROFILE_POSE_TABLES.fist },
  // The same profile from the other side: only the paint order changes.
  { id: 'sideAway', view: 'far', flip: true, pose: { order: ['thumb', 'palm', 'ring', 'middle', 'index', 'cuff'] } },
  { id: 'hold', view: 'profile', rod: true, pose: { ...HAND_PROFILE_POSE_TABLES.fist, digits: { ...HAND_PROFILE_POSE_TABLES.fist.digits, thumb: { angle: 88, length: 17, curl: 0.2, base: { x: -6, y: -13 }, bend: 16, width: 7.2 } } } }
];

function paintPart(d, style) {
  return `<path d="${d}" fill="${style.fill}" stroke="${style.line}" stroke-width="${style.width}" stroke-linejoin="round" stroke-linecap="round"/>`;
}
function paintHand(hand, style, { rod = false } = {}) {
  const [palm, ...others] = hand.order;
  // A held object sits between the palm and the fingers that close on it.
  const held = rod ? `<rect x="0.5" y="-40" width="9.5" height="76" rx="4.75" fill="#d9c39a" stroke="${style.line}" stroke-width="${style.width}"/>` : '';
  return paintPart(hand.paths[palm], style) + held + others.map((part) => paintPart(hand.paths[part], style)).join('');
}
const at = { x: 0, y: 0 };
const cellHand = (cell) => handParts(cell.mirror ? 'right' : 'left', { view: cell.view, pose: cell.pose || null, at, scale: 1, flip: Boolean(cell.flip) });

const CELL = 150, ROW = 190, S = 1.55;
function gloveSheet(cells, styleId, file, cols) {
  const style = HAND_STYLES[styleId];
  const body = cells.map((cell, index) => `<g transform="translate(${(index % cols) * CELL + CELL / 2} ${Math.floor(index / cols) * ROW + 96})"><g transform="scale(${S}) rotate(${cell.rotate || 0})">${paintHand(cellHand(cell), style, { rod: cell.rod })}</g>${label(LABELS[cell.id])}</g>`).join('\n');
  svgFile(file, cols * CELL, Math.ceil(cells.length / cols) * ROW, body);
}

function rampSheet() {
  const style = HAND_STYLES.glove;
  const curl = [0, 0.25, 0.5, 0.75, 1].map((c) => ({ name: `${LABELS.curl} ${c}`, hand: handParts('left', { at, scale: 1, pose: { heel: 0, digits: { index: { curl: c }, middle: { curl: c }, ring: { curl: c } } } }) }));
  const open = handParts('left', { at, scale: 1, pose: { heel: 0 } }), side = handParts('left', { at, scale: 1, view: 'profile' });
  const blend = (t) => ({ order: open.order, paths: Object.fromEntries(HAND_PART_IDS.map((part) => [part, blendPaths(open.paths[part], side.paths[part], t)])) });
  const facing = [0, 0.33, 0.66, 1].map((t) => ({ name: `${LABELS.facing} ${t}`, hand: t === 0 ? open : t === 1 ? side : blend(t) }));
  const all = [...curl, ...facing];
  const body = all.map((entry, index) => `<g transform="translate(${index * CELL + CELL / 2} 96)"><g transform="scale(${S})">${paintHand(entry.hand, style)}</g>${label(entry.name)}</g>`).join('\n');
  svgFile('hand-glove-ramps.svg', all.length * CELL, ROW, body);
}

/* ── Checks, then the files ────────────────────────────────────────────────── */
const outlineCells = outlineSheet();
console.log(`outline: ${outlineCells.filter((c) => c.ok).length}/${outlineCells.length} views keep the single outline's layout`);
const rest = handParts('left', { at, scale: 1 });
for (const cell of GLOVE_CELLS) {
  const hand = cellHand(cell);
  const bad = HAND_PART_IDS.filter((part) => !pathsCompatible(rest.paths[part], hand.paths[part]));
  if (bad.length) throw new Error(`${cell.id}: layout changed on ${bad.join(', ')}`);
}
console.log(`glove: every part keeps its layout in ${GLOVE_CELLS.length} cells, front and profile alike`);
console.log(`glove layouts — palm ${parsePath(rest.paths.palm).signature} · digit ${parsePath(rest.paths.index).signature} · cuff ${parsePath(rest.paths.cuff).signature}`);
gloveSheet(GLOVE_CELLS, 'glove', 'hand-glove.svg', 6);
gloveSheet(GLOVE_CELLS.filter((cell) => ['open', 'fist', 'thumbsUpSide', 'pointSide', 'ok'].includes(cell.id)), 'skin', 'hand-glove-skin.svg', 5);
rampSheet();
