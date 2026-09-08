/**
 * Giving a hand its drawings (docs/HANDS_2D.md, PHASES 11, 40-41).
 *
 * ```text
 * before                        after
 * handLeft (g)                  handLeft (g)
 *  ├─ handLeftPalm    ─┐         ├─ handLeftPalm    (hidden) ─┐ kept until the
 *  ├─ handLeftRing     │ six      ├─ …                        ┘ author is happy
 *  ├─ …                │ parts    ├─ handLeftDraw-relaxed-sideLeft   (g)
 *  └─ handLeftCuff    ─┘          ├─ handLeftDraw-relaxed-front      (g)
 *     + ~200 shape keys           └─ …                              one visible
 * ```
 *
 * The conversion is an **action the author takes**, never something that
 * happens to a project on the way in. A file written before the refit opens
 * exactly as it did, keeps deforming, and is marked `legacyPseudo3D` so the
 * editor can offer the conversion and say what it will do. Nothing is
 * converted behind anybody's back (PHASE 41).
 *
 * What the conversion has to get right is that the mascot goes on working:
 * the reactions, the clips and the expressions that raise `handLFist` are
 * rewritten to ask for the fist *drawing* instead, so a project that waved
 * still waves (PHASE 40).
 *
 * Pure: the canvas appends the markup and hides the parts; this decides what
 * the markup is and what the rig says about it.
 */
import {
  DEFAULT_HAND_POSE, DEFAULT_HAND_VIEW, HAND_POSES, HAND_SIDES, HAND_VIEWS, handPoseId, handViewId
} from '../../../runtime/hand-vocabulary.js';
import { DEFAULT_HAND_VIEW_MODE } from '../../../runtime/hand-view-select.js';
import {
  HAND_DEFAULT_STYLE, HAND_PART_IDS, HAND_REST_TILT, HAND_STYLES, handElementId, handPartId, handScale
} from '../sample/hand-artwork.js';
import {
  HANDS_UP_CLIP, HAND_WAVE_CLIP, handFacingParameter, handHiddenPoint, handPlacement, isGeneratedHand, setHandHidden
} from '../sample/hand-feature.js';
import { assignHand } from './hand-model.js';
import { handSetFrame } from '../sample/hand-set.js';
import {
  GENERATED_SPRITE_POSES, HAND_SPRITE_VIEWS, STARTER_SPRITE_POSES,
  handSpriteAssets, handSpriteElementId, handSpriteSetMarkup
} from './hand-sprite-set.js';

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
export function handSpritesMarkup(state = {}, side = 'left', { poses = STARTER_SPRITE_POSES, views = HAND_SPRITE_VIEWS, frame = null, style = undefined, showing = DEFAULT_HAND_VIEW } = {}) {
  if (!frame) return '';
  return handSpriteSetMarkup(side, { poses, views, showing, at: frame.at, scale: frame.scale, style });
}

/* ── Installing ────────────────────────────────────────────────────────────── */

const ensureParameter = (state, name, range) => {
  state.params[name] ||= { type: 'number', ...range, default: range.default ?? 0, value: range.default ?? 0 };
  for (const stored of Object.values(state.states || {})) if (!(name in stored)) stored[name] = state.params[name].default;
  return state.params[name];
};

/**
 * Rig the drawings the canvas just appended.
 *
 * @param {object} state a draft document that already carries the drawings
 * @param {{poses?: string[], views?: string[], frame: object, viewMode?: string, showing?: string}} options
 */
export function installHandSprites(state, side, { poses = STARTER_SPRITE_POSES, views = HAND_SPRITE_VIEWS, frame = null, viewMode = DEFAULT_HAND_VIEW_MODE, showing = DEFAULT_HAND_VIEW } = {}) {
  const hand = state?.hands?.[side];
  if (!hand?.element || !frame) return false;
  const pivot = [frame.at.x, frame.at.y];
  const drawings = handSpriteAssets(side, { poses, views, pivot })
    .filter((asset) => state.elements?.[asset.element]);
  if (!drawings.length) return false;
  // A drawing rides inside the hand's group, so it carries no transform of its
  // own: the hand's reach, drift, turn and size are already on the group.
  for (const drawing of drawings) {
    const element = state.elements[drawing.element];
    element.baseTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: frame.at.x, pivotY: frame.at.y };
  }
  const drawn = [...new Set(drawings.map((drawing) => drawing.pose))];
  const restPose = handPoseId(poses[0]) || DEFAULT_HAND_POSE;
  const restView = handViewId(showing) || DEFAULT_HAND_VIEW;
  state.hands = {
    ...state.hands,
    [side]: {
      ...hand,
      sprites: { set: 'defaultCartoon', pose: restPose, view: restView, face: 'palm', viewMode, pivot, drawings },
      legacyPseudo3D: false
    }
  };
  const capital = side === 'right' ? 'R' : 'L';
  ensureParameter(state, `hand${capital}Pose`, { min: 0, max: Math.max(0, drawn.length - 1), default: Math.max(0, drawn.indexOf(restPose)) });
  ensureParameter(state, `hand${capital}View`, { min: 0, max: HAND_VIEWS.length - 1, default: HAND_VIEWS.findIndex((view) => view.id === restView) });
  ensureParameter(state, `hand${capital}Facing`, { min: -1, max: 1, default: 0 });
  return true;
}

/* ── Drawing a pair that never deforms (PHASES 11, 25) ─────────────────────── */

/**
 * A pair of hands made of **drawings from the start**.
 *
 * The pair the editor used to draw was six paths a side and a wall of shape
 * keys over them, and converting it afterwards meant hiding most of what had
 * just been made. A new mascot has nothing to convert: its hands are five
 * drawings each, and no part of the pseudo-3D turn is ever built.
 *
 * The placement, the tilt, the size, the anchor and the hiding place are the
 * pair's own, unchanged (`handPlacement`, `setHandHidden`): where a floating
 * hand hangs is not what the refit is about.
 */
export function spriteHandsMarkup(state = {}, { poses = STARTER_SPRITE_POSES, views = HAND_SPRITE_VIEWS, style = HAND_DEFAULT_STYLE, measure = null, parent = null } = {}) {
  const placement = handPlacement(state, { measure, parent });
  const look = style && typeof style === 'object' ? style : (HAND_STYLES[style] ? style : HAND_DEFAULT_STYLE);
  const scale = handScale(placement.artboard);
  return HAND_SIDES.map((side) => `<g id="${handElementId(side)}" data-name="${side === 'right' ? 'Right hand' : 'Left hand'}">`
    + handSpriteSetMarkup(side, { poses, views, at: placement.points[side], scale, style: look })
    + '</g>').join('');
}

/**
 * Rig the pair `spriteHandsMarkup` just drew.
 *
 * @param {object} state a draft document that already carries the artwork
 */
export function installSpriteHands(state, { poses = STARTER_SPRITE_POSES, views = HAND_SPRITE_VIEWS, measure = null, parent = null, hidden = true, viewMode = DEFAULT_HAND_VIEW_MODE } = {}) {
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
    if (!installHandSprites(state, side, { poses, views, viewMode, frame: { at, scale } })) return false;
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
      for (const field of ['svgMarkup', 'layers', 'layerMetadata', 'elements', 'hands', 'params', 'states', 'keyforms', 'animationClips', 'expressions']) {
        document[field] = structuredClone(candidate[field]);
      }
    }
  });
  return true;
}

/* ── Retiring the deformation (PHASES 11, 50) ──────────────────────────────── */

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
  // The facing axis is the pseudo-3D turn's own parameter; the 2D hand reads
  // it as an orientation instead, so it is kept and its keys are not.
  state.keyforms = state.keyforms.filter((keyform) => !String(keyform?.id || '').startsWith(`${element}-facing-`));
  return true;
}

/* ── Migration (PHASE 40) ──────────────────────────────────────────────────── */

/** The 2D pose an old hand pose was: `relax` → `relaxed`, `spread` → `open`, `stop` → `open`. */
export const migratedHandPose = (poseId) => handPoseId(poseId);

/**
 * What a hand's old per-pose parameters become.
 *
 * ```text
 * handLFist = 1   →   handLPose = <index of 'fist'>
 * handLSpread = 1 →   handLPose = <index of 'open'>
 * handLOk = 1     →   (nothing: no drawing of it, and no honest stand-in)
 * ```
 *
 * A pose parameter is a weight and a pose index is a choice, so the rewrite is
 * a threshold: raised means chosen. That is the discrete interpolation a pose
 * is keyframed with anyway (PHASE 32), which is why nothing is lost by it.
 */
/** The parameters this hand's old poses were raised by. */
export const handPoseParameterNames = (state = {}, side = 'left') =>
  (state?.hands?.[side]?.poses || []).map((pose) => pose.parameter).filter(Boolean);

export function handPoseParameterMap(state = {}, side = 'left') {
  const hand = state?.hands?.[side];
  const poses = [...new Set((hand?.sprites?.drawings || []).map((drawing) => drawing.pose))];
  const map = new Map();
  for (const pose of hand?.poses || []) {
    const id = migratedHandPose(pose.id);
    const index = poses.indexOf(id);
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
  const capital = side === 'right' ? 'R' : 'L';
  const target = `hand${capital}Pose`;
  const rest = Number(state.params?.[target]?.default) || 0;
  let changed = false;
  for (const clip of state.animationClips || []) {
    for (const [name, keys] of Object.entries(clip.tracks || {})) {
      if (!map.has(name)) continue;
      const chosen = map.get(name);
      // A step track: a pose is chosen, never blended halfway into.
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
 * are three steps and not one pass.
 */
export function retireHandDeformation(state, side = 'left') {
  const orphans = handPoseParameterNames(state, side);
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

/** Every pose the generator can draw, for the panel's "add a pose" list. */
export { GENERATED_SPRITE_POSES, HAND_SPRITE_VIEWS, STARTER_SPRITE_POSES, handSpriteElementId };
export { HAND_POSES, HAND_VIEWS, isGeneratedHand };
