/**
 * The six hand drawings, as static geometry (docs/HAND_STYLES.md).
 *
 * ```text
 * relaxed    open       fist       point      thumbsUp   peace
 *   ✋         🖐         ✊         ☝          👍         ✌
 * ```
 *
 * Each style is a **whole picture** and nothing more: a palm, a cuff, and the
 * fingers that style shows, at fixed coordinates. There is no view table, no
 * pose table, no curl, no bend, no facing axis, no perspective and no
 * morphing. Nothing here takes a parameter that changes a shape, because a
 * style does not have one — a hand changes shape by becoming a different
 * style, which is a different list of the same kind of literal numbers.
 *
 * Every style shares the same palm, the same cuff, the same line weight and
 * the same pivot, so a change of style can never move the hand or resize it
 * (docs/HAND_STYLES.md, "One pivot"). The drawings are laid out fingers-up
 * around the middle of the palm; the pair hangs fingers-down because the hand
 * *group* is turned, not because the drawing is.
 *
 * ```text
 *          (0, -38)  ← fingertips
 *              │
 *         ╭────┴────╮
 *         │  palm   │   (0, 0) ← the pivot, the middle of the palm
 *         ╰────┬────╯
 *          ▭ cuff ▭       y grows down, towards the wrist
 * ```
 *
 * Pure geometry and strings; no DOM, no document, no state.
 */
import {
  DEFAULT_HAND_STYLE, HAND_STYLES, HAND_STYLE_IDS, handSideId, handStyleId, handStyleLabel, resolveHandStyle
} from '../../../runtime/hand-vocabulary.js';

const r1 = (value) => Math.round(Number(value) * 10) / 10;
// The panels share one escaper (`ui/escape-html.js`); `core` keeps its own
// copy rather than importing upwards out of the layer it is the bottom of.
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/* ── The look (docs/HAND_STYLES.md, "Palette") ─────────────────────────────── */

/**
 * The paint, which is a token rather than a drawing: the same shapes in the
 * classic white glove, or in the skin and warm line the face uses
 * (`FACE_PALETTE`). A mascot's own palette can be handed in whole, which is
 * how the template dresses its pair to match its face.
 *
 * Two colours and one width. There is no shading here, no gradient, no filter
 * and no second light: a floating cartoon hand has to read at thumbnail size,
 * and everything a hand needs to say it says with its silhouette.
 */
export const HAND_LOOKS = Object.freeze({
  glove: Object.freeze({ id: 'glove', name: 'Cartoon gloves', fill: '#ffffff', line: '#1b1b1b', width: 3.1 }),
  skin: Object.freeze({ id: 'skin', name: 'Skin', fill: '#f9d9b0', line: '#a4674a', width: 3.1 })
});
export const DEFAULT_HAND_LOOK = 'glove';

/** A named look, or one handed in whole. A colour is a colour; the drawing does not change. */
export const handLook = (look) => (look && typeof look === 'object' && look.fill
  ? { ...HAND_LOOKS[DEFAULT_HAND_LOOK], ...look }
  : HAND_LOOKS[look] || HAND_LOOKS[DEFAULT_HAND_LOOK]);

export const HAND_SKIN = HAND_LOOKS.skin.fill;
export const HAND_LINE = HAND_LOOKS.skin.line;

/* ── A very small path kit ─────────────────────────────────────────────────── */

/**
 * How far a cubic's handles reach to draw a quarter circle. Every curve in
 * every drawing is one of these, so the whole library is `M`, `C`, `L` and `Z`
 * — the same four commands the face is drawn with, and the only ones where
 * every number in the path is a coordinate.
 */
const KAPPA = 0.5522847498;
const p = (x, y) => `${r1(x)} ${r1(y)}`;
const c = (c1, c2, to) => `C ${p(c1[0], c1[1])} ${p(c2[0], c2[1])} ${p(to[0], to[1])}`;

/** A semicircular cap of radius `r` around `centre`, from `+n` round through `along` to `-n`. */
function cap([cx, cy], [nx, ny], [ax, ay], r) {
  const k = KAPPA * r;
  const start = [cx + nx * r, cy + ny * r];
  const mid = [cx + ax * r, cy + ay * r];
  const end = [cx - nx * r, cy - ny * r];
  return `${c([start[0] + ax * k, start[1] + ay * k], [mid[0] + nx * k, mid[1] + ny * k], mid)}`
    + ` ${c([mid[0] - nx * k, mid[1] - ny * k], [end[0] + ax * k, end[1] + ay * k], end)}`;
}

/**
 * A capsule from `base` to `tip`, `r` wide either side of the line between
 * them: a finger.
 *
 * `capBase` rounds the far end too. A finger that grows out of the palm leaves
 * it flat and roots it inside the outline, so nothing of the end is ever seen;
 * a finger lying **on** the palm is rounded at both ends, because both ends
 * are.
 */
function capsule([bx, by], [tx, ty], r, { capBase = false } = {}) {
  const dx = tx - bx, dy = ty - by;
  const length = Math.hypot(dx, dy) || 1;
  const along = [dx / length, dy / length];
  // The normal, so the two long edges sit `r` either side of the centre line.
  const n = [-along[1], along[0]];
  const start = [bx + n[0] * r, by + n[1] * r];
  const parts = [`M ${p(start[0], start[1])}`, `L ${p(tx + n[0] * r, ty + n[1] * r)}`, cap([tx, ty], n, along, r)];
  parts.push(`L ${p(bx - n[0] * r, by - n[1] * r)}`);
  if (capBase) parts.push(cap([bx, by], [-n[0], -n[1]], [-along[0], -along[1]], r));
  parts.push('Z');
  return parts.join(' ');
}

/** A rounded rectangle: the cuff, and nothing else. */
function roundedRect(x0, y0, x1, y1, r) {
  const k = KAPPA * r;
  return `M ${p(x0 + r, y0)} L ${p(x1 - r, y0)}`
    + ` ${c([x1 - r + k, y0], [x1, y0 + r - k], [x1, y0 + r])} L ${p(x1, y1 - r)}`
    + ` ${c([x1, y1 - r + k], [x1 - r + k, y1], [x1 - r, y1])} L ${p(x0 + r, y1)}`
    + ` ${c([x0 + r - k, y1], [x0, y1 - r + k], [x0, y1 - r])} L ${p(x0, y0 + r)}`
    + ` ${c([x0, y0 + r - k], [x0 + r - k, y0], [x0 + r, y0])} Z`;
}

/* ── The shared parts ──────────────────────────────────────────────────────── */

/**
 * The palm, drawn once for every style.
 *
 * A soft blob rather than a rounded rectangle — four cubics through top,
 * right, bottom and left — because a cartoon hand is a mitten before it is a
 * hand. It is **identical in all six drawings**, which is what makes a change
 * of style a change of fingers and never a change of size.
 */
const PALM = Object.freeze({ top: -13, bottom: 17, half: 16.5, middle: 2, bow: 0.55 });
const palmPath = () => {
  const { top, bottom, half, middle, bow } = PALM;
  const hx = half * bow, up = (middle - top) * bow, down = (bottom - middle) * bow;
  return `M ${p(0, top)} C ${p(hx, top)} ${p(half, middle - up)} ${p(half, middle)}`
    + ` C ${p(half, middle + down)} ${p(hx, bottom)} ${p(0, bottom)}`
    + ` C ${p(-hx, bottom)} ${p(-half, middle + down)} ${p(-half, middle)}`
    + ` C ${p(-half, middle - up)} ${p(-hx, top)} ${p(0, top)} Z`;
};

/** The cuff at the wrist, drawn once for every style and always behind the palm. */
const CUFF = Object.freeze({ x: 13.5, top: 13, bottom: 25.5, radius: 5 });
const cuffPath = () => roundedRect(-CUFF.x, CUFF.top, CUFF.x, CUFF.bottom, CUFF.radius);

/** How wide a finger is, and how wide the thumb is. */
const FINGER = 4.4, THUMB = 5.2;
/** Where each digit grows from: inside the palm, so its flat end never shows. */
const ROOT = Object.freeze({ index: [-10.6, -2], middle: [0, -2], ring: [10.6, -2], thumb: [-11, 6] });
/** Where a thumb folded across the palm starts and ends. It lies **on** the palm, so both ends are round. */
const THUMB_ACROSS = Object.freeze({ from: [-16, 8], to: [-1, 0.5] });

const finger = (id, tip, { r = FINGER, from = null, capBase = false } = {}) =>
  Object.freeze({ part: id, kind: 'finger', base: from || ROOT[id], tip, r, capBase });

/* ── The six drawings (docs/HAND_STYLES.md, "The library") ─────────────────── */

/**
 * Every style, as an ordered list of shapes. The order **is** the paint order:
 * a digit before the palm grows out of it, a digit after it lies on it.
 *
 * ```text
 * relaxed    short fingers, barely fanned, thumb hanging     a hand at rest
 * open       long fingers, fanned wide, thumb out            a wave, a stop, a hello
 * fist       three knuckles over the top, thumb across       a hold, a grab, a knock
 * point      one finger out, two folded, thumb across        look — there
 * thumbsUp   a fist with the thumb up its own side           yes, nice, done
 * peace      two fingers in a V, one folded, thumb across    hello, victory, a photo
 * ```
 *
 * Six numbers-only tables. Adding a seventh style is adding a table and a row
 * in the registry, and nothing else in the system grows by it.
 */
const CUFF_SHAPE = Object.freeze({ part: 'cuff', kind: 'cuff' });
const PALM_SHAPE = Object.freeze({ part: 'palm', kind: 'palm' });
const THUMB_FOLDED = Object.freeze({
  part: 'thumb', kind: 'finger', base: THUMB_ACROSS.from, tip: THUMB_ACROSS.to, r: THUMB, capBase: true
});
/** A folded finger: a short stub behind the palm, so only its knuckle shows over the top. */
const knuckle = (id, height) => finger(id, [ROOT[id][0], height]);

export const HAND_STYLE_SHAPES = Object.freeze({
  relaxed: Object.freeze([
    CUFF_SHAPE,
    finger('index', [-14, -26]), finger('middle', [-1, -29]), finger('ring', [12.5, -25]),
    finger('thumb', [-25, 3], { r: THUMB }),
    PALM_SHAPE
  ]),
  open: Object.freeze([
    CUFF_SHAPE,
    finger('index', [-17, -34]), finger('middle', [0, -38]), finger('ring', [17, -34]),
    finger('thumb', [-28, -5], { r: THUMB }),
    PALM_SHAPE
  ]),
  fist: Object.freeze([
    CUFF_SHAPE,
    knuckle('index', -19), knuckle('middle', -21), knuckle('ring', -18),
    PALM_SHAPE, THUMB_FOLDED
  ]),
  point: Object.freeze([
    CUFF_SHAPE,
    finger('index', [-15, -35]), knuckle('middle', -18), knuckle('ring', -17),
    PALM_SHAPE, THUMB_FOLDED
  ]),
  thumbsUp: Object.freeze([
    CUFF_SHAPE,
    knuckle('index', -16), knuckle('middle', -17), knuckle('ring', -15),
    finger('thumb', [-20, -26], { r: THUMB, from: [-13, 4] }),
    PALM_SHAPE
  ]),
  peace: Object.freeze([
    CUFF_SHAPE,
    finger('index', [-23, -30]), finger('middle', [4, -36]), knuckle('ring', -16),
    PALM_SHAPE, THUMB_FOLDED
  ])
});

/** What each part is called, for the one label a drawing's paths carry. */
export const HAND_PART_LABELS = Object.freeze({
  palm: 'Palm', thumb: 'Thumb', index: 'Index', middle: 'Middle', ring: 'Ring', cuff: 'Cuff'
});

/* ── Drawing one style ─────────────────────────────────────────────────────── */

/** One shape's path in the drawing's own units, before it is placed. */
function shapePath(shape) {
  if (shape.kind === 'palm') return palmPath();
  if (shape.kind === 'cuff') return cuffPath();
  return capsule(shape.base, shape.tip, shape.r, { capBase: shape.capBase });
}

/**
 * The shapes of one style, as `{ part, d }` in artboard units.
 *
 * @param {string} style which drawing
 * @param {{at?: {x,y}, scale?: number, flip?: boolean}} options where it goes and how big
 */
export function handStyleShapes(style, { at = { x: 0, y: 0 }, scale = 1, flip = false } = {}) {
  const id = handStyleId(style);
  const shapes = id ? HAND_STYLE_SHAPES[id] : null;
  if (!shapes) return null;
  const k = flip ? -1 : 1;
  return shapes.map((shape) => {
    const d = shapePath(shape);
    return { part: shape.part, d: placePath(d, at, scale, k) };
  });
}

/**
 * Place a path: scale it, mirror it when the other hand asks for it, and move
 * it to where the hand is.
 *
 * Every drawing is `M`, `C`, `L` and `Z`, so every number in it is a
 * coordinate and placing one is arithmetic on pairs — no command to interpret,
 * no arc flag to flip, and a path anything that reads SVG can read.
 *
 * The mirror is applied to the geometry rather than left as a transform, so a
 * drawing inside a mascot's SVG is plain path data that measures, exports and
 * sanitises like any other artwork. On disk the style is still **one file** for
 * both hands (docs/HAND_STYLES.md, "Mirroring") — this is where the copy for
 * one side is made.
 */
function placePath(d, at, scale, k) {
  let index = 0;
  return d.replace(/[A-Za-z]|-?\d+(?:\.\d+)?/g, (token) => {
    if (/[A-Za-z]/.test(token)) { index = 0; return token; }
    const n = Number(token);
    const even = index % 2 === 0;
    index += 1;
    return String(r1(even ? n * k * scale + at.x : n * scale + at.y));
  });
}

/** `handLeftStyle-open`: the hand's group id, then which drawing this is. */
export const handElementId = (side) => (handSideId(side) === 'right' ? 'handRight' : 'handLeft');
export const handStyleElementId = (side, style) =>
  `${handElementId(side)}Style-${handStyleId(style) || DEFAULT_HAND_STYLE}`;

/**
 * `handLeftStyle-open-palm`: one shape of one drawing.
 *
 * A name, not a handle. Nothing addresses a shape of a hand any more — there is
 * no key on it, no parameter that moves it and no control that reaches it — but
 * the document model names every node it draws, and a stable name is what makes
 * a redraw of the same drawing the same document rather than a new one.
 */
export const handStyleShapeId = (side, style, part) =>
  `${handStyleElementId(side, style)}-${part}`;

/**
 * One style, as a group of paths.
 *
 * `hidden` is every style but the one the hand starts on: six drawings stacked
 * on top of each other are one hand only because five of them are invisible,
 * and which one is not is the runtime's business from the first frame onwards.
 *
 * The paths are named but inert: nothing addresses a finger any more — there is
 * no key on it, no handle for it and no parameter that moves it. The names are
 * there because the document model names every node it draws.
 */
export function handStyleMarkup(side, style, { at = { x: 0, y: 0 }, scale = 1, look = DEFAULT_HAND_LOOK, hidden = false } = {}) {
  const resolved = resolveHandStyle(style, side);
  if (!handStyleId(style)) return '';
  const shapes = handStyleShapes(resolved.id, { at, scale, flip: resolved.flipX });
  if (!shapes) return '';
  const paint = handLook(look);
  const body = shapes.map((shape) =>
    `<path id="${handStyleShapeId(side, resolved.id, shape.part)}" data-name="${HAND_PART_LABELS[shape.part] || shape.part}" d="${shape.d}"`
    + ` fill="${paint.fill}" stroke="${paint.line}" stroke-width="${r1(paint.width * scale)}"`
    + ' stroke-linejoin="round" stroke-linecap="round" />').join('');
  return `<g id="${handStyleElementId(side, resolved.id)}" data-name="${esc(handStyleLabel(resolved.id))}"`
    + `${hidden ? ' opacity="0"' : ''}>${body}</g>`;
}

/**
 * A whole library for one hand: every style, as sibling groups in one place.
 *
 * They all sit at the same point at the same size, so the order matters only
 * for the SVG's paint order and is therefore the registry's.
 */
export function handStyleSetMarkup(side, { styles = HAND_STYLE_IDS, showing = DEFAULT_HAND_STYLE, ...options } = {}) {
  const wanted = styles.map((style) => handStyleId(style)).filter(Boolean);
  const seen = handStyleId(showing, wanted.map((id) => ({ id }))) || wanted[0] || DEFAULT_HAND_STYLE;
  return wanted.map((style) => handStyleMarkup(side, style, { ...options, hidden: style !== seen })).join('');
}

/**
 * One style as a **thumbnail**: the same drawing, with no id on it.
 *
 * A thumbnail is drawn beside the hand it is about, in the same document, so
 * it cannot carry the id the real drawing has — two nodes with one id is one
 * node as far as anything looking for it is concerned. `size` is the box it
 * has to fit in.
 */
export function handStyleThumbnail(side, style, { at = { x: 0, y: 0 }, size = 40, look = DEFAULT_HAND_LOOK } = {}) {
  const resolved = resolveHandStyle(style, side);
  if (!handStyleId(style)) return '';
  const scale = size / (2 * HAND_STYLE_RADIUS);
  const shapes = handStyleShapes(resolved.id, { at, scale, flip: resolved.flipX });
  if (!shapes) return '';
  const paint = handLook(look);
  return shapes.map((shape) =>
    `<path d="${shape.d}" fill="${paint.fill}" stroke="${paint.line}" stroke-width="${r1(paint.width * scale)}"`
    + ' stroke-linejoin="round" stroke-linecap="round" />').join('');
}

/* ── How much room a hand takes ────────────────────────────────────────────── */

/**
 * The radius every drawing fits inside, around the middle of its palm, in the
 * drawing's own units.
 *
 * Read off the shapes rather than guessed, and a radius rather than a box
 * because a pair of hands hangs tilted. One number for all six styles: that is
 * what "the same apparent scale" means, and a test holds every drawing to it.
 */
export const HAND_STYLE_RADIUS = (() => {
  let radius = 0;
  for (const shapes of Object.values(HAND_STYLE_SHAPES)) {
    for (const shape of shapes) {
      if (shape.kind === 'palm') radius = Math.max(radius, Math.hypot(PALM.half, PALM.bottom));
      else if (shape.kind === 'cuff') radius = Math.max(radius, Math.hypot(CUFF.x, CUFF.bottom));
      else radius = Math.max(radius, Math.hypot(shape.tip[0], shape.tip[1]) + shape.r);
    }
  }
  // Plus half the line, which is drawn centred on the outline.
  return Math.round((radius + HAND_LOOKS[DEFAULT_HAND_LOOK].width / 2) * 10) / 10;
})();

/**
 * The points on a drawing something can be attached to: each drawn fingertip,
 * the middle of the palm, and the wrist (docs/HAND_STYLES.md, "Anchors").
 *
 * Fixed, because the drawing is. A style that does not show a finger has no
 * tip for it, which is the honest answer: there is nothing there to hold on to.
 */
export function handStyleAnchors(style) {
  const id = handStyleId(style);
  const shapes = id ? HAND_STYLE_SHAPES[id] : null;
  if (!shapes) return null;
  const anchors = { palm: { x: 0, y: 0 }, wrist: { x: 0, y: (CUFF.top + CUFF.bottom) / 2 } };
  for (const shape of shapes) {
    if (shape.kind !== 'finger') continue;
    // The point of the tip, not the middle of the cap: a fingertip is where
    // the finger ends.
    const [bx, by] = shape.base, [tx, ty] = shape.tip;
    const length = Math.hypot(tx - bx, ty - by) || 1;
    anchors[shape.part] = { x: r1(tx + ((tx - bx) / length) * shape.r), y: r1(ty + ((ty - by) / length) * shape.r) };
  }
  return anchors;
}

/* ── Standalone files (docs/HAND_STYLES.md, "The set on disk") ─────────────── */

/**
 * The box every drawing in a set shares, and where it turns inside it.
 *
 * One box and one pivot for every style is what stops a change of style from
 * resizing or shifting the hand. `HAND_STYLE_SPRITE_SCALE` is chosen so the
 * widest drawing clears the edge: the drawings reach a little over 43 units
 * around the middle of the palm, and 2× that inside a 200-unit box leaves
 * about 13 units of margin all round.
 */
export const HAND_STYLE_VIEW_BOX = Object.freeze({ width: 200, height: 200 });
export const HAND_STYLE_PIVOT = Object.freeze([100, 100]);
export const HAND_STYLE_SPRITE_SCALE = 2;
export const HAND_STYLE_VIEW_BOX_ATTRIBUTE = `0 0 ${HAND_STYLE_VIEW_BOX.width} ${HAND_STYLE_VIEW_BOX.height}`;

/**
 * One style as a standalone SVG file, drawn for the left hand.
 *
 * This is the shape a **hand set** takes on disk — the shipped one, and any a
 * custom mascot brings with it. There is one file per style and not one per
 * side: a mirrorable style is the same drawing flipped, and the flip is the
 * reader's business (docs/HAND_STYLES.md, "Mirroring"). Nothing in the file is
 * specific to a mascot: no ids from a document, no transforms from a rig, no
 * offsets baked in to correct for one.
 */
export function handStyleDocument(style, { look = DEFAULT_HAND_LOOK, side = 'left' } = {}) {
  const at = { x: HAND_STYLE_PIVOT[0], y: HAND_STYLE_PIVOT[1] };
  const body = handStyleMarkup(side, style, { at, scale: HAND_STYLE_SPRITE_SCALE, look });
  if (!body) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${HAND_STYLE_VIEW_BOX_ATTRIBUTE}"`
    + ` width="${HAND_STYLE_VIEW_BOX.width}" height="${HAND_STYLE_VIEW_BOX.height}"`
    + ` data-hand-pivot="${HAND_STYLE_PIVOT[0]} ${HAND_STYLE_PIVOT[1]}">${body}</svg>\n`;
}

/** `defaultCartoon/open.svg` — the path a set's drawing lives at. */
export const handStylePath = (set, style) =>
  `${set}/${HAND_STYLES[handStyleId(style)]?.asset || DEFAULT_HAND_STYLE}.svg`;

/**
 * A set's manifest: what it draws, and the convention its drawings share.
 *
 * Enough on its own to rig a hand from, so a mascot that brings its own hands
 * brings one of these and nothing else.
 */
export function handStyleManifest({ set = 'defaultCartoon', name = 'Cartoon gloves', styles = HAND_STYLE_IDS, look = DEFAULT_HAND_LOOK } = {}) {
  const wanted = styles.map((style) => handStyleId(style)).filter(Boolean);
  return {
    set, name, look: handLook(look).id || look,
    viewBox: HAND_STYLE_VIEW_BOX_ATTRIBUTE,
    pivot: [...HAND_STYLE_PIVOT],
    radius: HAND_STYLE_RADIUS,
    defaultScale: 1,
    fallback: DEFAULT_HAND_STYLE,
    styles: wanted.map((id) => ({
      id,
      label: handStyleLabel(id),
      src: handStylePath(set, id),
      mirrorable: HAND_STYLES[id].mirrorable !== false
    }))
  };
}

/**
 * What a set says about itself as a hand's **library**: one record per style,
 * for the rig's `hand.styles.library`.
 */
export function handStyleLibrary(side, { styles = HAND_STYLE_IDS } = {}) {
  const hand = handSideId(side);
  const out = [];
  for (const wanted of styles) {
    const id = handStyleId(wanted);
    if (!id || out.some((item) => item.id === id)) continue;
    out.push({
      id,
      label: handStyleLabel(id),
      element: handStyleElementId(hand, id),
      mirrored: resolveHandStyle(id, hand).flipX
    });
  }
  return out;
}

export { HAND_STYLE_IDS, DEFAULT_HAND_STYLE };
