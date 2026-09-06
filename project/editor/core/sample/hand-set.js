/**
 * A set of drawings for a hand (docs/HAND_REPRESENTATIONS_STUDY.md, stage 4).
 *
 * ```text
 * hand (neutral artwork)          fades out by exactly as much as…
 *  ├─ handLeftSetFist   (g)       …the drawing a pose raises fades in
 *  ├─ handLeftSetPoint  (g)
 *  └─ handLeftSetOk     (g)       one hand between them, never a pile
 * ```
 *
 * Method B, the way a 2D cut-out animator swaps hands: every pose is a whole
 * drawing, cross-faded in as the neutral hand fades out, carried by the hand's
 * own reach, anchor drift, turn and size (`runtime/hands.js`). Two sources:
 *
 * * the **built-in set** — the glove generator's gestures, drawn as static
 *   groups where the hand is and at its size, for a hand whose artwork is not
 *   the generator's (an imported blob, a part standing in for a hand);
 * * an **imported SVG** — its top-level drawings, each wrapped so it is
 *   centred on the hand and no bigger than it, named after the pose it is
 *   for when its id or name says so.
 *
 * Pure: the canvas appends the markup and measures; this decides what the
 * markup is and what the rig says about it.
 */
import { addHandPose, handPoseParameter, HAND_SIDES } from '../hands/hand-model.js';
import {
  HAND_DEFAULT_STYLE, HAND_LOCAL_RADIUS, HAND_PART_NAMES, HAND_POSE_TABLES, HAND_PROFILE_POSE_TABLES, HAND_STYLES,
  artboardBox, handElementId, handParts, handScale
} from './hand-artwork.js';
import { SUGGESTED_HAND_POSES } from '../hands/hand-model.js';
import { GENERATED_HAND_POSES, isGeneratedHand, poseIdFromName } from './hand-feature.js';

const capital = (word) => `${String(word).charAt(0).toUpperCase()}${String(word).slice(1)}`;
const r1 = (value) => Math.round(Number(value) * 10) / 10;
const esc = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

/** `handLeftSetFist`: the hand's id, then the drawing's. */
export const handSetElementId = (side, id) => `${handElementId(side)}Set${capital(id)}`;

/** The built-in set: what the glove generator can draw as swappable drawings. */
export const HAND_SET_DRAWINGS = Object.freeze([
  ...GENERATED_HAND_POSES.map((pose) => Object.freeze({ id: pose.id, name: pose.name, view: 'front', pose: HAND_POSE_TABLES[pose.id] })),
  Object.freeze({ id: 'side', name: 'Side', view: 'profile', pose: null }),
  Object.freeze({ id: 'pointSide', name: 'Point (side)', view: 'profile', pose: HAND_PROFILE_POSE_TABLES.point }),
  Object.freeze({ id: 'thumbsUpSide', name: 'Thumbs Up (side)', view: 'profile', pose: HAND_PROFILE_POSE_TABLES.thumbsUp }),
  Object.freeze({ id: 'fistSide', name: 'Fist (side)', view: 'profile', pose: HAND_PROFILE_POSE_TABLES.fist })
]);

export const HAND_SET_DOMAINS = ['artwork', 'layers', 'rig', 'hands', 'stateMachine'];

/**
 * Where a set is drawn: the middle of the hand and how big it is.
 *
 * A generated hand knows both from its group -- the pivot is the middle of the
 * palm, the transform its tilt and size -- so a drawing lands exactly under
 * the neutral hand. Any other artwork is measured by the canvas: the drawing
 * is centred on its box and no bigger than it, unturned, because nothing says
 * which way that artwork hangs.
 *
 * @returns {{at: {x,y}, scale: number, transform: object}|null}
 */
export function handSetFrame(state = {}, side = 'left', measure = () => null) {
  const hand = state.hands?.[side];
  if (!hand?.element || !state.elements?.[hand.element]) return null;
  const base = state.elements[hand.element].baseTransform || {};
  if (isGeneratedHand(state, side)) {
    return {
      at: { x: Number(base.pivotX) || 0, y: Number(base.pivotY) || 0 },
      scale: handScale(artboardBox(state)),
      transform: { x: 0, y: 0, rotation: Number(base.rotation) || 0, scaleX: Number(base.scaleX) || 1, scaleY: Number(base.scaleY) || 1, pivotX: Number(base.pivotX) || 0, pivotY: Number(base.pivotY) || 0 }
    };
  }
  const box = measure(hand.element);
  if (!box || !(Number(box.width) > 0) || !(Number(box.height) > 0)) return null;
  const at = { x: r1(box.x + box.width / 2), y: r1(box.y + box.height / 2) };
  return {
    at,
    scale: Math.max(box.width, box.height) / (2 * HAND_LOCAL_RADIUS),
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: at.x, pivotY: at.y }
  };
}

const paintParts = (prefix, parts, style, size) => parts.order.map((part) =>
  `<path id="${prefix}${capital(part)}" data-name="${HAND_PART_NAMES[part]}" d="${parts.paths[part]}" fill="${style.fill}" stroke="${style.line}" stroke-width="${r1(style.width * size)}" stroke-linejoin="round" stroke-linecap="round" />`).join('');

/**
 * The built-in set as markup: one group per drawing, each the glove generator's
 * gesture drawn where the hand is and at its size.
 */
export function builtInHandSetMarkup(state = {}, side = 'left', { style = HAND_DEFAULT_STYLE, frame = null, drawings = HAND_SET_DRAWINGS } = {}) {
  if (!frame) return '';
  const look = HAND_STYLES[style] || HAND_STYLES[HAND_DEFAULT_STYLE];
  return drawings.map((drawing) => {
    const id = handSetElementId(side, drawing.id);
    const parts = handParts(side, { view: drawing.view, pose: drawing.pose, at: frame.at, scale: frame.scale });
    return `<g id="${id}" data-name="${esc(drawing.name)} (drawing)">${paintParts(id, parts, look, frame.scale)}</g>`;
  }).join('');
}

/** A pose id a drawing's own name points at, when it names one the hand knows. */
function poseIdForDrawing(child, taken) {
  const known = [...GENERATED_HAND_POSES, ...SUGGESTED_HAND_POSES, ...HAND_SET_DRAWINGS];
  const hints = [child.id, child.name].filter(Boolean).map((text) => poseIdFromName(text));
  let id = hints.find((hint) => known.some((pose) => pose.id === hint)) || hints.find((hint) => hint && hint !== 'pose') || 'drawing';
  let candidate = id, n = 2;
  while (taken.has(candidate)) candidate = `${id}${n++}`;
  taken.add(candidate);
  return candidate;
}

/**
 * An imported SVG's drawings as markup: each top-level piece the canvas
 * measured, wrapped so it is centred on the hand and no bigger than it.
 *
 * @param {{id?: string, name?: string, markup: string, bbox: {x,y,width,height}}[]} children
 * @param {{frame: object, flip?: boolean, taken?: Set<string>}} options `flip` mirrors every drawing, for a set drawn for the other hand
 * @returns {{markup: string, drawings: {id, name, elementId}[]}}
 */
export function importedHandSetMarkup(children = [], side = 'left', { frame, flip = false, taken = new Set() } = {}) {
  if (!frame) return { markup: '', drawings: [] };
  const radius = HAND_LOCAL_RADIUS * frame.scale;
  const drawings = [], pieces = [];
  for (const child of children) {
    if (!child?.markup || !child.bbox || !(Number(child.bbox.width) > 0) || !(Number(child.bbox.height) > 0)) continue;
    const id = poseIdForDrawing(child, taken);
    const elementId = handSetElementId(side, id);
    const k = (2 * radius) / Math.max(child.bbox.width, child.bbox.height);
    const cx = child.bbox.x + child.bbox.width / 2, cy = child.bbox.y + child.bbox.height / 2;
    const sx = flip ? -k : k;
    const wrap = `translate(${r1(frame.at.x - sx * cx)} ${r1(frame.at.y - k * cy)}) scale(${r1(sx)} ${r1(k)})`;
    const name = child.name || child.id || `Drawing ${drawings.length + 1}`;
    pieces.push(`<g id="${elementId}" data-name="${esc(name)} (drawing)"><g transform="${wrap}">${child.markup}</g></g>`);
    drawings.push({ id, name, elementId });
  }
  return { markup: pieces.join(''), drawings };
}

/**
 * Rig the drawings the canvas just appended: each becomes a pose that
 * cross-fades to it, carried by the hand, with its parameter.
 *
 * @param {object} state a draft document that already carries the drawings
 * @param {{drawings: {id, name, elementId?}[], frame: object}} options
 */
export function installHandSet(state, side, { drawings = [], frame = null } = {}) {
  const hand = state.hands?.[side];
  if (!hand?.element || !frame) return false;
  let added = 0;
  for (const drawing of drawings) {
    const elementId = drawing.elementId || handSetElementId(side, drawing.id);
    const element = state.elements?.[elementId];
    if (!element) continue;
    // Where the hand is, turned and sized as the hand is: the drawing stands
    // in for it, and the runtime carries both the same way.
    element.baseTransform = { ...(element.baseTransform || {}), ...frame.transform };
    state.hands = addHandPose(state.hands, side, { id: drawing.id, name: drawing.name, variant: elementId });
    const parameter = handPoseParameter(side, drawing.id);
    state.params[parameter] ||= { type: 'number', min: 0, max: 1, default: 0, value: 0 };
    for (const stored of Object.values(state.states || {})) if (!(parameter in stored)) stored[parameter] = 0;
    added += 1;
  }
  return added > 0;
}

/**
 * Append and rig a set as one document revision. `artwork` is what the canvas
 * returned after appending the markup; `options` the drawings and the frame
 * the markup was built with.
 */
export function addHandSetCommand(store, history, side, artwork, options = {}) {
  const current = store.getDocument();
  if (!HAND_SIDES.includes(side) || !current.hands?.[side]) return false;
  const candidate = structuredClone(current);
  Object.assign(candidate, structuredClone(artwork));
  if (!installHandSet(candidate, side, options)) return false;
  history?.snapshot();
  store.execute({
    type: 'hands/add-set', source: 'hands', domains: HAND_SET_DOMAINS,
    apply: (document) => {
      for (const field of ['svgMarkup', 'layers', 'layerMetadata', 'elements', 'hands', 'params', 'states']) document[field] = structuredClone(candidate[field]);
    }
  });
  return true;
}

/** Whether this hand already swaps between drawings. */
export const hasHandSet = (state = {}, side = 'left') => (state.hands?.[side]?.poses || []).some((pose) => pose.variant && state.elements?.[pose.variant]);
