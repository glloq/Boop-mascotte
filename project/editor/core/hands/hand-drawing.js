/**
 * Editing **one drawing of one hand** (docs/HAND_STYLES.md, "A gesture is a
 * file"; docs/CHARACTER_BUILDER.md, "Hands").
 *
 * ```text
 *  handLeft                       (g)   the hand: reach, drift, turn, size
 *   ├─ Relaxed                    (g)   a drawing -- this is what is edited
 *   │   ├─ Index               (path)   a layer: drag its points
 *   │   └─ …
 *   └─ Open                       (g)   opacity="0"
 * ```
 *
 * A drawing used to be one path with nothing inside it, so there was nothing
 * to edit and `VNX-22` was marked superseded for saying so. A drawing is a
 * group of named layers now, and every one of them reshapes through the tools
 * that already exist: `setEditScope` limits the visible edit to the drawing,
 * `startNodeEdit` drags its points, and both work on a `<g>` unchanged.
 *
 * What is new is only the pair of questions the panel has to answer:
 *
 * * **has this drawing been reshaped?** -- `shapeSignature` of what is in the
 *   document against `shapeSignature` of what the set draws at the same place.
 *   A move, a turn or a resize of the whole hand leaves the word alone, which
 *   is the point of using that word rather than comparing markup;
 * * **put the set's drawing back** -- the layers redrawn from the set, into
 *   the group that is already there, so the hand's own transform, its opacity
 *   and its place in the paint order are untouched.
 *
 * Pure strings and records; no DOM. The command at the bottom is the only
 * piece that knows about a store.
 */
import { elementSpan, shapeSignature } from '../face-library/face-part-artwork.js';
import { handFrame, installedHandLook } from '../sample/hand-feature.js';
import { handStyleElementId, handStyleId, handStyleLabel, handStyleShapes, handStyleMarkup } from './hand-style-art.js';

const HAND_SIDES = Object.freeze(['left', 'right']);

/** Where a hand's drawings are placed and how big: the hand's own pivot and the artboard's scale. */
export const handDrawingFrame = (state, side, measure = () => null) => handFrame(state, side, measure);

/** The ids of the layers a drawing is made of, in paint order. */
export const handDrawingLayerIds = (side, style) => (handStyleShapes(style, { at: { x: 0, y: 0 }, scale: 1 }) || [])
  .map((shape) => `${handStyleElementId(side, style)}-${shape.part}`);

/**
 * What the **set** would draw for this gesture, on this hand, as it is placed
 * now: the group and its layers, in the mascot's own palette.
 *
 * Returns `''` when the hand is not placed yet (nothing to measure) or the set
 * does not draw this gesture any more -- a set an author replaced can be a set
 * without it, and "restore" then honestly has nothing to restore from.
 */
export function pristineHandDrawing(state = {}, side = 'left', style = null, { measure, look } = {}) {
  const id = handStyleId(style);
  const frame = handDrawingFrame(state, side, measure);
  if (!id || !frame) return '';
  return handStyleMarkup(side, id, { at: frame.at, scale: frame.scale, look: look ?? installedHandLook(state) });
}

/** The children of a drawing's group: its layers, without the group around them. */
const innerMarkup = (markup) => {
  const open = markup.indexOf('>');
  const close = markup.lastIndexOf('</g>');
  return open < 0 || close < 0 ? '' : markup.slice(open + 1, close);
};

/**
 * Whether the drawing in the document is still the one the set draws.
 *
 * `null` when the question cannot be asked -- the hand is not drawn, or the set
 * no longer has the gesture -- which a panel shows as neither "as the set draws
 * it" nor "reshaped", because it does not know.
 */
export function handDrawingIsCustom(state = {}, side = 'left', style = null, options = {}) {
  const element = handStyleId(style) ? handStyleElementId(side, style) : null;
  if (!element || !elementSpan(state.svgMarkup || '', element)) return null;
  const pristine = pristineHandDrawing(state, side, style, options);
  if (!pristine) return null;
  return shapeSignature(state.svgMarkup || '', [element]) !== shapeSignature(pristine, [element]);
}

/**
 * Every drawing of a hand, with what the panel needs to talk about it: what it
 * is called, the node to edit, and whether it has been reshaped.
 */
export function describeHandDrawings(state = {}, side = 'left', options = {}) {
  const hand = state.hands?.[side];
  if (!hand?.styles?.library?.length) return [];
  return hand.styles.library.map((entry) => ({
    id: entry.id,
    label: entry.label || handStyleLabel(entry.id) || entry.id,
    element: entry.element,
    layers: handDrawingLayerIds(side, entry.id),
    resting: entry.id === hand.styles.showing,
    custom: handDrawingIsCustom(state, side, entry.id, options) === true
  }));
}

/**
 * The set's drawing back, into the group that is already there.
 *
 * Only the **layers** are replaced. The group keeps its id, its name, its
 * opacity and whatever transform the canvas has applied to it, so a restore
 * cannot move a hand, change which drawing is showing, or reorder the pair --
 * the three things that would make this dangerous rather than useful.
 *
 * Mutates `state`; the command below does it on a candidate and commits.
 */
export function restoreHandDrawing(state = {}, side = 'left', style = null, options = {}) {
  const element = handStyleId(style) ? handStyleElementId(side, style) : null;
  const span = element ? elementSpan(state.svgMarkup || '', element) : null;
  const pristine = span ? pristineHandDrawing(state, side, style, options) : '';
  const layers = pristine ? innerMarkup(pristine) : '';
  if (!span || !layers) return false;
  const drawn = state.svgMarkup.slice(span.start, span.end);
  const open = drawn.indexOf('>');
  if (open < 0 || !drawn.endsWith('</g>')) return false;
  state.svgMarkup = state.svgMarkup.slice(0, span.start)
    + drawn.slice(0, open + 1) + layers + '</g>'
    + state.svgMarkup.slice(span.end);
  // A shape the author drew into the drawing goes with the restore, and so
  // does its rig record: an element nothing draws is an element the validator
  // is right to complain about.
  const kept = new Set(handDrawingLayerIds(side, style));
  const gone = [...drawn.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1])
    .filter((id) => id !== element && !kept.has(id));
  for (const id of gone) {
    delete state.elements?.[id];
    delete state.layerMetadata?.[id];
  }
  // The layer tree goes with them. The canvas rebuilds its own from the markup
  // on the next reconcile, but the document's copy is what the panels read, and
  // a tree that still lists a shape nothing draws is a row an author can click.
  if (gone.length) {
    const prune = (items) => (items || []).filter((item) => !gone.includes(item.id))
      .map((item) => (item.children?.length ? { ...item, children: prune(item.children) } : item));
    state.layers = prune(state.layers);
  }
  for (const id of kept) {
    state.elements[id] ||= {
      baseTransform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: 0, pivotY: 0 }, baseOpacity: 1,
      constraints: { translate: true, rotate: true, scale: true }, bindings: {},
      meta: { nodeType: 'path' }, morph: { enabled: false, param: '', min: 0, max: 1, pathA: '', pathB: '' }
    };
  }
  return true;
}

/** A restore as one document revision, so one undo puts the author's edit back. */
export function restoreHandDrawingCommand(store, history, side, style, options = {}) {
  if (!HAND_SIDES.includes(side)) return false;
  const candidate = structuredClone(store.getDocument());
  if (!restoreHandDrawing(candidate, side, style, options)) return false;
  history?.snapshot();
  store.execute({
    type: 'hands/restore-drawing', source: 'hands', domains: ['artwork', 'layers', 'hands'],
    apply: (document) => {
      document.svgMarkup = candidate.svgMarkup;
      document.elements = structuredClone(candidate.elements);
      document.layers = structuredClone(candidate.layers);
      document.layerMetadata = structuredClone(candidate.layerMetadata);
    }
  });
  return true;
}
