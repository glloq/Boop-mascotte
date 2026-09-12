/**
 * The eight hand drawings, as static geometry (docs/HAND_STYLES.md).
 *
 * ```text
 * relaxed  open   fist   point   thumbsUp  peace   ok    sideFist
 *   ✋      🖐     ✊      ☝        👍       ✌      👌      ✊
 * ```
 *
 * Each style is a **whole picture** and nothing more: one closed outline drawn
 * at fixed coordinates. There is no view table, no pose table, no curl, no
 * bend, no facing axis, no perspective and no morphing. Nothing here takes a
 * parameter that changes a shape, because a style does not have one — a hand
 * changes shape by becoming a different style, which is a different list of
 * the same kind of literal numbers.
 *
 * **One drawing is one layer** (docs/HAND_STYLES.md, "One outline"). A hand is
 * not a palm plus four fingers plus a cuff stacked on each other: the whole
 * silhouette is walked once — up the thumb side, over the fingers, down the
 * far side and back along the wrist — and comes out as a single `<path>`. That
 * is what the editor's layer tree shows, what the author selects, and what an
 * export carries: eight leaves per hand rather than eight groups of six.
 *
 * Every style is walked round the same pivot, sits on the same wrist and
 * reaches the same far side, so a change of style can never move the hand or
 * resize it (docs/HAND_STYLES.md, "One pivot"). The drawings are laid out
 * fingers-up around the middle of the palm; the pair hangs fingers-down
 * because the hand *group* is turned, not because the drawing is.
 *
 * ```text
 *          (0, -40)  ← fingertips
 *              │
 *         ╭────┴────╮
 *         │  palm   │   (0, 0) ← the pivot, the middle of the palm
 *         ╰────┬────╯
 *           wrist        y grows down, towards the arm
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
  glove: Object.freeze({ id: 'glove', name: 'Cartoon gloves', fill: '#ffffff', line: '#1b1b1b', width: 3.8 }),
  skin: Object.freeze({ id: 'skin', name: 'Skin', fill: '#f9d9b0', line: '#a4674a', width: 3.8 })
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
const p = ([x, y]) => `${r1(x)} ${r1(y)}`;
const c = (c1, c2, to) => `C ${p(c1)} ${p(c2)} ${p(to)}`;

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = ([x, y], k) => [x * k, y * k];
const length = ([x, y]) => Math.hypot(x, y) || 1;
const unit = (v) => mul(v, 1 / length(v));
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A semicircular cap of radius `r` around `centre`, from `+n` round through `along` to `-n`. */
function cap(centre, n, along, r) {
  const k = KAPPA * r;
  const start = add(centre, mul(n, r));
  const mid = add(centre, mul(along, r));
  const end = sub(centre, mul(n, r));
  return `${c(add(start, mul(along, k)), add(mid, mul(n, k)), mid)}`
    + ` ${c(sub(mid, mul(n, k)), add(end, mul(along, k)), end)}`;
}

/** A whole circle of radius `r` around `centre`, as four cubics: the hole in the OK sign. */
function circlePath([cx, cy], r) {
  const k = KAPPA * r;
  return `M ${p([cx, cy - r])} ${c([cx + k, cy - r], [cx + r, cy - k], [cx + r, cy])}`
    + ` ${c([cx + r, cy + k], [cx + k, cy + r], [cx, cy + r])}`
    + ` ${c([cx - k, cy + r], [cx - r, cy + k], [cx - r, cy])}`
    + ` ${c([cx - r, cy - k], [cx - k, cy - r], [cx, cy - r])} Z`;
}

/**
 * A **crease**: a line drawn inside the silhouette, without leaving the path.
 *
 * The reference hands are not bare silhouettes — a fist has the folded fingers
 * ruled down it, a closed hand has its thumb drawn on rather than bitten out of
 * the edge. A single path cannot hold a stroked line, because fill and stroke
 * belong to the whole path. It can hold a **sliver**: a closed shape half a
 * unit wide, which `fill-rule="evenodd"` turns into a hole, and which the
 * outline's own stroke — drawn centred, three units either side — paints over
 * completely. What is left on screen is a line of exactly the outline's weight,
 * inside a drawing that is still one layer.
 *
 * The points are a polyline, so a crease can follow a contour as well as run
 * straight: the thumb across a fist is one.
 */
function creasePath(points, r = 0.45) {
  const count = points.length;
  const normalAt = (index) => {
    const before = points[Math.max(0, index - 1)], after = points[Math.min(count - 1, index + 1)];
    const along = unit(sub(after, before));
    return [along[1], -along[0]];
  };
  const normals = points.map((_, index) => normalAt(index));
  const near = points.map((point, index) => add(point, mul(normals[index], r)));
  const far = points.map((point, index) => sub(point, mul(normals[index], r))).reverse();
  const out = [`M ${p(near[0])}`, ...near.slice(1).map((point) => `L ${p(point)}`)];
  out.push(cap(points[count - 1], normals[count - 1], unit(sub(points[count - 1], points[count - 2])), r));
  out.push(...far.slice(1).map((point) => `L ${p(point)}`));
  out.push(cap(points[0], mul(normals[0], -1), unit(sub(points[0], points[1])), r), 'Z');
  return out.join(' ');
}

/* ── Walking one outline ───────────────────────────────────────────────────── */

/**
 * A hand is a ring of **nodes**, walked once in drawing order: from the wrist
 * up the thumb side, left to right over the knuckles, and back down the far
 * side.
 *
 * There are only two kinds, and every drawing in the library is a list of
 * them:
 *
 * ```text
 * corner   a point on the rim of the hand, rounded by `r`
 * digit    a finger or a thumb: up one edge, round the tip, down the other
 * ```
 *
 * A digit is entered on its near edge and left on its far one, so a finger
 * does not sit *on* the hand — it **is** part of the hand's edge, which is why
 * the whole thing closes into one shape with no seam inside it. A folded
 * finger is the same node with a short tip: it comes out as a knuckle over the
 * top rather than as a separate stub behind the palm.
 */
const corner = (at, r = 0) => Object.freeze({ kind: 'corner', at: Object.freeze(at), r });
const digit = (part, base, tip, r) =>
  Object.freeze({ kind: 'digit', part, base: Object.freeze(base), tip: Object.freeze(tip), r });

/** Where a digit's edge meets the rim, and which way it points. */
function digitEnds(node) {
  const along = unit(sub(node.tip, node.base));
  // The near-side normal: the walk runs left to right over the top of the
  // hand, so a finger is entered on its left edge and left on its right one.
  const n = [along[1], -along[0]];
  return { along, n, enter: add(node.base, mul(n, node.r)), exit: sub(node.base, mul(n, node.r)) };
}

/**
 * The outline of one hand, as a single closed subpath.
 *
 * A corner is filleted rather than mitred: the edge is cut back by `r` either
 * side of the point and the two ends joined through it, which is one quadratic
 * written as a cubic. So a rim is smooth everywhere without a single arc
 * command, and every number in the result is still a coordinate.
 */
function outlinePath(nodes) {
  const count = nodes.length;
  const ends = nodes.map((node) => (node.kind === 'digit' ? digitEnds(node) : { enter: node.at, exit: node.at }));
  // Where each node starts and stops, once its corners have been cut back.
  const span = nodes.map((node, index) => {
    if (node.kind === 'digit') return { from: ends[index].enter, to: ends[index].exit };
    const before = ends[(index - 1 + count) % count].exit, after = ends[(index + 1) % count].enter;
    // Never cut back past the middle of an edge, or two neighbouring corners
    // would each round away the other's.
    const back = Math.min(node.r, length(sub(node.at, before)) / 2);
    const on = Math.min(node.r, length(sub(after, node.at)) / 2);
    return { from: add(node.at, mul(unit(sub(before, node.at)), back)), to: add(node.at, mul(unit(sub(after, node.at)), on)) };
  });
  const out = [`M ${p(span[0].from)}`];
  nodes.forEach((node, index) => {
    if (index > 0) out.push(`L ${p(span[index].from)}`);
    if (node.kind === 'digit') {
      const { along, n } = ends[index];
      out.push(`L ${p(add(node.tip, mul(n, node.r)))}`, cap(node.tip, n, along, node.r), `L ${p(span[index].to)}`);
    } else if (span[index].from !== span[index].to) {
      // The fillet: in along one edge, out along the other, through the point.
      out.push(c(mix(span[index].from, node.at, 2 / 3), mix(span[index].to, node.at, 2 / 3), span[index].to));
    }
  });
  out.push(`L ${p(span[0].from)}`, 'Z');
  return out.join(' ');
}

/* ── The shared rim ────────────────────────────────────────────────────────── */

/**
 * The palm and the wrist, which every drawing has and none of them varies.
 *
 * A cartoon hand is a **mitten before it is a hand**: a big round palm, and
 * four fingers as fat as a quarter of it. Drawn thinner than that it reads as a
 * rake — four spikes on a stub — however correct the anatomy is. So the
 * proportions here are the ones the reference sheet uses: the four fingers
 * together are exactly as wide as the palm, and each is nearly as wide as the
 * gap between two of them is deep.
 *
 * ```text
 *   knuckle ─ -4 ┄┄┄┄┄┄┄┄┄┄┄┄┄┄  where a digit grows from
 *      side ─  6 ┤            ├   the widest the palm gets: 25 either side
 *     wrist ─ 25 ╰───┤    ├───╯   and where the arm would be
 * ```
 */
const PALM = Object.freeze({ side: 24.5, wrist: 25, wristHalf: 14.5, knuckle: -4, shoulder: 24 });
/** The rim under the thumb, walked first: up from the wrist on the near side. */
const WRIST_NEAR = corner([-PALM.wristHalf, PALM.wrist], 11);
/** The rim on the far side, walked last: down past the last finger to the wrist. */
const FAR_SIDE = Object.freeze([corner([PALM.side, 7], 13), corner([PALM.wristHalf, PALM.wrist], 11)]);
/** The corner between the thumb and the first finger, and the one past the last. */
const KNUCKLE_NEAR = corner([-PALM.shoulder, PALM.knuckle], 7);
const KNUCKLE_FAR = corner([PALM.shoulder, PALM.knuckle], 7);

/** How wide each digit is. The thumb is fatter, as a thumb is. */
const FINGER = 7.8, THUMB = 9;
/**
 * Where each finger grows from: inside the palm, so its flat end never shows.
 *
 * **Three fingers and a thumb**, which is what Boop has had all along and what
 * a cartoon hand is drawn with -- the fourth finger buys nothing at this size
 * and costs the width that makes the other three read. Rooted a diameter apart,
 * so the three of them together span the palm exactly and touch down their
 * length.
 */
const ROOT = Object.freeze({ index: [-15.6, -1], middle: [0, -1], ring: [15.6, -1] });
/**
 * The web between two fingers.
 *
 * Fat fingers rooted a diameter apart touch all the way down, so the web is
 * what separates them: it sits below the knuckle line and is rounded, because a
 * sharp notch between two round fingers reads as a cut rather than as a gap.
 */
const web = (x, y) => corner([x, y], 4.5);

/**
 * The thumb of a closed hand, folded over the front of the fingers.
 *
 * Drawn as a **bulge on the near side and a line across the palm**, which is
 * what the reference does and what a thumb in front of a fist actually looks
 * like. It was a digit once: a fat lobe rooted in the middle of the palm, whose
 * far edge came back out level with the palm's centre and left a gash eighteen
 * units deep between the thumb and the fingers -- a hand with a bite taken out
 * of it. A thumb in front of something is not a thing the silhouette can say;
 * it is a line, and `creases` is how a single path draws one.
 */
const FOLDED_THUMB = Object.freeze([corner([-24, 13], 11), corner([-24.5, -1], 9)]);
const FOLDED_THUMB_CREASE = Object.freeze([[-22.5, 5], [-13, 10], [-2, 10.5], [5, 6.5]]);

const finger = (part, tip, r = FINGER) => digit(part, ROOT[part], tip, r);
/** A folded finger: a short digit, so it reads as a knuckle over the top of the fist. */
const knuckle = (part, height) => digit(part, ROOT[part], [ROOT[part][0], height], FINGER);

/**
 * The ring the OK sign makes: one circle, walked round the outside as five
 * rounded points and cut out of the middle as a hole.
 *
 * A ring is the one thing in the library a digit cannot say — a finger is an
 * edge of the hand, and a finger that comes back and touches the thumb encloses
 * something. So it is drawn as what it is: an outline that goes round it, and a
 * second subpath inside it that `fill-rule="evenodd"` turns into a hole.
 */
const RING = (() => {
  const at = [-17, -8], outer = 17, hole = 9.4;
  const point = (degrees, r = outer) => {
    const radians = (degrees * Math.PI) / 180;
    return [at[0] + Math.cos(radians) * r, at[1] + Math.sin(radians) * r];
  };
  return Object.freeze({
    at: Object.freeze(at),
    hole,
    // From the heel of the thumb, round the outside, to where the index comes
    // back down into the palm. y grows down, so the walk runs 100° → 290°.
    outside: Object.freeze([100, 160, 220, 280].map((degrees) => corner(point(degrees), 8)))
  });
})();

/* ── The eight drawings (docs/HAND_STYLES.md, "The library") ───────────────── */

/**
 * Every style, as one ring of nodes and, for the OK sign, the hole its ring
 * encloses.
 *
 * ```text
 * relaxed    four short fingers, barely fanned, thumb hanging   a hand at rest
 * open       four long fingers fanned wide, thumb out           a wave, a stop, a hello
 * fist       four knuckles over the top, thumb up the side      a hold, a grab, a knock
 * point      one finger out, three folded                       look — there
 * thumbsUp   a fist with the thumb up its own side              yes, nice, done
 * peace      two fingers in a V, two folded                     hello, victory, a photo
 * ok         thumb and index in a ring, three fingers up        good, exactly, fine
 * sideFist   a closed hand seen side on, no fingers showing     a knock, a bump, a rest
 * ```
 *
 * Eight numbers-only tables. Adding a ninth style is adding a table and a row
 * in the registry, and nothing else in the system grows by it.
 */
export const HAND_STYLE_SHAPES = Object.freeze({
  relaxed: Object.freeze({
    nodes: Object.freeze([
      WRIST_NEAR,
      digit('thumb', [-16, 10], [-31, 7], THUMB),
      KNUCKLE_NEAR,
      finger('index', [-19, -20]), web(-7.8, -3), finger('middle', [-1, -24]), web(7.8, -3),
      finger('ring', [16, -21]),
      KNUCKLE_FAR, ...FAR_SIDE
    ])
  }),
  open: Object.freeze({
    nodes: Object.freeze([
      WRIST_NEAR,
      digit('thumb', [-15, 8], [-33, -1], THUMB),
      KNUCKLE_NEAR,
      finger('index', [-22, -24]), web(-7.8, -4), finger('middle', [-1, -30]), web(7.8, -4),
      finger('ring', [20, -23]),
      KNUCKLE_FAR, ...FAR_SIDE
    ])
  }),
  fist: Object.freeze({
    nodes: Object.freeze([
      WRIST_NEAR,
      ...FOLDED_THUMB,
      knuckle('index', -13), web(-7.8, -3), knuckle('middle', -15.5), web(7.8, -3),
      knuckle('ring', -13),
      KNUCKLE_FAR, ...FAR_SIDE
    ]),
    // The folded fingers, ruled down the front of the fist. The thumb is not
    // drawn here: it is the lobe on the near side, part of the outline
    // already, and a second one ruled across the palm reads as a twig.
    creases: Object.freeze([
      Object.freeze([[-8, -6], [-8.6, 5]]),
      Object.freeze([[8, -6], [8.6, 5]]),
      FOLDED_THUMB_CREASE
    ])
  }),
  point: Object.freeze({
    nodes: Object.freeze([
      WRIST_NEAR,
      ...FOLDED_THUMB,
      finger('index', [-17, -30]), web(-7.8, -2),
      knuckle('middle', -12), web(7.8, -2.5), knuckle('ring', -10),
      KNUCKLE_FAR, ...FAR_SIDE
    ]),
    creases: Object.freeze([Object.freeze([[8, -5], [8.6, 4.5]]), FOLDED_THUMB_CREASE])
  }),
  thumbsUp: Object.freeze({
    nodes: Object.freeze([
      WRIST_NEAR,
      corner([-24, 12], 12),
      // A closed hand seen from its thumb side: the fingers are folded away
      // behind it, and the thumb is the only digit there is to draw. It has to
      // stand well clear of the fist, or the two read as one mitten.
      digit('thumb', [-15, 3], [-21, -25], THUMB + 0.4),
      web(-5, -2),
      corner([-3, -14], 10), corner([8, -19], 12), corner([18, -16], 11), corner([24, -6], 10),
      ...FAR_SIDE
    ]),
    // The one line the reference draws on a thumbs-up: the folded index, over
    // the front of the fist.
    creases: Object.freeze([Object.freeze([[-3.5, -11], [8, -8], [16, -1]])])
  }),
  peace: Object.freeze({
    nodes: Object.freeze([
      WRIST_NEAR,
      ...FOLDED_THUMB,
      finger('index', [-22, -26]), web(-7, -3), finger('middle', [2, -30]), web(9, -1),
      knuckle('ring', -11),
      KNUCKLE_FAR, ...FAR_SIDE
    ]),
    creases: Object.freeze([Object.freeze([[9.5, -3], [10.2, 4.5]]), FOLDED_THUMB_CREASE])
  }),
  ok: Object.freeze({
    nodes: Object.freeze([
      WRIST_NEAR,
      // The thumb and the index meet in a ring: its outside is four points
      // round a circle, and the hole below is the same circle, smaller.
      ...RING.outside,
      web(-6, -2),
      finger('middle', [-1, -29]), web(9, -4), finger('ring', [20, -23]),
      KNUCKLE_FAR, ...FAR_SIDE
    ]),
    holes: Object.freeze([Object.freeze({ at: RING.at, r: RING.hole })])
  }),
  sideFist: Object.freeze({
    nodes: Object.freeze([
      WRIST_NEAR,
      corner([-24, 10], 12),
      // Seen side on there are no fingers to draw: they are folded away behind
      // the hand, so the knuckles are the rim and the thumb -- lying along the
      // near side -- is the only digit there is.
      digit('thumb', [-14, 2], [-24, -11], THUMB + 2),
      corner([-7, -13], 8),
      corner([3, -21], 13), corner([15, -19], 12), corner([24, -7], 10),
      ...FAR_SIDE
    ]),
    // Side on, the folded fingers are a line across the front of the hand.
    creases: Object.freeze([Object.freeze([[-6.5, -12.5], [7, -11], [17, -5]])])
  })
});

/** What each part is called, for the one label a drawing's paths carry. */
export const HAND_PART_LABELS = Object.freeze({
  hand: 'Hand', palm: 'Palm', wrist: 'Wrist', thumb: 'Thumb', index: 'Index', middle: 'Middle', ring: 'Ring'
});

/* ── Drawing one style ─────────────────────────────────────────────────────── */

/** The one path of one style, in the drawing's own units, before it is placed. */
function stylePath(style) {
  const drawing = HAND_STYLE_SHAPES[style];
  const holes = (drawing.holes || []).map((hole) => circlePath(hole.at, hole.r));
  const creases = (drawing.creases || []).map((line) => creasePath(line));
  return [outlinePath(drawing.nodes), ...holes, ...creases].join(' ');
}

/**
 * The shapes of one style, as `{ part, d }` in artboard units.
 *
 * There is exactly one, and it is the whole hand: a drawing is a single
 * outline, so `handStyleShapes` answers with a list of one rather than with a
 * palm, four fingers and a cuff to stack.
 *
 * @param {string} style which drawing
 * @param {{at?: {x,y}, scale?: number, flip?: boolean}} options where it goes and how big
 */
export function handStyleShapes(style, { at = { x: 0, y: 0 }, scale = 1, flip = false } = {}) {
  const id = handStyleId(style);
  if (!id || !HAND_STYLE_SHAPES[id]) return null;
  return [{ part: 'hand', d: placePath(stylePath(id), at, scale, flip ? -1 : 1) }];
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
 * One style, as one path.
 *
 * `hidden` is every style but the one the hand starts on: eight drawings
 * stacked on top of each other are one hand only because seven of them are
 * invisible, and which one is not is the runtime's business from the first
 * frame onwards.
 *
 * The path is the layer: there is no group around it and nothing inside it,
 * because a drawing has no parts any more — no key on a finger, no handle for
 * one and no parameter that moves it. `fill-rule="evenodd"` is what makes the
 * OK sign's ring a hole rather than a disc; the other seven have no hole and
 * are unaffected by it.
 */
export function handStyleMarkup(side, style, { at = { x: 0, y: 0 }, scale = 1, look = DEFAULT_HAND_LOOK, hidden = false } = {}) {
  const resolved = resolveHandStyle(style, side);
  if (!handStyleId(style)) return '';
  const shapes = handStyleShapes(resolved.id, { at, scale, flip: resolved.flipX });
  if (!shapes) return '';
  const paint = handLook(look);
  return `<path id="${handStyleElementId(side, resolved.id)}" data-name="${esc(handStyleLabel(resolved.id))}"`
    + ` d="${shapes[0].d}" fill="${paint.fill}" fill-rule="evenodd" stroke="${paint.line}"`
    + ` stroke-width="${r1(paint.width * scale)}" stroke-linejoin="round" stroke-linecap="round"`
    + `${hidden ? ' opacity="0"' : ''} />`;
}

/**
 * A whole library for one hand: every style, as sibling paths in one place.
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
  return `<path d="${shapes[0].d}" fill="${paint.fill}" fill-rule="evenodd" stroke="${paint.line}"`
    + ` stroke-width="${r1(paint.width * scale)}" stroke-linejoin="round" stroke-linecap="round" />`;
}

/* ── How much room a hand takes ────────────────────────────────────────────── */

/** Every coordinate pair in a path, so a drawing can be measured rather than guessed. */
const pathPoints = (d) => {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  return Array.from({ length: Math.floor(numbers.length / 2) }, (_, index) => [numbers[index * 2], numbers[index * 2 + 1]]);
};

/**
 * The radius every drawing fits inside, around the middle of its palm, in the
 * drawing's own units.
 *
 * Read off the outlines rather than guessed, and a radius rather than a box
 * because a pair of hands hangs tilted. One number for all eight styles: that
 * is what "the same apparent scale" means, and a test holds every drawing to
 * it.
 */
export const HAND_STYLE_RADIUS = (() => {
  let radius = 0;
  for (const id of Object.keys(HAND_STYLE_SHAPES)) {
    for (const point of pathPoints(stylePath(id))) radius = Math.max(radius, Math.hypot(point[0], point[1]));
  }
  // Plus half the line, which is drawn centred on the outline.
  return Math.round((radius + HAND_LOOKS[DEFAULT_HAND_LOOK].width / 2) * 10) / 10;
})();

/**
 * The points on a drawing something can be attached to: each drawn fingertip,
 * the middle of the palm, and the wrist (docs/HAND_STYLES.md, "Anchors").
 *
 * Fixed, because the drawing is. A style that does not show a finger has no
 * tip for it, which is the honest answer: there is nothing there to hold on
 * to. A folded finger is a knuckle rather than a tip, so it answers where the
 * knuckle is — which is where a held object would rest.
 */
export function handStyleAnchors(style) {
  const id = handStyleId(style);
  const drawing = id ? HAND_STYLE_SHAPES[id] : null;
  if (!drawing) return null;
  const anchors = { palm: { x: 0, y: 0 }, wrist: { x: 0, y: PALM.wrist - 3 } };
  for (const node of drawing.nodes) {
    if (node.kind !== 'digit') continue;
    // The point of the tip, not the middle of the cap: a fingertip is where
    // the finger ends.
    const tip = add(node.tip, mul(unit(sub(node.tip, node.base)), node.r));
    anchors[node.part] = { x: r1(tip[0]), y: r1(tip[1]) };
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
