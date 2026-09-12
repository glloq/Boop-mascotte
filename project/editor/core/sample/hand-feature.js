/**
 * Where a pair of floating hands goes, and how it hides
 * (docs/HAND_RIGGING.md, docs/HAND_STYLES.md).
 *
 * ```text
 * measure the body → place one hand below and outside it → mirror it
 *        → a reach in proportion → keep the pair on the artboard
 * ```
 *
 * What a hand *looks* like is a style, and styles live in
 * `core/hands/hand-style-art.js`. This is everything else a pair needs: the
 * artboard it wants, where each hand hangs, how far it can travel, where it
 * hides behind the head, and the two clips it comes with.
 *
 * Pure: the canvas appends markup and measures; this decides what the numbers
 * are and what the rig says about them.
 */
import { HAND_SIDES, mirrorHand, normalizeHand } from '../hands/hand-model.js';
import { inverseElementTransform } from '../../../runtime/runtime.js';
import { normalizeKeyform } from '../../../runtime/keyforms.js';
import {
  DEFAULT_HAND_LOOK, HAND_LOOKS, HAND_STYLE_RADIUS, handElementId, handLook
} from '../hands/hand-style-art.js';

export { HAND_LOOKS, DEFAULT_HAND_LOOK, handLook, handElementId };

const capital = (side) => (side === 'right' ? 'R' : 'L');
const named = (side, name) => `hand${capital(side)}${name.charAt(0).toUpperCase()}${name.slice(1)}`;

/** `handLShow`: 0 tucked behind the head, 1 out at the rest place (the runtime knows the same name). */
export const handShowParameter = (side) => named(side, 'show');

/** `handLStyle`: which drawing this hand shows (docs/HAND_STYLES.md). */
export const handStyleParameter = (side) => named(side, 'style');

/* ── The artboard the hands are drawn on ───────────────────────────────────── */

/**
 * The artboard the artwork is drawn on, so hands land beside the mascot and
 * not on it.
 *
 * Its **corner** comes back with its size. A viewBox does not have to start at
 * the origin — the template's starts above it, so there is room over the head
 * for a hat (`core/sample/templates/face-artwork.js`) — and a box read as a
 * width and a height alone says the bottom of the page is at `height`, which
 * on such an artboard is sixty units short of where it is.
 */
export function artboardBox(state = {}) {
  const match = /viewBox="([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"/.exec(state.svgMarkup || '');
  if (!match) return { x: 0, y: 0, width: 240, height: 240 };
  return { x: Number(match[1]) || 0, y: Number(match[2]) || 0, width: Number(match[3]) || 240, height: Number(match[4]) || 240 };
}

/**
 * The drawings are made for a 240-wide artboard and scaled with everything
 * else: a floating cartoon hand is *large*, because it has no arm to give it
 * scale and nothing but its size says how near it is.
 */
export const handScale = ({ width = 240 } = {}) => (Number(width) > 0 ? Number(width) : 240) / 240;

/**
 * How far the hand is turned at rest, per side.
 *
 * The drawings are made with the fingers up and the wrist below, which is the
 * one orientation a hand beside a mascot never has: hanging by the body, the
 * fingers point **down**. Half a turn does that, and it also carries the thumb
 * across to the inner edge — thumbs towards the middle, which is how a pair of
 * hands reads as a pair rather than as two left hands. The extra 20 degrees
 * fans them outwards so they do not sit parallel like a doll's.
 */
export const HAND_REST_TILT = Object.freeze({ left: 200, right: 160 });

/** Where a hand rests when nothing has been measured: the lower corners. */
export function handRestPoint(side, { width = 240, height = 240 } = {}) {
  const w = Number(width) > 0 ? Number(width) : 240, h = Number(height) > 0 ? Number(height) : 240;
  return { x: Math.round(side === 'right' ? w * 0.8 : w * 0.2), y: Math.round(h * 0.8) };
}

/**
 * Where the mascot is when nothing could be measured: the page from the origin
 * down.
 *
 * Artwork is drawn from the origin, and what a page keeps *above* it is
 * headroom for what a head wears (`core/sample/templates/face-artwork.js`).
 * Nothing hangs from headroom, so a pair of hands reads the page below the
 * origin and a taller frame over the head leaves the pair exactly where it was.
 */
const drawnArea = (artboard) => ({ width: artboard.width, height: (Number(artboard.y) || 0) + artboard.height });

/* ── The clips a pair comes with ───────────────────────────────────────────── */

/**
 * A wave is a **rotation**, not a shape (docs/HAND_STYLES.md, "No wave
 * style"): the open hand turns one way, then the other, then back, and comes
 * out from behind the head to do it. The drawing never changes and never
 * deforms — which is exactly the point.
 */
export const HAND_WAVE_CLIP = Object.freeze({
  id: 'hand-wave', name: 'Wave', duration: 1.4, loop: false,
  tracks: {
    handLRotation: [
      { time: 0, value: 0, easing: 'linear' }, { time: .25, value: .7, easing: 'easeInOut' },
      { time: .55, value: -.5, easing: 'easeInOut' }, { time: .85, value: .6, easing: 'easeInOut' },
      { time: 1.4, value: 0, easing: 'easeInOut' }
    ],
    handLY: [{ time: 0, value: 0, easing: 'linear' }, { time: .3, value: -.7, easing: 'easeOut' }, { time: 1.1, value: -.7 }, { time: 1.4, value: 0, easing: 'easeIn' }],
    // A hand that rests behind the head comes out to wave and goes back after.
    handLShow: [{ time: 0, value: 0, easing: 'linear' }, { time: .3, value: 1, easing: 'easeOut' }, { time: 1.1, value: 1 }, { time: 1.4, value: 0, easing: 'easeIn' }]
  }
});

/**
 * Both hands up: out from behind the head, up and out, a small bounce of the
 * head with them, then back. The cheer a reaction reaches for.
 */
export const HANDS_UP_CLIP = Object.freeze({
  id: 'hands-up', name: 'Hands up', duration: 1.6, loop: false,
  tracks: Object.fromEntries([
    ...['L', 'R'].flatMap((side) => [
      [`hand${side}Show`, [{ time: 0, value: 0, easing: 'linear' }, { time: .3, value: 1, easing: 'easeOut' }, { time: 1.2, value: 1 }, { time: 1.6, value: 0, easing: 'easeIn' }]],
      [`hand${side}Y`, [{ time: 0, value: 0, easing: 'linear' }, { time: .45, value: -1, easing: 'easeOut' }, { time: .7, value: -.85, easing: 'easeInOut' }, { time: .95, value: -1, easing: 'easeInOut' }, { time: 1.2, value: -.9 }, { time: 1.6, value: 0, easing: 'easeIn' }]],
      [`hand${side}X`, [{ time: 0, value: 0, easing: 'linear' }, { time: .45, value: side === 'L' ? -.4 : .4, easing: 'easeOut' }, { time: 1.2, value: side === 'L' ? -.4 : .4 }, { time: 1.6, value: 0, easing: 'easeIn' }]]
    ]),
    ['headY', [{ time: 0, value: 0, easing: 'linear' }, { time: .35, value: -.5, easing: 'easeOut' }, { time: .6, value: 0, easing: 'easeIn' }, { time: .8, value: -.25, easing: 'easeOut' }, { time: 1, value: 0, easing: 'easeIn' }]]
  ])
});

/** The clips a pair of hands is drawn with, in the order they are added. */
export const HAND_CLIPS = Object.freeze([HAND_WAVE_CLIP, HANDS_UP_CLIP]);

/**
 * The style each clip asks its hands to show, as a **step** track: a choice is
 * keyframed discretely and never blended (docs/HAND_STYLES.md, "Timeline").
 * The index depends on the hand's own library, so the track is written when
 * the pair is installed rather than baked in here.
 */
export const HAND_CLIP_STYLES = Object.freeze({
  'hand-wave': Object.freeze({ left: 'open' }),
  'hands-up': Object.freeze({ left: 'open', right: 'open' })
});

/**
 * The expression a hidden pair comes out with: both show parameters at 1, so a
 * reaction can pick "Hands out" like any other expression and a page can ramp
 * it with `mascot.showHands()`. The id is the one the runtime looks for.
 */
export const HANDS_OUT_EXPRESSION = Object.freeze({ id: 'hands-out', name: 'Hands out', source: 'hands' });

export const HANDS_DOMAINS = ['artwork', 'layers', 'rig', 'hands', 'keyforms', 'stateMachine', 'animation', 'expressions'];

/** Both hands drawn, rigged and pointing at artwork that still exists. */
export function areHandsInstalled(state = {}) {
  return HAND_SIDES.every((side) => {
    const hand = state.hands?.[side];
    return Boolean(hand?.element && state.elements?.[hand.element]);
  });
}

/**
 * The look a pair was drawn in, read off the first layer of the first drawing;
 * the default for a pair that has none.
 *
 * A drawing is a group of layers, so the paint is on the layers rather than on
 * the group -- reading the group would find no `fill` at all, and a hand drawn
 * afterwards would come out white beside a pair that is not.
 */
export function installedHandLook(state = {}) {
  const drawing = /<g id="hand(?:Left|Right)Style-[^"]*"[^>]*>\s*<path[^>]*>/.exec(state.svgMarkup || '')?.[0] || '';
  const read = (name) => new RegExp(`${name}="([^"]+)"`).exec(drawing)?.[1] || null;
  const fill = read('fill');
  if (!fill) return DEFAULT_HAND_LOOK;
  const scale = handScale(artboardBox(state)) || 1;
  const drawn = Number(read('stroke-width'));
  const line = read('stroke');
  const width = Number.isFinite(drawn) && drawn > 0 ? Math.round((drawn / scale) * 100) / 100 : null;
  // A named look only when the pair is drawn in **all** of it. The template
  // dresses its hands in the face's palette *and* the face's line weight, so a
  // pair whose fill happens to be the skin colour is not the skin look: coming
  // back with the name would lose the weight, and a hand drawn later would
  // arrive beside the pair with a different line.
  const known = Object.values(HAND_LOOKS).find((look) =>
    look.fill === fill && (!line || look.line === line) && (width === null || look.width === width));
  if (known) return known.id;
  // Otherwise the look comes back whole, exactly as the document has it --
  // otherwise a hand drawn later comes out white beside a pair that is not.
  return {
    ...HAND_LOOKS[DEFAULT_HAND_LOOK], id: 'installed', name: 'As drawn',
    fill, line: line || HAND_LOOKS[DEFAULT_HAND_LOOK].line,
    ...(width === null ? {} : { width })
  };
}

/* ── First placement (VNX-20, docs/VNEXT_ROADMAP.md) ───────────────────────
 *
 * A pair used to arrive at the coordinates the *template* wanted, which is
 * right for a face drawn to fill its artboard and wrong for every import. So
 * the placement is measured. The measuring itself belongs to the canvas (only
 * the DOM knows how big a path really is), so it arrives as an injected
 * `measure(id)`; with nothing to measure the pair falls back to exactly where
 * it used to go.
 */

/** How far a hand may travel each way, as a share of the mascot's own size. */
const REACH_SHARE = 0.16;
/** A full half-turn either way, and a quarter of its size. */
const REACH_ROTATION = 180, REACH_SCALE = 0.25;
/** The floor Hand Setup's fields and hand mode already use (`HAND_REACH_MINIMUM`). */
const REACH_FLOOR = 1;

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const round = (value) => Math.round(number(value) * 100) / 100;
const reachOf = (x, y) => ({ x: Math.max(REACH_FLOOR, x), y: Math.max(REACH_FLOOR, y), rotation: REACH_ROTATION, scale: REACH_SCALE });

/** A box worth placing against, or null when there is nothing there to measure. */
const usableBox = (box) => (number(box?.width) > 0 && number(box?.height) > 0
  ? { x: number(box.x), y: number(box.y), width: number(box.width), height: number(box.height) }
  : null);

/**
 * The element the hands hang from, and the one they are measured against.
 *
 * Never one of the hands themselves: a project whose only artwork is the pair
 * being drawn would otherwise anchor a hand to itself.
 */
export function handBodyElement(state = {}, parent = null) {
  if (parent) return parent;
  const own = new Set(HAND_SIDES.map(handElementId));
  const drawn = Object.keys(state.elements || {}).filter((id) => !own.has(id) && !/^hand(?:Left|Right)Style-/.test(id));
  return drawn.includes('faceRoot') ? 'faceRoot' : (drawn[0] || null);
}

/** The hand's own size and travel for a body this big. One definition, two readers. */
function handRoom(body) {
  return {
    radius: HAND_STYLE_RADIUS() * handScale({ width: body.width }),
    reach: reachOf(Math.round(REACH_SHARE * body.width), Math.round(REACH_SHARE * body.height))
  };
}

/**
 * The artboard the pair needs: the one there is, or a taller one.
 *
 * Hands hang **below** the mascot, and a drawing that fills its artboard
 * leaves nowhere for them. Adding hands therefore adds room, once, in the same
 * undo step. An artboard that is already tall enough is left alone.
 *
 * The room is added at the **bottom**, so what grows is the height and the
 * corner stays where it is: an artboard with headroom over the head keeps it.
 * The floor a pair needs is an absolute height on the page — measured from the
 * body, or four thirds of the width when there is nothing to measure — never a
 * height counted from wherever the page happens to begin.
 */
function grownArtboard(state, body) {
  const box = artboardBox(state);
  const { radius, reach } = body ? handRoom(body) : { radius: 0, reach: { y: 0 } };
  const floor = body ? Math.ceil(body.y + body.height + 2 * radius + reach.y) : Math.round(box.width * 1.35);
  return { x: box.x, y: box.y, width: box.width, height: Math.max(box.height, floor - box.y) };
}

/** Below the mascot and outside it, as far as the artboard allows. */
function placeBesideBody(body, artboard) {
  const { radius, reach } = handRoom(body);
  const centre = body.x + body.width / 2;
  // A hand at full reach must still be on the drawing, so the anchor keeps its
  // whole ellipse -- or at least its own outline -- inside the edge.
  const margin = Math.max(radius, reach.x);
  // One distance from the mascot's middle serves both hands, so the artboard
  // can never pull one side in without the other and leave the pair lopsided.
  const room = Math.min(centre - (artboard.x + margin), artboard.x + artboard.width - margin - centre);
  const dx = Math.max(radius, Math.min(body.width / 2 + radius, room));
  const y = Math.min(body.y + body.height + radius, artboard.y + artboard.height - Math.max(radius, reach.y));
  return { left: { x: round(centre - dx), y: round(y) }, mirrorX: centre, reach, size: body.width / artboard.width };
}

/** Nothing to measure: the lower corners, which is where the pair has always gone. */
function placeInCorners(artboard) {
  const drawn = drawnArea(artboard);
  return {
    left: handRestPoint('left', drawn), mirrorX: drawn.width / 2,
    reach: reachOf(Math.round(drawn.width * 0.16), Math.round(drawn.height * 0.17)), size: 1
  };
}

/**
 * The other hand, from this one, through the same function Hand Setup's
 * "Mirror to the other side" calls.
 */
function mirrorPoint(point, mirrorX) {
  const pair = mirrorHand({ left: normalizeHand({ element: handElementId('left'), anchor: point }, 'left') },
    'left', { mirrorX, element: handElementId('right') });
  return { x: round(pair.right.anchor.x), y: round(pair.right.anchor.y) };
}

/**
 * Where a pair of hands goes on *this* project.
 *
 * The measuring is injected because only the canvas can do it: `measure(id)`
 * answers a box in the artboard's own units. Answering `null` — an empty
 * project, a caller with no canvas — is not an error, it is the fallback above.
 *
 * @param {object} state the document as it stands before the hands are drawn
 * @param {{measure?: ?(id: string) => ?{x,y,width,height}, parent?: ?string}} options
 * @returns {{artboard, body, parent, measured, reach, size, points, anchors}}
 */
export function handPlacement(state = {}, { measure = null, parent = null } = {}) {
  const parentId = handBodyElement(state, parent);
  const body = typeof measure === 'function' && parentId ? usableBox(measure(parentId)) : null;
  const artboard = grownArtboard(state, body);
  const placed = body ? placeBesideBody(body, artboard) : placeInCorners(artboard);
  const points = { left: placed.left, right: mirrorPoint(placed.left, placed.mirrorX) };
  // The document keeps an anchor in the *parent's* coordinates while the
  // artwork is drawn in the artboard's. On a body carrying a transform of its
  // own the two differ, and an ellipse drawn around the wrong one is an
  // ellipse beside the hand.
  const base = parentId ? state.elements?.[parentId]?.baseTransform : null;
  const anchors = Object.fromEntries(HAND_SIDES.map((side) => {
    const local = base ? inverseElementTransform(base, points[side]) : points[side];
    return [side, { x: round(local.x), y: round(local.y) }];
  }));
  return { artboard, body, parent: parentId, measured: Boolean(body), reach: placed.reach, size: placed.size, points, anchors };
}

/** The artboard a pair of hands needs, grown if the pair needs the room. */
export function handsArtboard(state = {}, options = {}) {
  return handPlacement(state, options).artboard;
}

/** The viewBox that room needs, or null when the artboard already had it. */
export function handsViewBox(state = {}, options = {}) {
  const box = artboardBox(state), grown = handsArtboard(state, options);
  return grown.height > box.height ? `${grown.x} ${grown.y} ${grown.width} ${grown.height}` : null;
}

/**
 * Where a hand's drawings sit: the middle of the hand, and how big it is.
 *
 * A hand the editor drew knows both from its group — the pivot is the middle
 * of the palm, the transform its tilt and size — so a drawing lands exactly
 * under the last one. Any other artwork is measured by the canvas: the drawing
 * is centred on its box and no bigger than it, unturned, because nothing says
 * which way that artwork hangs.
 *
 * @returns {{at: {x,y}, scale: number}|null}
 */
export function handFrame(state = {}, side = 'left', measure = () => null) {
  const hand = state.hands?.[side];
  if (!hand?.element || !state.elements?.[hand.element]) return null;
  const base = state.elements[hand.element].baseTransform || {};
  if (Number.isFinite(base.pivotX) && Number.isFinite(base.pivotY) && (base.pivotX || base.pivotY)) {
    return { at: { x: Number(base.pivotX), y: Number(base.pivotY) }, scale: handScale(artboardBox(state)) };
  }
  const box = typeof measure === 'function' ? measure(hand.element) : null;
  if (!box || !(Number(box.width) > 0) || !(Number(box.height) > 0)) return null;
  return {
    at: { x: round(box.x + box.width / 2), y: round(box.y + box.height / 2) },
    scale: Math.max(box.width, box.height) / (2 * HAND_STYLE_RADIUS())
  };
}

/* ── Behind the head (docs/HAND_RIGGING.md, "Behind the head") ───────────────
 *
 * ```text
 * handLShow   0 ──────────── 0.7 ────── 1
 *             tucked behind the head    out, at the rest place
 * translate   hidden − rest             0
 * depth       −1        −1  ──────────  0     the band flips near the end,
 *                                             once the hand is clear of the head
 * ```
 *
 * A pair drawn by the editor rests hidden: the group carries keyforms over one
 * parameter that slide it from behind the head to its rest place and lift it
 * from the `behind` band as it clears. The runtime adds that depth to the
 * hand's own (`evaluateHands`), the canvas paints the same order, and the
 * parameter is an ordinary one.
 */
const SHOW_STOPS = Object.freeze([0, 0.7, 1]);
/** How big the hand is where it hides. See `setHandHidden`. */
const HIDDEN_SCALE = 0.6;
const showKeyId = (element, channel) => `${element}-show-${channel}`;

const ensureParameter = (state, name, range = { min: 0, max: 1 }) => {
  state.params[name] ||= { type: 'number', ...range, default: 0, value: 0 };
  for (const stored of Object.values(state.states || {})) if (!(name in stored)) stored[name] = 0;
};
const putGrid = (state, record) => {
  state.keyforms = (state.keyforms || []).filter((item) => item.id !== record.id).concat([normalizeKeyform(record)]);
};

/**
 * Where a hand hides: in the lower half of the head, a little towards its own
 * side, so the whole drawing is inside the silhouette that hides it.
 */
export function handHiddenPoint(side, placement = {}) {
  const body = placement.body, box = drawnArea(placement.artboard || { x: 0, y: 0, width: 240, height: 240 });
  const sign = side === 'right' ? 1 : -1;
  if (body) return { x: round(body.x + body.width / 2 + sign * body.width * 0.22), y: round(body.y + body.height * 0.55) };
  return { x: round(box.width / 2 + sign * box.width * 0.2), y: round(box.height * 0.45) };
}

/** Whether this hand rests behind the head: the keyforms that hide it are there. */
export function isHandHidden(state = {}, side = 'left') {
  const element = state.hands?.[side]?.element;
  return Boolean(element && (state.keyforms || []).some((item) => item.id === showKeyId(element, 'depth')));
}

/**
 * Hide a hand behind the head, or bring its rest back into the open. `at` is
 * where the hand rests on the artboard and `hidden` where it hides; the
 * parameter, the keyforms and the "Hands out" expression follow.
 */
export function setHandHidden(state, side, hidden = true, { at = null, hidden: point = null } = {}) {
  const element = state.hands?.[side]?.element;
  if (!element || !state.elements?.[element]) return false;
  const show = handShowParameter(side);
  const drop = (id) => { state.keyforms = (state.keyforms || []).filter((item) => item.id !== id); };
  if (!hidden) {
    for (const channel of ['x', 'y', 'depth', 'scaleX', 'scaleY']) drop(showKeyId(element, channel));
    delete state.params?.[show];
    for (const stored of Object.values(state.states || {})) delete stored[show];
    // The pair's clips brought this hand out; with nothing to bring out, the track goes.
    for (const clip of state.animationClips || []) if (clip.tracks?.[show]) delete clip.tracks[show];
    const expression = (state.expressions || []).find((item) => item.id === HANDS_OUT_EXPRESSION.id);
    if (expression) {
      delete expression.controls?.[show];
      if (!Object.keys(expression.controls || {}).length) state.expressions = state.expressions.filter((item) => item !== expression);
    }
    return true;
  }
  if (!at || !point) return false;
  ensureParameter(state, show, { min: 0, max: 1 });
  const axis = { parameter: show, values: SHOW_STOPS };
  const target = { kind: 'element', id: element };
  putGrid(state, { id: showKeyId(element, 'x'), target, channel: 'translateX', axes: [axis], keyforms: [{ at: [0], value: round(point.x - at.x) }, { at: [1], value: round((point.x - at.x) * 0.3) }, { at: [2], value: 0 }] });
  putGrid(state, { id: showKeyId(element, 'y'), target, channel: 'translateY', axes: [axis], keyforms: [{ at: [0], value: round(point.y - at.y) }, { at: [1], value: round((point.y - at.y) * 0.3) }, { at: [2], value: 0 }] });
  putGrid(state, { id: showKeyId(element, 'depth'), target, channel: 'depth', axes: [axis], keyforms: [{ at: [0], value: -1 }, { at: [1], value: -1 }, { at: [2], value: 0 }] });
  // And it is smaller while it is away: a hiding place is a *point*, so how
  // much of the drawing fits inside the silhouette that hides it depends on
  // how big it is. Shrinking it as it goes back reads as the hand being
  // further away rather than as a bug.
  for (const channel of ['scaleX', 'scaleY']) {
    putGrid(state, { id: showKeyId(element, channel), target, channel, axes: [axis],
      keyforms: [{ at: [0], value: HIDDEN_SCALE }, { at: [1], value: round(HIDDEN_SCALE + (1 - HIDDEN_SCALE) * 0.7) }, { at: [2], value: 1 }] });
  }
  // And the pair's own clips bring it out again.
  for (const built of HAND_CLIPS) {
    const clip = (state.animationClips || []).find((item) => item.id === built.id);
    if (clip && built.tracks[show] && !clip.tracks?.[show]) clip.tracks = { ...(clip.tracks || {}), [show]: structuredClone(built.tracks[show]) };
  }
  state.expressions ||= [];
  let expression = state.expressions.find((item) => item.id === HANDS_OUT_EXPRESSION.id);
  if (!expression) { expression = { ...HANDS_OUT_EXPRESSION, controls: {} }; state.expressions.push(expression); }
  expression.controls = { ...(expression.controls || {}), [show]: 1 };
  return true;
}

/** A style id from the name an author typed: `Thumbs up!` → `thumbsUp`. */
export function styleIdFromName(name = '') {
  const words = String(name).match(/[\p{L}\p{N}]+/gu) || [];
  const id = words.map((word, index) => (index === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())).join('');
  return id || 'style';
}
