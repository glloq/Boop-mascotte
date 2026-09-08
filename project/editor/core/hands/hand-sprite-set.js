/**
 * The drawings a 2D hand swaps between (docs/HANDS_2D.md, PHASES 6, 25, 27).
 *
 * ```text
 * handLeft (g)                       the hand: reach, drift, turn, size
 *  ├─ handLeftDraw-relaxed-sideLeft          (g)  ─┐ one drawing each,
 *  ├─ handLeftDraw-relaxed-threeQuarterLeft  (g)   │ one of them visible,
 *  ├─ handLeftDraw-relaxed-front             (g)   │ all of them still
 *  ├─ handLeftDraw-relaxed-threeQuarterRight (g)   │
 *  └─ handLeftDraw-relaxed-sideRight         (g)  ─┘
 * ```
 *
 * A drawing is a **child of the hand group**, so the hand's own transform
 * carries it and a swap is one opacity: nothing here has to know where the
 * hand is, what it is anchored to, or how far it has turned. That is the seam
 * PHASE 2 asks for, taken as far as it goes.
 *
 * The drawings themselves come from the glove generator
 * (`hand-artwork.js`) — the same six parts, the same line, the same palm the
 * mascot always had — but each is drawn **once, statically**, at the pose and
 * view it is for. Nothing deforms them afterwards. So the look is the one the
 * project already shipped and the wobble it used to have on the way between
 * two views is gone, because there is no longer a way between two views.
 *
 * Pure geometry and strings; no DOM, no document.
 */
import { DEFAULT_HAND_POSE, HAND_POSES, HAND_VIEWS, handPoseId, handSideId, handViewId } from '../../../runtime/hand-vocabulary.js';
import {
  HAND_DEFAULT_STYLE, HAND_GRIP_TABLE, HAND_LOCAL_RADIUS, HAND_PART_NAMES, HAND_POSE_TABLES, HAND_PROFILE_POSE_TABLES,
  handElementId, handPartCaps, handParts, handSpriteTable, handStyle
} from '../sample/hand-artwork.js';

const r1 = (value) => Math.round(Number(value) * 10) / 10;
const capital = (word) => `${String(word).charAt(0).toUpperCase()}${String(word).slice(1)}`;
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/* ── Which table draws which pose ──────────────────────────────────────────── */

/**
 * The generator table behind each pose of the 2D vocabulary.
 *
 * `profile` is the drawing a pose wants when the hand is seen edge-on, where
 * one exists: a fist seen from the side is a bunch of hooks, not the front
 * fist's fingers squashed. Where none exists the front table is merged onto
 * the side view instead, and the view's own `hook` turns each curl into a bend
 * — which is what a folded finger does when you look at it edge-on.
 *
 * `relaxed` is the resting hand, `open` the spread one, `grab` the whole hand
 * closing at once. There is no `wave`: a wave is `open` and a rotation clip
 * (docs/HANDS_2D.md, "Pose").
 */
export const HAND_SPRITE_POSES = Object.freeze({
  relaxed: Object.freeze({ table: HAND_POSE_TABLES.relax, profile: null }),
  open: Object.freeze({ table: HAND_POSE_TABLES.spread, profile: null }),
  fist: Object.freeze({ table: HAND_POSE_TABLES.fist, profile: HAND_PROFILE_POSE_TABLES.fist }),
  point: Object.freeze({ table: HAND_POSE_TABLES.point, profile: HAND_PROFILE_POSE_TABLES.point }),
  grab: Object.freeze({ table: HAND_GRIP_TABLE, profile: HAND_GRIP_TABLE }),
  thumbsUp: Object.freeze({ table: HAND_POSE_TABLES.thumbsUp, profile: HAND_PROFILE_POSE_TABLES.thumbsUp }),
  peace: Object.freeze({ table: HAND_POSE_TABLES.peace, profile: null })
});

/** Every pose the generator can draw, in the catalogue's order. */
export const GENERATED_SPRITE_POSES = Object.freeze(HAND_POSES.filter((pose) => HAND_SPRITE_POSES[pose.id]).map((pose) => pose.id));

/**
 * The pose the first set is drawn in (PHASE 25).
 *
 * One pose in five views proves the architecture — the swap, the pivot, the
 * sizes, the automatic view — and five drawings is a set an author can look at
 * in one glance. The rest arrive pose by pose afterwards, which the resolver's
 * ladder is built to allow (PHASE 27).
 */
export const STARTER_SPRITE_POSES = Object.freeze([DEFAULT_HAND_POSE]);

/** The five views, as ids. */
export const HAND_SPRITE_VIEWS = Object.freeze(HAND_VIEWS.map((view) => view.id));

/**
 * Which side of the hand each generator table shows.
 *
 * A pose is authored for the palm view — `THUMB_ACROSS` sits at x −16 because
 * that is where the edge of a *front* palm is. Those numbers are wrong on any
 * other drawing, and wrong in a way that shows: a thumb placed off the side of
 * a narrow palm reads as a lobe crossing the fingers.
 */
const PALM_SIDE_TABLES = Object.freeze(['front', 'threeQuarter']);

/** The fields of a pose override that are a change of *shape* rather than of *place*. */
const SHAPE_FIELDS = Object.freeze(['curl', 'bend']);

/**
 * A pose override reduced to what survives a change of view.
 *
 * A curl and a bend are things a finger *does*, and they mean the same on
 * every drawing — the view's own `hook` even turns one into the other where
 * the hand is edge-on. A base, an angle, a length and a width are things a
 * finger *is*, measured on the drawing they were authored for, so they stay
 * behind and the view places its own digits.
 */
function shapeOnly(table) {
  if (!table?.digits) return table ? { ...table, digits: {} } : null;
  const digits = {};
  for (const [id, digit] of Object.entries(table.digits)) {
    const kept = {};
    for (const field of SHAPE_FIELDS) if (digit?.[field] !== undefined) kept[field] = digit[field];
    if (Object.keys(kept).length) digits[id] = kept;
  }
  return { ...table, digits, ...(table.order ? { order: table.order } : {}) };
}

/**
 * The pose table to merge onto a view.
 *
 * ```text
 * palm-side view   (front, 3/4 towards the palm)   the pose's own table, whole
 * any other view   and the pose has a profile      the profile table
 * any other view   and it has not                  the pose, as shape only
 * ```
 *
 * The middle rung is what makes a fist seen from the side a bunch of hooks
 * rather than the front fist's fingers squashed; the last is what keeps an
 * open hand in profile an open hand rather than a thumb across the drawing.
 * Together they are why a pose does not have to be drawn five times to be
 * usable in five views (PHASE 28).
 */
export function handSpritePoseTable(pose, view, side = 'left') {
  const id = handPoseId(pose) || DEFAULT_HAND_POSE;
  const entry = HAND_SPRITE_POSES[id];
  if (!entry) return null;
  if (PALM_SIDE_TABLES.includes(handSpriteTable(side, handViewId(view) || 'front'))) return entry.table;
  return entry.profile || shapeOnly(entry.table);
}

/* ── Ids ───────────────────────────────────────────────────────────────────── */

/** `handLeftDraw-relaxed-front`: the hand's id, then what the drawing is. */
export const handSpriteElementId = (side, pose, view) =>
  `${handElementId(side)}Draw-${handPoseId(pose) || DEFAULT_HAND_POSE}-${handViewId(view) || 'front'}`;

/** `handLeftDraw-relaxed-frontPalm`: one part of one drawing. */
export const handSpritePartId = (side, pose, view, part) => `${handSpriteElementId(side, pose, view)}${capital(part)}`;

/* ── Drawing ───────────────────────────────────────────────────────────────── */

/**
 * The parts of one drawing, in paint order.
 *
 * `view` is the **screen** view; `handSpriteTable` turns it into the
 * generator's own table for this side, which is where the right hand's
 * mirroring is accounted for.
 */
export function handSpriteParts(side, pose, view, { at = { x: 0, y: 0 }, scale = 1, box = {} } = {}) {
  const hand = handSideId(side);
  const screen = handViewId(view) || 'front';
  return handParts(hand, { view: handSpriteTable(hand, screen), pose: handSpritePoseTable(pose, screen, hand), at, scale, box });
}

const paintParts = (side, pose, view, parts, look, size) => parts.order.map((part) =>
  `<path id="${handSpritePartId(side, pose, view, part)}" data-name="${HAND_PART_NAMES[part]}" d="${parts.paths[part]}"`
  + ` fill="${look.fill}" stroke="${look.line}" stroke-width="${r1(look.width * size)}"`
  + ` stroke-linejoin="round" stroke-linecap="${handPartCaps(part)}" />`).join('');

/**
 * One drawing, as a group.
 *
 * `hidden` is every drawing but the one the hand starts on: a set of five
 * drawn on top of each other is one hand only because four of them are
 * transparent, and which one is not is the runtime's business from the first
 * frame onwards.
 */
export function handSpriteMarkup(side, pose, view, { at = { x: 0, y: 0 }, scale = 1, box = {}, style = HAND_DEFAULT_STYLE, hidden = false } = {}) {
  const look = handStyle(style);
  const parts = handSpriteParts(side, pose, view, { at, scale, box });
  const id = handSpriteElementId(side, pose, view);
  const poseName = (HAND_POSES.find((item) => item.id === (handPoseId(pose) || DEFAULT_HAND_POSE)) || {}).name || pose;
  const viewName = (HAND_VIEWS.find((item) => item.id === (handViewId(view) || 'front')) || {}).name || view;
  return `<g id="${id}" data-name="${esc(`${poseName} · ${viewName}`)}"${hidden ? ' opacity="0"' : ''}>${paintParts(side, pose, view, parts, look, scale)}</g>`;
}

/**
 * A whole set for one hand: every pose in every view, as sibling groups.
 *
 * The order matters only for the SVG's paint order, and every drawing sits in
 * the same place, so it is the catalogue's: poses in the order they are
 * listed, views left to right.
 */
export function handSpriteSetMarkup(side, { poses = STARTER_SPRITE_POSES, views = HAND_SPRITE_VIEWS, showing = null, ...options } = {}) {
  const wanted = poses.map((pose) => handPoseId(pose)).filter(Boolean);
  const seen = handViewId(showing) || 'front';
  const first = wanted[0] || DEFAULT_HAND_POSE;
  return wanted.flatMap((pose) => views
    .map((view) => handViewId(view))
    .filter(Boolean)
    .map((view) => handSpriteMarkup(side, pose, view, { ...options, hidden: !(pose === first && view === seen) })))
    .join('');
}

/**
 * One drawing as a **thumbnail**: the same picture, with no ids on it.
 *
 * A thumbnail is drawn beside the hand it is about, in the same document, so
 * it cannot carry the ids the real drawing has -- two nodes with one id is one
 * node as far as anything looking for it is concerned. It carries no names
 * either: a picker cell says what it is in its own label, and the parts of a
 * picture nobody can click are not layers.
 *
 * `size` is the box it has to fit in; the drawing is centred on it and scaled
 * to fill it, so a caller lays out cells and this fills one.
 */
export function handSpriteThumbnail(side, pose, view, { at = { x: 0, y: 0 }, size = 40, style = HAND_DEFAULT_STYLE } = {}) {
  const look = handStyle(style);
  const scale = size / (2 * HAND_LOCAL_RADIUS);
  const parts = handSpriteParts(side, pose, view, { at, scale });
  return parts.order.map((part) =>
    `<path d="${parts.paths[part]}" fill="${look.fill}" stroke="${look.line}" stroke-width="${r1(look.width * scale)}"`
    + ` stroke-linejoin="round" stroke-linecap="${handPartCaps(part)}" />`).join('');
}

/* ── Descriptors (PHASE 24) ────────────────────────────────────────────────── */

/**
 * What a set says about itself: one descriptor per drawing, for
 * `createHandAssetLibrary`.
 *
 * Every drawing shares the hand's pivot and its size, because they are all the
 * same generator at the same scale around the same point (PHASES 21–23). A
 * drawing whose pose is asymmetric refuses to be flipped, so the resolver
 * cannot reach for it as a mirror.
 */
export function handSpriteAssets(side, { poses = STARTER_SPRITE_POSES, views = HAND_SPRITE_VIEWS, pivot = null, defaultScale = 1 } = {}) {
  const hand = handSideId(side);
  const out = [];
  for (const posed of poses) {
    const pose = handPoseId(posed);
    if (!pose) continue;
    const mirrorable = (HAND_POSES.find((item) => item.id === pose) || {}).mirrorable === true;
    for (const viewed of views) {
      const view = handViewId(viewed);
      if (!view) continue;
      out.push({
        id: handSpriteElementId(hand, pose, view),
        side: hand, pose, view, face: 'palm',
        element: handSpriteElementId(hand, pose, view),
        pivot: pivot ? [...pivot] : null,
        mirrorable, defaultScale
      });
    }
  }
  return out;
}

/* ── Standalone files (PHASES 6, 22–23, 38) ────────────────────────────────── */

/**
 * The box every drawing in a set shares, and where it turns inside it.
 *
 * One box and one pivot for every pose and every view is what stops a swap
 * from resizing or shifting the hand (PHASE 22). `SPRITE_SCALE` is chosen so
 * the widest drawing clears the edge by its own line: the glove's radius
 * around the middle of its palm is a little over 42 units, and 2× that inside
 * a 200-unit box leaves 15 units of margin all round.
 */
export const SPRITE_VIEW_BOX = Object.freeze({ width: 200, height: 200 });
export const SPRITE_PIVOT = Object.freeze([100, 100]);
export const SPRITE_SCALE = 2;
export const SPRITE_VIEW_BOX_ATTRIBUTE = `0 0 ${SPRITE_VIEW_BOX.width} ${SPRITE_VIEW_BOX.height}`;

/** How much room a drawing takes in the shared box, as a radius around the pivot. */
export const SPRITE_RADIUS = HAND_LOCAL_RADIUS * SPRITE_SCALE;

/**
 * One drawing as a standalone SVG file: the shared box, the shared pivot, and
 * the drawing centred on it.
 *
 * This is the shape a **hand set** takes on disk — the shipped one, and any a
 * custom mascot brings with it (PHASE 38). Nothing in it is specific to a
 * mascot: no ids from a document, no transforms from a rig, no offsets baked
 * in to correct for one. A set is a directory of these plus a manifest.
 */
export function handSpriteDocument(side, pose, view, { style = HAND_DEFAULT_STYLE } = {}) {
  const at = { x: SPRITE_PIVOT[0], y: SPRITE_PIVOT[1] };
  const drawing = handSpriteMarkup(side, pose, view, { at, scale: SPRITE_SCALE, style });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SPRITE_VIEW_BOX_ATTRIBUTE}"`
    + ` width="${SPRITE_VIEW_BOX.width}" height="${SPRITE_VIEW_BOX.height}"`
    + ` data-hand-pivot="${SPRITE_PIVOT[0]} ${SPRITE_PIVOT[1]}">${drawing}</svg>\n`;
}

/** `defaultCartoon/left/relaxed/front.svg` — the path a set's drawing lives at. */
export const handSpritePath = (set, side, pose, view) =>
  `${set}/${handSideId(side)}/${handPoseId(pose) || DEFAULT_HAND_POSE}/${handViewId(view) || 'front'}.svg`;

/**
 * A set's manifest: what it draws, and the convention its drawings share.
 *
 * Enough on its own to build a library from — `createHandAssetLibrary(manifest.assets, manifest)` —
 * so a mascot that brings its own hands brings one of these and nothing else.
 */
export function handSpriteManifest({ set = 'defaultCartoon', name = 'Cartoon gloves', poses = STARTER_SPRITE_POSES, views = HAND_SPRITE_VIEWS, sides = ['left', 'right'], style = HAND_DEFAULT_STYLE } = {}) {
  const assets = [];
  for (const side of sides) {
    for (const asset of handSpriteAssets(side, { poses, views, pivot: [...SPRITE_PIVOT] })) {
      assets.push({ ...asset, element: null, src: handSpritePath(set, side, asset.pose, asset.view) });
    }
  }
  return {
    set, name, style,
    viewBox: SPRITE_VIEW_BOX_ATTRIBUTE,
    pivot: [...SPRITE_PIVOT],
    defaultScale: 1,
    poses: [...poses], views: [...views], sides: [...sides],
    assets
  };
}
