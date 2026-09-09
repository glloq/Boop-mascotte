/**
 * The drawings a 2D hand swaps between (docs/HANDS_2D.md).
 *
 * ```text
 * handLeft (g)                    the hand: reach, drift, turn, size
 *  ├─ handLeftDraw-sideOpen   (g) ─┐ one picture each,
 *  ├─ handLeftDraw-palmOpen   (g)  │ one of them visible,
 *  └─ handLeftDraw-frontFist  (g) ─┘ all of them still
 * ```
 *
 * A drawing is a **child of the hand group**, so the hand's own transform
 * carries it and a swap is one opacity: nothing here has to know where the
 * hand is, what it is anchored to, or how far it has turned.
 *
 * Three pictures per hand, named for what they show — not a grid of poses
 * times views. Each comes from the glove generator (`hand-artwork.js`): the
 * same six parts, the same line, the same palm the mascot always had, drawn
 * **once, statically**, at the shape it is for.
 *
 * Each picture also carries **one animation of its own**: a second drawing of
 * the same picture doing something, kept as shape keys over that picture's own
 * parts and driven by the hand's animation parameter. An open side hand closes
 * into a fist; a palm closes; a fist raises its thumb. Nothing here morphs one
 * *picture* into another — that is the pseudo-3D turn this system replaced.
 *
 * Pure geometry and strings; no DOM, no document.
 */
import { DEFAULT_HAND_DRAWING, HAND_DRAWINGS, handDrawingId, handSideId } from '../../../runtime/hand-vocabulary.js';
import { createShapeKey } from '../shape-keys/shape-key-model.js';
import {
  HAND_DEFAULT_STYLE, HAND_GRIP_TABLE, HAND_LOCAL_RADIUS, HAND_PART_IDS, HAND_PART_NAMES, HAND_POSE_TABLES,
  handElementId, handPartCaps, handParts, handStyle
} from '../sample/hand-artwork.js';

const r1 = (value) => Math.round(Number(value) * 10) / 10;
const capital = (word) => `${String(word).charAt(0).toUpperCase()}${String(word).slice(1)}`;
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/* ── What each picture is, and what it does ────────────────────────────────── */

/**
 * The generator behind each drawing of the catalogue, and behind its animation.
 *
 * ```text
 * id          rest                          animates to
 * sideOpen    an open hand, edge-on         a fist, edge-on
 * palmOpen    an open hand, palm to us      a closed hand
 * frontFist   a fist, facing us             the same fist, thumb up
 * ```
 *
 * `view` is the generator's own table, drawn for a left hand; `handParts`
 * mirrors it for the right one, so a side view is each hand seen from its own
 * side and the pair reads as a pair. There is no screen angle to reconcile:
 * a drawing is a picture, not a position on a turn.
 */
/**
 * The side hand closing.
 *
 * Not all the way to a knuckle fist: seen edge-on the generator draws the
 * fingers behind the palm, and past about two thirds of a fold they come
 * through it. This is as far as a hand seen from the side closes and still
 * reads as a hand.
 */
const SIDE_CLOSE = Object.freeze({ digits: Object.freeze({
  index: { curl: 0.62 }, middle: { curl: 0.62 }, ring: { curl: 0.62 }, thumb: { curl: 0.45 }
}) });

/** A fist with its thumb straight up: the fold of the fist, and the thumb clear of it. */
const THUMB_UP = Object.freeze({
  heel: 0, palm: { top: -10 },
  digits: Object.freeze({
    index: { curl: 1 }, middle: { curl: 1 }, ring: { curl: 1 },
    thumb: { angle: -8, length: 22, width: 8.6, bend: 0, base: { x: -13, y: -2 } }
  })
});

export const HAND_DRAWING_RECIPES = Object.freeze({
  sideOpen: Object.freeze({ view: 'far', pose: null, animTable: SIDE_CLOSE }),
  palmOpen: Object.freeze({ view: 'front', pose: HAND_POSE_TABLES.stop, animTable: HAND_GRIP_TABLE }),
  frontFist: Object.freeze({ view: 'front', pose: HAND_GRIP_TABLE, animTable: THUMB_UP })
});

/** Every drawing the generator can make, in the catalogue's order. */
export const GENERATED_HAND_DRAWINGS = Object.freeze(HAND_DRAWINGS.filter((drawing) => HAND_DRAWING_RECIPES[drawing.id]).map((drawing) => drawing.id));

/**
 * What a hand is drawn with when nobody has said otherwise: all three.
 *
 * Three pictures is a set an author takes in at a glance, and the editor draws
 * them side by side beside the face. A set that wants a fourth adds one
 * drawing and nothing else in the system grows by it.
 */
export const STARTER_HAND_DRAWINGS = Object.freeze([...GENERATED_HAND_DRAWINGS]);

/** The catalogue record for a drawing, with its recipe; `null` for a name it does not draw. */
export function handDrawingRecipe(id) {
  const key = handDrawingId(id);
  const recipe = key ? HAND_DRAWING_RECIPES[key] : null;
  return recipe ? { id: key, ...HAND_DRAWINGS.find((drawing) => drawing.id === key), ...recipe } : null;
}

/* ── Ids ───────────────────────────────────────────────────────────────────── */

/** `handLeftDraw-palmOpen`: the hand's id, then which picture this is. */
export const handSpriteElementId = (side, drawing) => `${handElementId(side)}Draw-${handDrawingId(drawing) || DEFAULT_HAND_DRAWING}`;

/** `handLeftDraw-palmOpenPalm`: one part of one picture. */
export const handSpritePartId = (side, drawing, part) => `${handSpriteElementId(side, drawing)}${capital(part)}`;

/* ── Drawing ───────────────────────────────────────────────────────────────── */

/** The parts of one picture, in paint order. `posed` draws its animation instead. */
export function handSpriteParts(side, drawing, { at = { x: 0, y: 0 }, scale = 1, box = {}, posed = false } = {}) {
  const recipe = handDrawingRecipe(drawing);
  if (!recipe) return null;
  return handParts(handSideId(side), { view: recipe.view, pose: posed ? recipe.animTable : recipe.pose, at, scale, box });
}

const paintParts = (side, drawing, parts, look, size) => parts.order.map((part) =>
  `<path id="${handSpritePartId(side, drawing, part)}" data-name="${HAND_PART_NAMES[part]}" d="${parts.paths[part]}"`
  + ` fill="${look.fill}" stroke="${look.line}" stroke-width="${r1(look.width * size)}"`
  + ` stroke-linejoin="round" stroke-linecap="${handPartCaps(part)}" />`).join('');

/**
 * One picture, as a group.
 *
 * `hidden` is every picture but the one the hand starts on: a set of three
 * drawn on top of each other is one hand only because two of them are
 * transparent, and which one is not is the runtime's business from the first
 * frame onwards.
 */
export function handSpriteMarkup(side, drawing, { at = { x: 0, y: 0 }, scale = 1, box = {}, style = HAND_DEFAULT_STYLE, hidden = false, posed = false } = {}) {
  const recipe = handDrawingRecipe(drawing);
  if (!recipe) return '';
  const look = handStyle(style);
  const parts = handSpriteParts(side, recipe.id, { at, scale, box, posed });
  return `<g id="${handSpriteElementId(side, recipe.id)}${posed ? '-anim' : ''}" data-name="${esc(recipe.name)}${posed ? ` · ${esc(recipe.anim)}` : ''}"${hidden ? ' opacity="0"' : ''}>`
    + `${paintParts(side, recipe.id, parts, look, scale)}</g>`;
}

/**
 * A whole set for one hand: every picture, as sibling groups.
 *
 * The order matters only for the SVG's paint order, and every picture sits in
 * the same place, so it is the catalogue's.
 */
export function handSpriteSetMarkup(side, { drawings = STARTER_HAND_DRAWINGS, showing = DEFAULT_HAND_DRAWING, ...options } = {}) {
  const wanted = drawings.map((drawing) => handDrawingId(drawing)).filter((id) => HAND_DRAWING_RECIPES[id]);
  const seen = handDrawingId(showing, wanted.map((id) => ({ id }))) || wanted[0] || DEFAULT_HAND_DRAWING;
  return wanted.map((drawing) => handSpriteMarkup(side, drawing, { ...options, hidden: drawing !== seen })).join('');
}

/**
 * One picture as a **thumbnail**: the same drawing, with no ids on it.
 *
 * A thumbnail is drawn beside the hand it is about, in the same document, so
 * it cannot carry the ids the real picture has -- two nodes with one id is one
 * node as far as anything looking for it is concerned. It carries no names
 * either: a picker cell says what it is in its own label, and the parts of a
 * picture nobody can click are not layers.
 *
 * `size` is the box it has to fit in; the drawing is centred on it and scaled
 * to fill it, so a caller lays out cells and this fills one. `posed` draws the
 * picture's animation, which is how a cell shows what it does.
 */
export function handSpriteThumbnail(side, drawing, { at = { x: 0, y: 0 }, size = 40, style = HAND_DEFAULT_STYLE, posed = false } = {}) {
  const look = handStyle(style);
  const scale = size / (2 * HAND_LOCAL_RADIUS);
  const parts = handSpriteParts(side, drawing, { at, scale, posed });
  if (!parts) return '';
  return parts.order.map((part) =>
    `<path d="${parts.paths[part]}" fill="${look.fill}" stroke="${look.line}" stroke-width="${r1(look.width * scale)}"`
    + ` stroke-linejoin="round" stroke-linecap="${handPartCaps(part)}" />`).join('');
}

/* ── A picture's own animation ─────────────────────────────────────────────── */

/**
 * The shape keys that play one picture's animation.
 *
 * Its own rig, over its own parts: the rest drawing against the animated one,
 * part by part, as additive shape keys driven by the hand's animation
 * parameter. Nothing about it reaches another picture, so a set can carry a
 * picture that animates beside one that does not.
 *
 * @returns {{ok: true, keys: object[]}|{ok: false, message: string}}
 */
export function handSpriteAnimKeys(side, drawing, { at = { x: 0, y: 0 }, scale = 1, box = {}, parameter } = {}) {
  const recipe = handDrawingRecipe(drawing);
  if (!recipe?.animTable || !parameter) return { ok: true, keys: [] };
  const hand = handSideId(side);
  const rest = handSpriteParts(hand, recipe.id, { at, scale, box });
  const posed = handSpriteParts(hand, recipe.id, { at, scale, box, posed: true });
  const keys = [];
  for (const part of HAND_PART_IDS) {
    if (!rest.paths[part] || rest.paths[part] === posed.paths[part]) continue;
    const created = createShapeKey({
      id: `${handSpriteElementId(hand, recipe.id)}-anim-${part}`,
      target: handSpritePartId(hand, recipe.id, part),
      name: `${recipe.anim} · ${HAND_PART_NAMES[part]} (${hand})`,
      restPath: rest.paths[part], posePath: posed.paths[part],
      driver: { parameter, min: 0, max: 1 }
    });
    if (!created.ok) return { ok: false, keys, message: created.message };
    keys.push(created.shapeKey);
  }
  return { ok: true, keys };
}

/* ── Descriptors ───────────────────────────────────────────────────────────── */

/**
 * What a set says about itself: one descriptor per picture, for the rig's
 * `hand.sprites.drawings`.
 *
 * Every picture shares the hand's pivot and its size, because they are all the
 * same generator at the same scale around the same point — which is what stops
 * a swap from resizing or shifting the hand.
 */
export function handSpriteAssets(side, { drawings = STARTER_HAND_DRAWINGS, pivot = null, defaultScale = 1 } = {}) {
  const hand = handSideId(side);
  const out = [];
  for (const wanted of drawings) {
    const recipe = handDrawingRecipe(wanted);
    if (!recipe) continue;
    out.push({
      id: recipe.id,
      name: recipe.name,
      element: handSpriteElementId(hand, recipe.id),
      anim: recipe.anim || null,
      pivot: pivot ? [...pivot] : null,
      defaultScale
    });
  }
  return out;
}

/* ── Standalone files ──────────────────────────────────────────────────────── */

/**
 * The box every picture in a set shares, and where it turns inside it.
 *
 * One box and one pivot for every picture is what stops a swap from resizing
 * or shifting the hand. `SPRITE_SCALE` is chosen so the widest drawing clears
 * the edge by its own line: the glove's radius around the middle of its palm
 * is a little over 42 units, and 2× that inside a 200-unit box leaves 15 units
 * of margin all round.
 */
export const SPRITE_VIEW_BOX = Object.freeze({ width: 200, height: 200 });
export const SPRITE_PIVOT = Object.freeze([100, 100]);
export const SPRITE_SCALE = 2;
export const SPRITE_VIEW_BOX_ATTRIBUTE = `0 0 ${SPRITE_VIEW_BOX.width} ${SPRITE_VIEW_BOX.height}`;

/** How much room a drawing takes in the shared box, as a radius around the pivot. */
export const SPRITE_RADIUS = HAND_LOCAL_RADIUS * SPRITE_SCALE;

/**
 * One picture as a standalone SVG file: the shared box, the shared pivot, and
 * the drawing centred on it.
 *
 * This is the shape a **hand set** takes on disk — the shipped one, and any a
 * custom mascot brings with it. Nothing in it is specific to a mascot: no ids
 * from a document, no transforms from a rig, no offsets baked in to correct
 * for one. A set is a directory of these plus a manifest. `posed` writes the
 * picture's animation, which is how a set carries one on disk.
 */
export function handSpriteDocument(side, drawing, { style = HAND_DEFAULT_STYLE, posed = false } = {}) {
  const at = { x: SPRITE_PIVOT[0], y: SPRITE_PIVOT[1] };
  const body = handSpriteMarkup(side, drawing, { at, scale: SPRITE_SCALE, style, posed });
  if (!body) return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SPRITE_VIEW_BOX_ATTRIBUTE}"`
    + ` width="${SPRITE_VIEW_BOX.width}" height="${SPRITE_VIEW_BOX.height}"`
    + ` data-hand-pivot="${SPRITE_PIVOT[0]} ${SPRITE_PIVOT[1]}">${body}</svg>\n`;
}

/** `defaultCartoon/left/palmOpen.svg` — the path a set's picture lives at. */
export const handSpritePath = (set, side, drawing, { posed = false } = {}) =>
  `${set}/${handSideId(side)}/${handDrawingId(drawing) || DEFAULT_HAND_DRAWING}${posed ? '-anim' : ''}.svg`;

/**
 * A set's manifest: what it draws, and the convention its pictures share.
 *
 * Enough on its own to rig a hand from, so a mascot that brings its own hands
 * brings one of these and nothing else.
 */
export function handSpriteManifest({ set = 'defaultCartoon', name = 'Cartoon gloves', drawings = STARTER_HAND_DRAWINGS, sides = ['left', 'right'], style = HAND_DEFAULT_STYLE } = {}) {
  const assets = [];
  for (const side of sides) {
    for (const asset of handSpriteAssets(side, { drawings, pivot: [...SPRITE_PIVOT] })) {
      assets.push({
        ...asset, element: null, side,
        src: handSpritePath(set, side, asset.id),
        animSrc: asset.anim ? handSpritePath(set, side, asset.id, { posed: true }) : null
      });
    }
  }
  return {
    set, name, style,
    viewBox: SPRITE_VIEW_BOX_ATTRIBUTE,
    pivot: [...SPRITE_PIVOT],
    defaultScale: 1,
    drawings: [...drawings], sides: [...sides],
    assets
  };
}
