/**
 * Putting a hand set's drawings on a mascot (docs/HAND_STYLES.md).
 *
 * ```text
 * project/assets/hands/<set>/open.svg      the drawing, authored
 *          │
 *          ▼  core/hands/hand-set.js       read, validated, in drawing units
 *          │
 *          ▼  here                         placed, scaled, mirrored, painted
 *          │
 *          ▼  <g id="handLeftStyle-open">  on the mascot, one layer per shape
 * ```
 *
 * **There is no geometry in this file.** A gesture is a drawing somebody made,
 * and it lives on disk; what is here is where it goes on a particular mascot,
 * how big, which way round and in what colours. The eight shipped drawings were
 * seeded once by `scripts/hand-set-seed.mjs`, which nothing imports.
 *
 * A drawing is **a group of named layers** — a palm, the fingers, a thumb — in
 * paint order. That is what makes it a piece an author can open and edit rather
 * than a shape they can only swap, and it is what lets a thumb lie *in front of*
 * the fingers instead of being cut out of the hand's edge. Nothing inside a
 * drawing is rigged: the layers carry no keys and no parameters, because the
 * hand's own group carries the transform and the runtime swaps whole drawings
 * by one opacity (`runtime/hands.js`, `showHandStyle`).
 *
 * Pure geometry and strings; no DOM, no document, no state.
 */
import { HAND_STYLE_ALIASES, handSideId } from '../../../runtime/hand-vocabulary.js';
import { HAND_SET_LIBRARY, gestureLayers } from './hand-set.js';

const r1 = (value) => Math.round(Number(value) * 10) / 10;
// The panels share one escaper (`ui/escape-html.js`); `core` keeps its own
// copy rather than importing upwards out of the layer it is the bottom of.
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/* ── The look (docs/HAND_STYLES.md, "Palette") ─────────────────────────────── */

/**
 * The paint, which is a token rather than a drawing: the same shapes in the
 * classic white glove, or in the skin and warm line the face uses. A mascot's
 * own palette can be handed in whole, which is how the template dresses its
 * pair to match its face.
 *
 * Two colours and one width. There is no shading here, no gradient, no filter
 * and no second light: a floating cartoon hand has to read at thumbnail size.
 */
export const HAND_LOOKS = Object.freeze({
  glove: Object.freeze({ id: 'glove', name: 'Cartoon gloves', fill: '#ffffff', line: '#1b1b1b', width: 1.9 }),
  skin: Object.freeze({ id: 'skin', name: 'Skin', fill: '#f9d9b0', line: '#a4674a', width: 1.9 })
});
export const DEFAULT_HAND_LOOK = 'glove';

/** A named look, or one handed in whole. A colour is a colour; the drawing does not change. */
export const handLook = (look) => (look && typeof look === 'object' && look.fill
  ? { ...HAND_LOOKS[DEFAULT_HAND_LOOK], ...look }
  : HAND_LOOKS[look] || HAND_LOOKS[DEFAULT_HAND_LOOK]);

export const HAND_SKIN = HAND_LOOKS.skin.fill;
export const HAND_LINE = HAND_LOOKS.skin.line;

/* ── Which drawing (docs/HAND_STYLES.md, "Resolving a gesture") ────────────── */

/**
 * A gesture id as the **set** knows it, following the old names.
 *
 * The registry is what the library holds, so a gesture somebody added by
 * dropping a file in answers here the moment the set is read — which is the
 * whole point of the set being files. The aliases stay in the runtime's
 * vocabulary, because a project saved with `palmOpen` in it has to keep
 * opening.
 *
 * `among` is a hand's own library, when there is one: a hand drawn with four of
 * the eight gestures answers for those four, so a name it does not hold
 * resolves to nothing and the caller falls back to one the hand actually has.
 */
export function handStyleId(value, among = null) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const own = Array.isArray(among) ? among.map((entry) => (typeof entry === 'string' ? entry : entry?.id)).filter(Boolean) : null;
  const holds = (id) => (own ? own.includes(id) : HAND_SET_LIBRARY.has(id));
  if (holds(raw)) return raw;
  const alias = HAND_STYLE_ALIASES[raw] || HAND_STYLE_ALIASES[raw.toLowerCase()];
  return alias && holds(alias) ? alias : null;
}

/** The set's own record for a gesture, when it has one. */
export const handStyle = (value) => HAND_SET_LIBRARY.get(handStyleId(value));

/** What to call a gesture on screen: the hand's own label, the set's, or the id. */
export function handStyleLabel(value, among = null) {
  const own = (Array.isArray(among) ? among : []).find((entry) => entry?.id === handStyleId(value, among));
  return own?.label || own?.name || handStyle(value)?.label || (typeof value === 'string' ? value : '');
}

/** The gestures the set draws, in the order it lists them. */
export const handStyleIds = () => HAND_SET_LIBRARY.ids();
/** The gesture a hand rests on, and the one every unknown name falls back to. */
export const defaultHandStyle = () => HAND_SET_LIBRARY.info?.fallback || HAND_SET_LIBRARY.ids()[0] || '';

/**
 * Everything a placer needs: which drawing, and whether it is flipped.
 *
 * A mirrorable gesture is drawn once and flipped for the other hand, which is
 * what keeps a set to one file per gesture rather than two.
 */
export function resolveHandStyle(style, side = 'left', among = null) {
  const hand = handSideId(side);
  const asked = handStyleId(style, among);
  const id = asked || defaultHandStyle();
  const gesture = HAND_SET_LIBRARY.get(id);
  const mirrorable = gesture ? gesture.mirrorable !== false : true;
  return { id, flipX: mirrorable && hand === 'right', mirrorable, fallback: !asked };
}

/* ── Placing one drawing ───────────────────────────────────────────────────── */

/**
 * Place a path: scale it, mirror it when the other hand asks for it, and move
 * it to where the hand is.
 *
 * A drawing is `M`, `C`, `L` and `Z` — the validator refuses anything else — so
 * every number in it is a coordinate and placing one is arithmetic on pairs: no
 * command to interpret, no arc flag to flip, and a path anything that reads SVG
 * can read.
 *
 * The mirror is applied to the geometry rather than left as a transform, so a
 * drawing inside a mascot's SVG is plain path data that measures, exports and
 * sanitises like any other artwork.
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

/**
 * The layers of one drawing, as `{ part, d }` in artboard units, in paint
 * order.
 *
 * @param {string} style which gesture
 * @param {{at?: {x,y}, scale?: number, flip?: boolean}} options where it goes and how big
 */
export function handStyleShapes(style, { at = { x: 0, y: 0 }, scale = 1, flip = false } = {}) {
  const gesture = handStyle(style);
  if (!gesture) return null;
  const k = flip ? -1 : 1;
  return gestureLayers(gesture).map((layer) => ({
    part: layer.part, fillRule: layer.fillRule, d: placePath(layer.d, at, scale, k)
  }));
}

/** `handLeft` / `handRight`: the group the pair's drawings live in. */
export const handElementId = (side) => (handSideId(side) === 'right' ? 'handRight' : 'handLeft');
/** `handLeftStyle-open`: the hand's group id, then which drawing this is. */
export const handStyleElementId = (side, style) =>
  `${handElementId(side)}Style-${handStyleId(style) || defaultHandStyle()}`;
/**
 * `handLeftStyle-open-palm`: one layer of one drawing.
 *
 * A name, not a handle. Nothing *rigs* a layer of a hand — there is no key on
 * it and no parameter that moves it — but it is what an author selects in the
 * layer tree and reshapes in Edit Shape, and a stable name is what makes a
 * redraw of the same drawing the same document rather than a new one.
 */
export const handStyleShapeId = (side, style, part) => `${handStyleElementId(side, style)}-${part}`;

/**
 * One drawing, as a group of named layers.
 *
 * `hidden` is every gesture but the one the hand starts on: eight drawings
 * stacked on top of each other are one hand only because seven of them are
 * invisible, and which one is not is the runtime's business from the first
 * frame onwards. The opacity sits on the **group**, so hiding a drawing is one
 * attribute however many layers it has.
 */
export function handStyleMarkup(side, style, { at = { x: 0, y: 0 }, scale = 1, look = DEFAULT_HAND_LOOK, hidden = false } = {}) {
  if (!handStyleId(style)) return '';
  const resolved = resolveHandStyle(style, side);
  const gesture = HAND_SET_LIBRARY.get(resolved.id);
  const shapes = handStyleShapes(resolved.id, { at, scale, flip: resolved.flipX });
  if (!gesture || !shapes?.length) return '';
  const paint = handLook(look);
  const body = shapes.map((shape) =>
    `<path id="${handStyleShapeId(side, resolved.id, shape.part)}" data-name="${esc(gesture.roles[shape.part] || shape.part)}"`
    + ` d="${shape.d}"${shape.fillRule ? ` fill-rule="${shape.fillRule}"` : ''} fill="${paint.fill}" stroke="${paint.line}"`
    + ` stroke-width="${r1(paint.width * scale)}" stroke-linejoin="round" stroke-linecap="round" />`).join('');
  return `<g id="${handStyleElementId(side, resolved.id)}" data-name="${esc(gesture.label)}"`
    + `${hidden ? ' opacity="0"' : ''}>${body}</g>`;
}

/**
 * A whole library for one hand: every drawing, as sibling groups in one place.
 *
 * They all sit at the same point at the same size, so the order matters only
 * for the SVG's paint order and is therefore the set's.
 */
export function handStyleSetMarkup(side, { styles = null, showing = null, ...options } = {}) {
  const wanted = (styles || handStyleIds()).map((style) => handStyleId(style)).filter(Boolean);
  const seen = handStyleId(showing, wanted.map((id) => ({ id }))) || wanted[0] || defaultHandStyle();
  return wanted.map((style) => handStyleMarkup(side, style, { ...options, hidden: style !== seen })).join('');
}

/**
 * One drawing as a **thumbnail**: the same layers, with no ids on them.
 *
 * A thumbnail is drawn beside the hand it is about, in the same document, so it
 * cannot carry the ids the real drawing has — two nodes with one id is one node
 * as far as anything looking for it is concerned. `size` is the box it has to
 * fit in.
 */
export function handStyleThumbnail(side, style, { at = { x: 0, y: 0 }, size = 40, look = DEFAULT_HAND_LOOK } = {}) {
  if (!handStyleId(style)) return '';
  const resolved = resolveHandStyle(style, side);
  const scale = size / (2 * (HAND_STYLE_RADIUS() || 1));
  const shapes = handStyleShapes(resolved.id, { at, scale, flip: resolved.flipX });
  if (!shapes?.length) return '';
  const paint = handLook(look);
  return shapes.map((shape) =>
    `<path d="${shape.d}"${shape.fillRule ? ` fill-rule="${shape.fillRule}"` : ''} fill="${paint.fill}" stroke="${paint.line}"`
    + ` stroke-width="${r1(paint.width * scale)}" stroke-linejoin="round" stroke-linecap="round" />`).join('');
}

/* ── How much room a hand takes ────────────────────────────────────────────── */

/**
 * The radius every drawing in the set fits inside, around the middle of its
 * palm, in the drawing's own units.
 *
 * The set says it, because the set drew them. A radius rather than a box
 * because a pair of hands hangs tilted, and one number for the whole set
 * because that is what "the same apparent scale" means: a change of gesture is
 * never a change of size.
 */
export const HAND_STYLE_RADIUS = () => HAND_SET_LIBRARY.info?.radius || 0;

/** The box a gesture file uses, and where it turns inside it. */
export const HAND_STYLE_PIVOT = () => HAND_SET_LIBRARY.info?.pivot || [0, 0];
export const HAND_STYLE_SPRITE_SCALE = () => HAND_SET_LIBRARY.info?.scale || 1;
/** `0 0 200 200`: the box a thumbnail of this set is drawn in. */
export const handStyleViewBox = () => {
  const declared = HAND_SET_LIBRARY.info?.viewBox;
  if (declared) return declared;
  const [x, y] = HAND_STYLE_PIVOT();
  return `0 0 ${x * 2} ${y * 2}`;
};

/**
 * The points on a drawing something can be attached to: each drawn fingertip,
 * the middle of the palm, and the wrist (docs/HAND_STYLES.md, "Anchors").
 *
 * The set declares them, because only the drawing knows where its fingers end.
 * A gesture that does not show a finger has no tip for it, which is the honest
 * answer: there is nothing there to hold on to.
 */
export function handStyleAnchors(style) {
  const gesture = handStyle(style);
  if (!gesture) return null;
  const anchors = { palm: { x: 0, y: 0 }, wrist: { x: 0, y: r1(HAND_STYLE_RADIUS() * 0.48) } };
  for (const [part, at] of Object.entries(gesture.anchors)) anchors[part] = { x: at[0], y: at[1] };
  return anchors;
}

/**
 * What a set says about itself as a hand's **library**: one record per drawing,
 * for the rig's `hand.styles.library`.
 */
export function handStyleLibrary(side, { styles = null } = {}) {
  const hand = handSideId(side);
  const out = [];
  for (const wanted of styles || handStyleIds()) {
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

/** The set the editor is drawing hands from: its name, pivot, radius and fallback. */
export const handSetInfo = () => HAND_SET_LIBRARY.info;
