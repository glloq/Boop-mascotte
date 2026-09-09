/**
 * Giving a hand its drawings (docs/HANDS_2D.md).
 *
 * ```text
 * before                        after
 * handLeft (g)                  handLeft (g)
 *  ├─ handLeftPalm    ─┐         ├─ handLeftPalm    (hidden) ─┐ kept until the
 *  ├─ handLeftRing     │ six      ├─ …                        ┘ author is happy
 *  ├─ …                │ parts    ├─ handLeftDraw-sideOpen   (g)
 *  └─ handLeftCuff    ─┘          ├─ handLeftDraw-palmOpen   (g)
 *     + ~200 shape keys           └─ handLeftDraw-frontFist  (g)  one visible
 * ```
 *
 * The conversion is an **action the author takes**, never something that
 * happens to a project on the way in. A file written before the refit opens
 * exactly as it did, keeps deforming, and is marked `legacyPseudo3D` so the
 * editor can offer the conversion and say what it will do. Nothing is
 * converted behind anybody's back.
 *
 * What the conversion has to get right is that the mascot goes on working:
 * the reactions, the clips and the expressions that raise `handLFist` are
 * rewritten to ask for the fist *drawing* instead, so a project that waved
 * still waves.
 *
 * Pure: the canvas appends the markup and hides the parts; this decides what
 * the markup is and what the rig says about it.
 */
import { DEFAULT_HAND_DRAWING, HAND_DRAWINGS, HAND_SIDES, handDrawingId, handSideLetter } from '../../../runtime/hand-vocabulary.js';
import {
  HAND_DEFAULT_STYLE, HAND_PART_IDS, HAND_REST_TILT, HAND_STYLES, handElementId, handPartId, handScale
} from '../sample/hand-artwork.js';
import {
  HANDS_UP_CLIP, HAND_WAVE_CLIP, handFacingParameter, handHiddenPoint, handPlacement, isGeneratedHand, setHandHidden
} from '../sample/hand-feature.js';
import { upsertShapeKey } from '../shape-keys/shape-key-model.js';
import { assignHand, normalizeHand } from './hand-model.js';
import { handSetFrame } from '../sample/hand-set.js';
import {
  GENERATED_HAND_DRAWINGS, STARTER_HAND_DRAWINGS,
  handSpriteAnimKeys, handSpriteAssets, handSpriteElementId, handSpriteParts, handSpritePartId, handSpriteSetMarkup
} from './hand-sprite-set.js';

/**
 * The hands a pair is drawn with.
 *
 * All three of them: an open hand seen from the side, an open palm and a
 * fist, each with its own animation. Three pictures a side is twenty-one
 * nodes a side — fewer than the five views of one pose the angle system
 * needed — and it is the whole catalogue, so the picker beside the face has
 * something to pick from the moment a mascot is drawn.
 */
export const TEMPLATE_HAND_DRAWINGS = Object.freeze([...STARTER_HAND_DRAWINGS]);

export const HAND_SPRITE_DOMAINS = Object.freeze(['artwork', 'layers', 'rig', 'hands', 'keyforms', 'animation', 'expressions', 'stateMachine']);

/** Whether this hand shows drawings rather than deforming. */
export const hasHandSprites = (state = {}, side = 'left') => Boolean(state?.hands?.[side]?.sprites);

/** Whether this hand still carries the pseudo-3D turn, and so has something to convert. */
export const isLegacyPseudo3DHand = (state = {}, side = 'left') =>
  Boolean(state?.hands?.[side]) && !hasHandSprites(state, side) && Boolean(state?.params?.[handFacingParameter(side)]);

/** The six parts a generated hand deforms, where they exist. */
export const legacyHandPartIds = (state = {}, side = 'left') =>
  HAND_PART_IDS.map((part) => handPartId(side, part)).filter((id) => state?.elements?.[id]);

/**
 * Where the drawings go: the middle of the hand and how big it is.
 *
 * The same frame a set of drawings always used (`handSetFrame`), so a drawing
 * lands exactly where the hand is, at the size the hand is, whether the
 * artwork is the generator's or the author's own.
 */
export const handSpriteFrame = (state, side, measure = () => null) => handSetFrame(state, side, measure);

/** The drawings for one hand, as markup to append **inside its group**. */
export function handSpritesMarkup(state = {}, side = 'left', { drawings = STARTER_HAND_DRAWINGS, frame = null, style = undefined, showing = DEFAULT_HAND_DRAWING } = {}) {
  if (!frame) return '';
  return handSpriteSetMarkup(side, { drawings, showing, at: frame.at, scale: frame.scale, style });
}

/** The parameters a 2D hand names: which picture, and how far its animation has played. */
export const handDrawingParameter = (side) => `hand${handSideLetter(side)}Drawing`;
export const handAnimParameter = (side) => `hand${handSideLetter(side)}Anim`;

/* ── Installing ────────────────────────────────────────────────────────────── */

const ensureParameter = (state, name, range) => {
  const { options, ...bounds } = range;
  state.params[name] ||= { type: 'number', ...bounds, default: range.default ?? 0, value: range.default ?? 0 };
  // A parameter whose value is a choice names its choices, so everything
  // downstream can ask for a hand by name rather than guess an index.
  if (options) state.params[name] = { ...state.params[name], ...bounds, options: [...options] };
  for (const stored of Object.values(state.states || {})) if (!(name in stored)) stored[name] = state.params[name].default;
  return state.params[name];
};

/**
 * Rig the drawings the canvas just appended.
 *
 * Each picture also gets its **own animation**: the shape keys that take it
 * from its rest drawing to what it does, driven by the hand's one animation
 * parameter. They live on that picture's own parts, so a picture that
 * animates sits happily beside one that does not.
 *
 * @param {object} state a draft document that already carries the drawings
 * @param {{drawings?: string[], frame: object, showing?: string}} options
 */
export function installHandSprites(state, side, { drawings: wanted = STARTER_HAND_DRAWINGS, frame = null, showing = null } = {}) {
  const hand = state?.hands?.[side];
  if (!hand?.element || !frame) return false;
  const pivot = [frame.at.x, frame.at.y];
  const drawings = handSpriteAssets(side, { drawings: wanted, pivot })
    .filter((asset) => state.elements?.[asset.element]);
  if (!drawings.length) return false;
  // A drawing rides inside the hand's group, so it carries no transform of its
  // own: the hand's reach, drift, turn and size are already on the group.
  for (const drawing of drawings) {
    const element = state.elements[drawing.element];
    element.baseTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: frame.at.x, pivotY: frame.at.y };
    // The markup marks every drawing but the first `opacity="0"`, so a page
    // does not flash all of them before the first frame. The rig must not keep
    // that: it is the runtime that says which drawing is showing, and a base
    // opacity of zero would multiply its answer away for ever.
    element.baseOpacity = 1;
  }
  // The palm is what a hand rests in: an open hand facing the viewer reads as a
  // hand at any angle, and these hang fingers-down. A set that does not draw it
  // rests in whatever it draws first.
  const rest = handDrawingId(showing, drawings) || handDrawingId(DEFAULT_HAND_DRAWING, drawings) || drawings[0].id;
  const anim = handAnimParameter(side);
  // Rebuilt, not appended to: a set that has just changed must not keep the
  // keys of a picture it no longer draws.
  const owned = new Set(drawings.map((drawing) => `${drawing.element}-anim-`));
  state.shapeKeys = (state.shapeKeys || []).filter((key) => ![...owned].some((prefix) => String(key?.id || '').startsWith(prefix)));
  for (const drawing of drawings) {
    const made = handSpriteAnimKeys(side, drawing.id, { at: frame.at, scale: frame.scale, parameter: anim });
    if (!made.ok) return false;
    // A shape key is a delta from an outline, so the part it deforms has to
    // carry the outline it was measured against -- the same capture the
    // deforming hand's parts always got.
    const rest = handSpriteParts(side, drawing.id, { at: frame.at, scale: frame.scale });
    for (const part of HAND_PART_IDS) {
      const element = state.elements?.[handSpritePartId(side, drawing.id, part)];
      if (element && rest?.paths[part]) element.restPath = rest.paths[part];
    }
    for (const key of made.keys) state.shapeKeys = upsertShapeKey(state.shapeKeys, key);
  }
  // Through `normalizeHand`, not around it: a hand's parameter names depend on
  // whether it has drawings -- `handLDrawing` exists only for a hand that does
  // -- so a set written straight onto the record would leave it pointing at
  // parameters it does not name.
  state.hands = {
    ...state.hands,
    [side]: normalizeHand({
      ...hand,
      sprites: { set: 'defaultCartoon', showing: rest, pivot, drawings },
      legacyPseudo3D: false
    }, side)
  };
  const names = drawings.map((drawing) => drawing.id);
  ensureParameter(state, handDrawingParameter(side), { min: 0, max: Math.max(0, names.length - 1), default: Math.max(0, names.indexOf(rest)), options: names });
  ensureParameter(state, anim, { min: 0, max: 1, default: 0 });
  return true;
}

/* ── Drawing a pair that never deforms ─────────────────────────────────────── */

/**
 * A pair of hands made of **drawings from the start**.
 *
 * The pair the editor used to draw was six paths a side and a wall of shape
 * keys over them, and converting it afterwards meant hiding most of what had
 * just been made. A new mascot has nothing to convert: its hands are three
 * pictures each, and no part of the pseudo-3D turn is ever built.
 *
 * The placement, the tilt, the size, the anchor and the hiding place are the
 * pair's own, unchanged (`handPlacement`, `setHandHidden`): where a floating
 * hand hangs is not what the refit is about.
 */
export function spriteHandsMarkup(state = {}, { drawings = TEMPLATE_HAND_DRAWINGS, style = HAND_DEFAULT_STYLE, measure = null, parent = null } = {}) {
  const placement = handPlacement(state, { measure, parent });
  const look = style && typeof style === 'object' ? style : (HAND_STYLES[style] ? style : HAND_DEFAULT_STYLE);
  const scale = handScale(placement.artboard);
  return HAND_SIDES.map((side) => `<g id="${handElementId(side)}" data-name="${side === 'right' ? 'Right hand' : 'Left hand'}">`
    + handSpriteSetMarkup(side, { drawings, at: placement.points[side], scale, style: look })
    + '</g>').join('');
}

/**
 * Rig the pair `spriteHandsMarkup` just drew.
 *
 * @param {object} state a draft document that already carries the artwork
 */
export function installSpriteHands(state, { drawings = TEMPLATE_HAND_DRAWINGS, measure = null, parent = null, hidden = true } = {}) {
  const placement = handPlacement(state, { parent, measure });
  const scale = handScale(placement.artboard);
  for (const side of HAND_SIDES) {
    const element = handElementId(side);
    if (!state.elements?.[element]) return false;
    const at = placement.points[side];
    const result = assignHand(state.hands, side, { element, parent: placement.parent, anchor: placement.anchors[side], reach: placement.reach });
    if (!result.ok) return false;
    state.hands = result.hands;
    for (const [name, parameter] of Object.entries(result.parameters)) {
      state.params[name] ||= structuredClone(parameter);
      for (const stored of Object.values(state.states || {})) if (!(name in stored)) stored[name] = parameter.default;
    }
    // Fingers down and thumbs inwards, at the mascot's own size, all of it on
    // the group -- so reach, drift and turn carry every drawing at once and a
    // swap between them cannot move the hand.
    Object.assign(state.elements[element].baseTransform,
      { pivotX: at.x, pivotY: at.y, rotation: HAND_REST_TILT[side], scaleX: placement.size, scaleY: placement.size });
    if (hidden) setHandHidden(state, side, true, { at, hidden: handHiddenPoint(side, placement) });
    if (!installHandSprites(state, side, { drawings, frame: { at, scale } })) return false;
  }
  // The clips the pair comes with. A wave is a rotation of an open hand, which
  // is exactly the principle: neither clip touches a drawing.
  for (const clip of [HAND_WAVE_CLIP, HANDS_UP_CLIP]) {
    if (state.animationClips.some((item) => item.id === clip.id)) continue;
    state.animationClips.push({ ...structuredClone(clip), tracks: Object.fromEntries(Object.entries(clip.tracks).filter(([name]) => name in state.params)) });
  }
  return true;
}

/** Draw and rig a pair of 2D hands as one document revision. */
export function addSpriteHandsCommand(store, history, artwork, options = {}) {
  const current = store.getDocument();
  if (current.hands?.left || current.hands?.right) return false;
  const candidate = structuredClone(current);
  Object.assign(candidate, structuredClone(artwork));
  if (!installSpriteHands(candidate, options)) return false;
  history?.snapshot();
  store.execute({
    type: 'hands/draw-drawn-pair', source: 'hands', domains: HAND_SPRITE_DOMAINS,
    apply: (document) => {
      for (const field of ['svgMarkup', 'layers', 'layerMetadata', 'elements', 'hands', 'params', 'states', 'shapeKeys', 'keyforms', 'animationClips', 'expressions']) {
        document[field] = structuredClone(candidate[field]);
      }
    }
  });
  return true;
}

/* ── Adding a drawing to a set ─────────────────────────────────────────────── */

/** The pictures a hand already has, and the ones the generator could draw for it. */
export function handSetDrawings(state = {}, side = 'left') {
  const drawn = new Set((state?.hands?.[side]?.sprites?.drawings || []).map((drawing) => drawing.id));
  return GENERATED_HAND_DRAWINGS.map((id) => ({ id, drawn: drawn.has(id) }));
}

/**
 * The markup for a picture this hand has not got, to append **inside its
 * group**.
 *
 * Empty when the hand already draws it, which is what makes pressing a picture
 * twice a no-op rather than a second drawing under the first.
 */
export function handDrawingMarkup(state = {}, side = 'left', drawing = DEFAULT_HAND_DRAWING, { frame = null, style = undefined } = {}) {
  const id = handDrawingId(drawing);
  if (!id || !frame || !hasHandSprites(state, side)) return '';
  if (handSetDrawings(state, side).some((item) => item.id === id && item.drawn)) return '';
  return handSpriteSetMarkup(side, { drawings: [id], showing: null, at: frame.at, scale: frame.scale, style });
}

/**
 * Add a picture to a hand that already has a set.
 *
 * The set is rebuilt over the union rather than appended to, so the drawings
 * stay in the catalogue's order and the parameter's range stays exactly the
 * count of what is drawn -- an index into a list is only ever as good as the
 * list it indexes.
 */
export function addHandSpriteDrawing(state, side, drawing, { frame = null } = {}) {
  const sprites = state?.hands?.[side]?.sprites;
  const id = handDrawingId(drawing);
  if (!sprites || !id || !frame) return false;
  const wanted = new Set([...sprites.drawings.map((item) => item.id), id]);
  const ordered = HAND_DRAWINGS.filter((item) => wanted.has(item.id)).map((item) => item.id);
  if (!installHandSprites(state, side, { drawings: ordered, frame, showing: sprites.showing })) return false;
  return (state.hands[side].sprites.drawings || []).some((item) => item.id === id);
}

/** Add a picture as one document revision, and show it. */
export function addHandDrawingCommand(store, history, side, drawing, artwork, options = {}) {
  const current = store.getDocument();
  const id = handDrawingId(drawing);
  if (!HAND_SIDES.includes(side) || !current.hands?.[side]?.sprites || !id) return false;
  const candidate = structuredClone(current);
  Object.assign(candidate, structuredClone(artwork));
  if (!addHandSpriteDrawing(candidate, side, id, options)) return false;
  history?.snapshot();
  store.execute({
    type: 'hands/add-drawing', source: 'hands', domains: HAND_SPRITE_DOMAINS,
    apply: (document) => {
      for (const field of ['svgMarkup', 'layers', 'layerMetadata', 'elements', 'hands', 'params', 'states', 'shapeKeys']) {
        document[field] = structuredClone(candidate[field]);
      }
    }
  });
  return true;
}

/** Where a picture sits in a hand's set, for the parameter that picks it. */
export function handDrawingIndex(state = {}, side = 'left', drawing = DEFAULT_HAND_DRAWING) {
  const drawn = (state?.hands?.[side]?.sprites?.drawings || []).map((item) => item.id);
  return drawn.indexOf(handDrawingId(drawing, drawn.map((id) => ({ id }))) || DEFAULT_HAND_DRAWING);
}

/* ── Retiring the deformation ──────────────────────────────────────────────── */

/**
 * Everything the pseudo-3D turn put on this hand's parts.
 *
 * The parts themselves are only **hidden**, never deleted: a conversion an
 * author can undo by making them visible again is one they can try. What goes
 * is what is measured on them and can no longer mean anything — the view keys,
 * the pose keys, the curls, the grid that gated them, and the two grids that
 * hid the thumb round the back. The keys on the *group* stay: the slide out
 * from behind the head is a transform of the whole hand, and the whole hand is
 * still there.
 */
export function removeLegacyHandDeformation(state, side = 'left') {
  const parts = new Set(legacyHandPartIds(state, side));
  if (!parts.size) return false;
  // The pose *records* go with them. A pose was a parameter that deformed the
  // parts; with the parts hidden it moves nothing, and a pose that moves
  // nothing is exactly what the validator is there to report. The drawings are
  // the poses now (`migrateHandPoseParameters` has already renamed whatever
  // asked for one).
  if (state.hands?.[side]?.poses?.length) state.hands = { ...state.hands, [side]: { ...state.hands[side], poses: [] } };
  const element = handElementId(side);
  state.shapeKeys = (state.shapeKeys || []).filter((key) => !parts.has(key?.target));
  state.keyforms = (state.keyforms || []).filter((keyform) => !parts.has(keyform?.target?.id));
  const live = new Set((state.shapeKeys || []).map((key) => key.id));
  state.keyforms = state.keyforms.filter((keyform) => keyform?.channel !== 'pathShape' || live.has(keyform.shapeKey));
  for (const id of parts) {
    const part = state.elements?.[id];
    if (part) part.baseOpacity = 0;
    state.layerMetadata = { ...(state.layerMetadata || {}), [id]: { ...(state.layerMetadata?.[id] || {}), visible: false } };
  }
  // The facing axis was the pseudo-3D turn's own parameter. Nothing reads an
  // angle any more, so its keys go with the deformation and the parameter goes
  // with the orphans `retireHandDeformation` sweeps up.
  state.keyforms = state.keyforms.filter((keyform) => !String(keyform?.id || '').startsWith(`${element}-facing-`));
  return true;
}

/* ── Migration ─────────────────────────────────────────────────────────────── */

/** The picture an old hand pose was: `relax` → `sideOpen`, `spread` → `palmOpen`, `fist` → `frontFist`. */
export const migratedHandPose = (poseId) => handDrawingId(poseId);

/** The parameters this hand's old poses were raised by. */
export const handPoseParameterNames = (state = {}, side = 'left') =>
  (state?.hands?.[side]?.poses || []).map((pose) => pose.parameter).filter(Boolean);

/**
 * What a hand's old per-pose parameters become.
 *
 * ```text
 * handLFist = 1   →   handLDrawing = <index of 'frontFist'>
 * handLSpread = 1 →   handLDrawing = <index of 'palmOpen'>
 * handLOk = 1     →   (nothing: no picture of it, and no honest stand-in)
 * ```
 *
 * A pose parameter is a weight and a drawing index is a choice, so the rewrite
 * is a threshold: raised means chosen. That is the discrete interpolation a
 * choice is keyframed with anyway, which is why nothing is lost by it.
 */
export function handPoseParameterMap(state = {}, side = 'left') {
  const hand = state?.hands?.[side];
  const drawings = (hand?.sprites?.drawings || []).map((drawing) => drawing.id);
  const map = new Map();
  for (const pose of hand?.poses || []) {
    const id = handDrawingId(pose.id, drawings.map((item) => ({ id: item })));
    const index = drawings.indexOf(id);
    if (id && index >= 0 && pose.parameter) map.set(pose.parameter, index);
  }
  return map;
}

const RAISED = 0.5;

/**
 * Rewrite everything that raised an old pose parameter so it asks for the
 * drawing instead: the clips, the expressions and the stored states.
 *
 * A mascot that waved has a Wave clip, a reaction that plays it and an
 * expression that brings the hands out. None of them knows about drawings, and
 * none of them has to: what they raise is renamed, and they go on working.
 */
export function migrateHandPoseParameters(state, side = 'left') {
  const map = handPoseParameterMap(state, side);
  if (!map.size) return false;
  const target = handDrawingParameter(side);
  const rest = Number(state.params?.[target]?.default) || 0;
  let changed = false;
  for (const clip of state.animationClips || []) {
    for (const [name, keys] of Object.entries(clip.tracks || {})) {
      if (!map.has(name)) continue;
      const chosen = map.get(name);
      // A step track: a picture is chosen, never blended halfway into.
      clip.tracks[target] = (Array.isArray(keys) ? keys : []).map((key) => ({ time: key.time, value: Number(key.value) >= RAISED ? chosen : rest, easing: 'step' }));
      delete clip.tracks[name];
      changed = true;
    }
  }
  for (const expression of state.expressions || []) {
    for (const [name, value] of Object.entries(expression.controls || {})) {
      if (!map.has(name)) continue;
      if (Number(value) >= RAISED) expression.controls[target] = map.get(name);
      delete expression.controls[name];
      changed = true;
    }
  }
  for (const stored of Object.values(state.states || {})) {
    for (const [name, value] of Object.entries(stored)) {
      if (!map.has(name)) continue;
      if (Number(value) >= RAISED) stored[target] = map.get(name);
      delete stored[name];
      changed = true;
    }
  }
  // The parameters themselves are left standing: the pose grids that gate the
  // deformation still name them, and they are only retired once those are
  // gone. `retireHandDeformation` is the order that works.
  return changed;
}

/** Whether anything in the rig still names this parameter. */
export function parameterIsUsed(state = {}, name = '') {
  if (!name) return false;
  const mentions = (expression) => typeof expression === 'string' && new RegExp(`\\b${name}\\b`).test(expression);
  for (const keyform of state.keyforms || []) if ((keyform?.axes || []).some((axis) => axis?.parameter === name)) return true;
  for (const key of state.shapeKeys || []) {
    const driver = key?.driver;
    if (driver && (driver.parameter === name || mentions(driver.expression))) return true;
  }
  for (const element of Object.values(state.elements || {})) {
    for (const binding of Object.values(element?.bindings || {})) if (mentions(binding?.expression)) return true;
  }
  for (const clip of state.animationClips || []) if (clip?.tracks && name in clip.tracks) return true;
  for (const expression of state.expressions || []) if (expression?.controls && name in expression.controls) return true;
  for (const behavior of state.behaviors || []) if (behavior?.param === name || behavior?.parameter === name) return true;
  for (const hand of Object.values(state.hands || {})) {
    if (Object.values(hand?.parameters || {}).includes(name)) return true;
    if ((hand?.poses || []).some((pose) => pose.parameter === name)) return true;
  }
  return false;
}

/**
 * The whole retirement, in the one order that works.
 *
 * ```text
 * 1  rename what asked for a pose        needs the pose records
 * 2  hide the parts, drop their keys     clears the pose records and the grids
 * 3  drop the parameters nothing names   needs the grids gone
 * ```
 *
 * Each step reads what the one before it is about to remove, which is why they
 * are three steps and not one pass. The facing axis goes out with them: a hand
 * that shows pictures has no angle to read.
 */
export function retireHandDeformation(state, side = 'left') {
  const orphans = [...handPoseParameterNames(state, side), handFacingParameter(side)];
  migrateHandPoseParameters(state, side);
  const retired = removeLegacyHandDeformation(state, side);
  // An author's own binding on `handLFist` is a use like any other: deleting
  // the parameter under it would break their rig to tidy ours.
  for (const name of orphans) if (!parameterIsUsed(state, name)) {
    delete state.params?.[name];
    for (const stored of Object.values(state.states || {})) delete stored[name];
  }
  return retired;
}

/* ── The command ───────────────────────────────────────────────────────────── */

/**
 * Convert one hand to drawings, as one document revision: rig what the canvas
 * appended, retire what deformed, and rename what asked for a pose.
 *
 * @param {object} artwork what the canvas returned after appending the drawings
 */
export function addHandSpritesCommand(store, history, side, artwork, options = {}) {
  const current = store.getDocument();
  if (!HAND_SIDES.includes(side) || !current.hands?.[side]) return false;
  const candidate = structuredClone(current);
  Object.assign(candidate, structuredClone(artwork));
  if (!installHandSprites(candidate, side, options)) return false;
  if (options.retireLegacy !== false) retireHandDeformation(candidate, side);
  history?.snapshot();
  store.execute({
    type: 'hands/use-drawings', source: 'hands', domains: HAND_SPRITE_DOMAINS,
    apply: (document) => {
      for (const field of ['svgMarkup', 'layers', 'layerMetadata', 'elements', 'hands', 'shapeKeys', 'keyforms', 'params', 'states', 'animationClips', 'expressions']) {
        document[field] = structuredClone(candidate[field]);
      }
    }
  });
  return true;
}

/** Every picture the generator can draw, for the panel's "add a drawing" list. */
export { GENERATED_HAND_DRAWINGS, STARTER_HAND_DRAWINGS, handSpriteElementId };
export { HAND_DRAWINGS, isGeneratedHand };
