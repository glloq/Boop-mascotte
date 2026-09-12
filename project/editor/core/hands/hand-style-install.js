/**
 * Giving a hand its styles, and taking the old machinery off it
 * (docs/HAND_STYLES.md).
 *
 * ```text
 * before                          after
 * handLeft (g)                    handLeft (g)
 *  ├─ handLeftPalm    ─┐ six       ├─ handLeftPalm    (hidden) ─┐ kept until the
 *  ├─ handLeftRing     │ parts     ├─ …                         ┘ author is happy
 *  ├─ …                │           ├─ handLeftStyle-relaxed   (g)
 *  └─ handLeftCuff    ─┘           ├─ handLeftStyle-open      (g)
 *     + ~200 shape keys            └─ …                       one visible
 * ```
 *
 * A drawing is a **child of the hand group**: a group of named layers -- a
 * palm, the fingers, a thumb -- read from a file (docs/HAND_STYLES.md, "A
 * gesture is a file"). Nothing inside one is rigged; the hand's own transform
 * carries all of it and a swap is one opacity on the drawing's group, so
 * nothing here has to know where the hand is, what it is anchored to, how far
 * it has turned, or how many layers the drawing happens to have.
 *
 * The conversion of an older project is an **action the author takes**, never
 * something that happens to a file on the way in. What it has to get right is
 * that the mascot goes on working: the reactions, the clips and the
 * expressions that raised `handLFist` are rewritten to ask for the fist
 * *style* instead, so a project that waved still waves.
 *
 * Pure: the canvas appends the markup and hides the parts; this decides what
 * the markup is and what the rig says about it.
 */
import { HAND_SIDES, handSideLetter } from '../../../runtime/hand-vocabulary.js';
import {
  DEFAULT_HAND_LOOK, HAND_LOOKS, defaultHandStyle, handElementId, handStyleElementId, handStyleId,
  handStyleIds, handStyleLibrary, handStyleSetMarkup
} from './hand-style-art.js';
import {
  HAND_CLIPS, HAND_CLIP_STYLES, HAND_REST_TILT, handFrame, handHiddenPoint, handPlacement, handScale, handShowParameter, setHandHidden
} from '../sample/hand-feature.js';
import { assignHand, normalizeHand } from './hand-model.js';

/**
 * The gestures a pair is drawn with: `null` meaning **whatever the set draws**.
 *
 * It was a frozen list once, which is what made a ninth gesture a code change.
 * The set is files now (`core/hands/hand-set.js`), so the answer is read rather
 * than kept — and shipping all of them rather than one is what makes the picker
 * beside the face a picker from the moment a mascot is drawn.
 */
export const TEMPLATE_HAND_STYLES = null;

export const HAND_STYLE_DOMAINS = Object.freeze(['artwork', 'layers', 'rig', 'hands', 'keyforms', 'animation', 'expressions', 'stateMachine']);

/** Whether this hand shows styles rather than deforming. */
export const hasHandStyles = (state = {}, side = 'left') => Boolean(state?.hands?.[side]?.styles);

/** The parameter that says which style a hand shows. */
export const handStyleParameter = (side) => `hand${handSideLetter(side)}Style`;

/* ── What an older project still carries ───────────────────────────────────── */

/** The parameter the pseudo-3D turn was slid along; `null` on a hand that never had one. */
export const handFacingParameter = (side) => `hand${handSideLetter(side)}Facing`;

/** Whether this hand still carries the pseudo-3D turn, and so has something to convert. */
export const isLegacyPseudo3DHand = (state = {}, side = 'left') =>
  Boolean(state?.hands?.[side]) && !hasHandStyles(state, side) && Boolean(state?.params?.[handFacingParameter(side)]);

/** The six parts a hand drawn before the refit deforms, where they exist. */
const LEGACY_PART_IDS = Object.freeze(['palm', 'ring', 'middle', 'index', 'thumb', 'cuff']);
const legacyPartId = (side, part) => `${handElementId(side)}${part.charAt(0).toUpperCase()}${part.slice(1)}`;
export const legacyHandPartIds = (state = {}, side = 'left') =>
  LEGACY_PART_IDS.map((part) => legacyPartId(side, part)).filter((id) => state?.elements?.[id]);

/** Where the drawings go: the middle of the hand and how big it is. */
export const handStyleFrame = (state, side, measure = () => null) => handFrame(state, side, measure);

/** The drawings for one hand, as markup to append **inside its group**. */
export function handStylesMarkup(state = {}, side = 'left', { styles = TEMPLATE_HAND_STYLES, frame = null, look = undefined, showing = null } = {}) {
  if (!frame) return '';
  return handStyleSetMarkup(side, { styles, showing, at: frame.at, scale: frame.scale, look });
}

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
 * There is nothing to rig **on** a drawing: it carries no keys, no parameters
 * and no transform of its own, because the hand's group already has all of
 * those. What is written is the hand's library, the style parameter that
 * indexes it, and one base transform per drawing that says "you are exactly
 * where the hand is".
 *
 * @param {object} state a draft document that already carries the drawings
 * @param {{styles?: string[], frame: object, showing?: string}} options
 */
export function installHandStyles(state, side, { styles: wanted = TEMPLATE_HAND_STYLES, frame = null, showing = null } = {}) {
  const hand = state?.hands?.[side];
  if (!hand?.element || !frame) return false;
  const pivot = [frame.at.x, frame.at.y];
  const library = handStyleLibrary(side, { styles: wanted }).filter((entry) => state.elements?.[entry.element]);
  if (!library.length) return false;
  for (const entry of library) {
    const element = state.elements[entry.element];
    // A drawing rides inside the hand's group, so it carries no transform of
    // its own: the hand's reach, drift, turn and size are already on the group.
    element.baseTransform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, pivotX: frame.at.x, pivotY: frame.at.y };
    // The markup marks every drawing but the first `opacity="0"`, so a page
    // does not flash all of them before the first frame. The rig must not keep
    // that: it is the runtime that says which style is showing, and a base
    // opacity of zero would multiply its answer away for ever.
    element.baseOpacity = 1;
  }
  const rest = handStyleId(showing, library) || handStyleId(defaultHandStyle(), library) || library[0].id;
  // Through `normalizeHand`, not around it: a hand's parameter names depend on
  // whether it has styles, so a library written straight onto the record would
  // leave it pointing at a parameter it does not name.
  state.hands = {
    ...state.hands,
    [side]: normalizeHand({ ...hand, styles: { set: 'defaultCartoon', showing: rest, pivot, library }, legacyPseudo3D: false }, side)
  };
  const names = library.map((entry) => entry.id);
  ensureParameter(state, handStyleParameter(side), {
    min: 0, max: Math.max(0, names.length - 1), default: Math.max(0, names.indexOf(rest)), options: names
  });
  return true;
}

/** Where a style sits in a hand's library, for the parameter that picks it. */
export function handStyleIndex(state = {}, side = 'left', style = null) {
  const library = state?.hands?.[side]?.styles?.library || [];
  return library.findIndex((entry) => entry.id === handStyleId(style, library));
}

/**
 * The style tracks a pair's own clips want, written once the library exists.
 *
 * `easing: 'step'` because a style is a choice: it is taken, never blended
 * into (docs/HAND_STYLES.md, "Timeline").
 */
function writeClipStyleTracks(state, side) {
  const parameter = handStyleParameter(side);
  if (!state.params?.[parameter]) return;
  const rest = Number(state.params[parameter].default) || 0;
  const show = handShowParameter(side);
  for (const [clipId, sides] of Object.entries(HAND_CLIP_STYLES)) {
    const style = sides[side];
    const clip = (state.animationClips || []).find((item) => item.id === clipId);
    if (!style || !clip || clip.tracks?.[parameter]) continue;
    const index = handStyleIndex(state, side, style);
    if (index < 0 || index === rest) continue;
    const end = Math.max(0, Number(clip.duration) || 0);
    // Swapped while the hand is behind the head, and swapped back once it is
    // away again: the change of drawing happens where nobody can see it
    // (docs/HAND_STYLES.md, "Changing style mid-animation"). Without a reveal
    // to hide behind it simply holds for the length of the clip.
    const reveal = clip.tracks?.[show] || [];
    const out = reveal.find((key) => Number(key.value) >= 0.5)?.time;
    const back = [...reveal].reverse().find((key) => Number(key.value) < 0.5 && Number(key.time) > 0)?.time;
    clip.tracks = { ...(clip.tracks || {}), [parameter]: [
      { time: 0, value: rest, easing: 'step' },
      { time: Math.max(0, Number(out) || 0), value: index, easing: 'step' },
      { time: back === undefined ? end : Math.min(end, Number(back)), value: rest, easing: 'step' }
    ].filter((key, at, all) => at === 0 || key.time > all[at - 1].time) };
  }
}

/* ── Drawing a pair that never deforms ─────────────────────────────────────── */

/**
 * A pair of hands made of **drawings from the start**.
 *
 * There is nothing to convert: the hands are six pictures each, and no part of
 * the pseudo-3D turn is ever built. The placement, the tilt, the size, the
 * anchor and the hiding place are the pair's own, unchanged — where a floating
 * hand hangs is not what this is about.
 */
export function styleHandsMarkup(state = {}, { styles = TEMPLATE_HAND_STYLES, look = DEFAULT_HAND_LOOK, measure = null, parent = null } = {}) {
  const placement = handPlacement(state, { measure, parent });
  const paint = look && typeof look === 'object' ? look : (HAND_LOOKS[look] ? look : DEFAULT_HAND_LOOK);
  const scale = handScale(placement.artboard);
  return HAND_SIDES.map((side) => `<g id="${handElementId(side)}" data-name="${side === 'right' ? 'Right hand' : 'Left hand'}">`
    + handStyleSetMarkup(side, { styles, at: placement.points[side], scale, look: paint })
    + '</g>').join('');
}

/**
 * Rig the pair `styleHandsMarkup` just drew.
 *
 * @param {object} state a draft document that already carries the artwork
 */
export function installStyleHands(state, { styles = TEMPLATE_HAND_STYLES, measure = null, parent = null, hidden = true } = {}) {
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
    // change of style cannot move the hand.
    Object.assign(state.elements[element].baseTransform,
      { pivotX: at.x, pivotY: at.y, rotation: HAND_REST_TILT[side], scaleX: placement.size, scaleY: placement.size });
    if (hidden) setHandHidden(state, side, true, { at, hidden: handHiddenPoint(side, placement) });
    if (!installHandStyles(state, side, { styles, frame: { at, scale } })) return false;
  }
  // The clips the pair comes with. A wave is a rotation of an open hand, which
  // is exactly the principle: neither clip deforms anything.
  for (const clip of HAND_CLIPS) {
    if (state.animationClips.some((item) => item.id === clip.id)) continue;
    state.animationClips.push({ ...structuredClone(clip), tracks: Object.fromEntries(Object.entries(clip.tracks).filter(([name]) => name in state.params)) });
  }
  for (const side of HAND_SIDES) writeClipStyleTracks(state, side);
  return true;
}

/** Draw and rig a pair of hands as one document revision. */
export function addStyleHandsCommand(store, history, artwork, options = {}) {
  const current = store.getDocument();
  if (current.hands?.left || current.hands?.right) return false;
  const candidate = structuredClone(current);
  Object.assign(candidate, structuredClone(artwork));
  if (!installStyleHands(candidate, options)) return false;
  history?.snapshot();
  store.execute({
    type: 'hands/draw-pair', source: 'hands', domains: HAND_STYLE_DOMAINS,
    apply: (document) => {
      for (const field of ['svgMarkup', 'layers', 'layerMetadata', 'elements', 'hands', 'params', 'states', 'shapeKeys', 'keyforms', 'animationClips', 'expressions']) {
        document[field] = structuredClone(candidate[field]);
      }
    }
  });
  return true;
}

/* ── Adding a style to a hand ──────────────────────────────────────────────── */

/** The styles a hand already has, and the ones the library could add. */
export function handStyleOffers(state = {}, side = 'left') {
  const drawn = new Set((state?.hands?.[side]?.styles?.library || []).map((entry) => entry.id));
  return handStyleIds().map((id) => ({ id, drawn: drawn.has(id) }));
}

/**
 * The markup for a style this hand has not got, to append **inside its group**.
 *
 * Empty when the hand already draws it, which is what makes pressing a style
 * twice a no-op rather than a second drawing under the first.
 */
export function handStyleMarkupFor(state = {}, side = 'left', style = null, { frame = null, look = undefined } = {}) {
  const id = handStyleId(style);
  if (!id || !frame || !hasHandStyles(state, side)) return '';
  if (handStyleOffers(state, side).some((item) => item.id === id && item.drawn)) return '';
  return handStyleSetMarkup(side, { styles: [id], showing: null, at: frame.at, scale: frame.scale, look });
}

/**
 * Add a style to a hand that already has a library.
 *
 * The library is rebuilt over the union rather than appended to, so the styles
 * stay in the registry's order and the parameter's range stays exactly the
 * count of what is drawn -- an index into a list is only ever as good as the
 * list it indexes.
 */
export function addHandStyle(state, side, style, { frame = null } = {}) {
  const styles = state?.hands?.[side]?.styles;
  const id = handStyleId(style);
  if (!styles || !id || !frame) return false;
  const wanted = new Set([...styles.library.map((entry) => entry.id), id]);
  const ordered = handStyleIds().filter((item) => wanted.has(item));
  if (!installHandStyles(state, side, { styles: ordered, frame, showing: styles.showing })) return false;
  return (state.hands[side].styles.library || []).some((entry) => entry.id === id);
}

/** Add a style as one document revision. */
export function addHandStyleCommand(store, history, side, style, artwork, options = {}) {
  const current = store.getDocument();
  const id = handStyleId(style);
  if (!HAND_SIDES.includes(side) || !current.hands?.[side]?.styles || !id) return false;
  const candidate = structuredClone(current);
  Object.assign(candidate, structuredClone(artwork));
  if (!addHandStyle(candidate, side, id, options)) return false;
  history?.snapshot();
  store.execute({
    type: 'hands/add-style', source: 'hands', domains: HAND_STYLE_DOMAINS,
    apply: (document) => {
      for (const field of ['svgMarkup', 'layers', 'layerMetadata', 'elements', 'hands', 'params', 'states', 'shapeKeys']) {
        document[field] = structuredClone(candidate[field]);
      }
    }
  });
  return true;
}

/* ── Retiring the deformation (docs/HAND_STYLES.md, "Migration") ───────────── */

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
  // parts; with the parts hidden it moves nothing. The styles are the poses now
  // (`migrateHandPoseParameters` has already renamed whatever asked for one).
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

/** The style an old hand pose was: `relax` → `relaxed`, `spread` → `open`, `fist` → `fist`. */
export const migratedHandPose = (poseId) => handStyleId(poseId);

/** The parameters this hand's old poses were raised by. */
export const handPoseParameterNames = (state = {}, side = 'left') =>
  (state?.hands?.[side]?.poses || []).map((pose) => pose.parameter).filter(Boolean);

/**
 * The parameters a hand's own little animation used to be played by.
 *
 * `handLAnim` slid a drawing through its own rig -- a fist closing, a thumb
 * going up. Nothing has an internal rig any more, so the parameter drives
 * nothing and the keys it drove are gone with the drawing they deformed
 * (docs/HAND_STYLES.md, "Deprecated fields").
 */
export const handAnimParameter = (side) => `hand${handSideLetter(side)}Anim`;

/**
 * Take a hand's own animation off it: the keys it played, the parameter that
 * played them, and the tracks and expressions that raised it.
 *
 * The **drawing itself is untouched**: what goes is the deformation over it.
 * A style is what it is drawn as, and it stays drawn as that.
 */
export function neutralizeHandAnimation(state, side = 'left') {
  const parameter = handAnimParameter(side);
  const owned = new Set((state?.hands?.[side]?.styles?.library || []).map((entry) => entry.element));
  const before = (state.shapeKeys || []).length;
  state.shapeKeys = (state.shapeKeys || []).filter((key) => {
    if (key?.driver?.parameter === parameter) return false;
    // The keys a drawing's own animation put on its own parts, named for it.
    return !(typeof key?.id === 'string' && [...owned].some((element) => key.id.startsWith(`${element}-anim-`)));
  });
  const dropped = before !== state.shapeKeys.length;
  const live = new Set(state.shapeKeys.map((key) => key.id));
  state.keyforms = (state.keyforms || []).filter((keyform) => keyform?.channel !== 'pathShape' || live.has(keyform.shapeKey));
  state.keyforms = state.keyforms.filter((keyform) => !(keyform?.axes || []).some((axis) => axis?.parameter === parameter));
  for (const clip of state.animationClips || []) if (clip.tracks?.[parameter]) delete clip.tracks[parameter];
  for (const expression of state.expressions || []) if (expression.controls?.[parameter] !== undefined) delete expression.controls[parameter];
  const had = Boolean(state.params?.[parameter]);
  delete state.params?.[parameter];
  for (const stored of Object.values(state.states || {})) delete stored[parameter];
  return dropped || had;
}

const RAISED = 0.5;

/**
 * What a hand's old per-pose parameters become.
 *
 * ```text
 * handLFist = 1   →   handLStyle = <index of 'fist'>
 * handLSpread = 1 →   handLStyle = <index of 'open'>
 * handLOk = 1     →   (nothing: no style of it, and no honest stand-in)
 * ```
 *
 * A pose parameter is a weight and a style index is a choice, so the rewrite is
 * a threshold: raised means chosen. That is the discrete interpolation a choice
 * is keyframed with anyway, which is why nothing is lost by it.
 */
export function handPoseParameterMap(state = {}, side = 'left') {
  const hand = state?.hands?.[side];
  const library = hand?.styles?.library || [];
  const map = new Map();
  for (const pose of hand?.poses || []) {
    const id = handStyleId(pose.id, library);
    const index = library.findIndex((entry) => entry.id === id);
    if (id && index >= 0 && pose.parameter) map.set(pose.parameter, index);
  }
  return map;
}

/**
 * Rewrite everything that raised an old pose parameter so it asks for the style
 * instead: the clips, the expressions and the stored states.
 *
 * A mascot that waved has a Wave clip, a reaction that plays it and an
 * expression that brings the hands out. None of them knows about styles, and
 * none of them has to: what they raise is renamed, and they go on working.
 */
export function migrateHandPoseParameters(state, side = 'left') {
  const map = handPoseParameterMap(state, side);
  if (!map.size) return false;
  const target = handStyleParameter(side);
  const rest = Number(state.params?.[target]?.default) || 0;
  let changed = false;
  for (const clip of state.animationClips || []) {
    for (const [name, keys] of Object.entries(clip.tracks || {})) {
      if (!map.has(name)) continue;
      const chosen = map.get(name);
      // A step track: a style is chosen, never blended halfway into.
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

/** The per-digit and whole-hand parameters the deforming pair carried. */
const LEGACY_HAND_PARAMETERS = (side) => {
  const letter = handSideLetter(side);
  return [
    handFacingParameter(side), `hand${letter}Grip`, `hand${letter}Flip`,
    ...['thumb', 'index', 'middle', 'ring'].map((digit) => `hand${letter}${digit.charAt(0).toUpperCase()}${digit.slice(1)}`)
  ];
};

/**
 * The whole retirement, in the one order that works.
 *
 * ```text
 * 1  rename what asked for a pose        needs the pose records
 * 2  take the drawings' own animation off needs the library
 * 3  hide the parts, drop their keys     clears the pose records and the grids
 * 4  drop the parameters nothing names   needs the grids gone
 * ```
 *
 * Each step reads what the one before it is about to remove, which is why they
 * are four steps and not one pass. The facing axis, the digit curls, the grip
 * and the flip go out with them: a hand that shows a drawing has no angle to
 * read and no finger to bend.
 */
export function retireHandDeformation(state, side = 'left') {
  const orphans = [...handPoseParameterNames(state, side), ...LEGACY_HAND_PARAMETERS(side), handAnimParameter(side)];
  migrateHandPoseParameters(state, side);
  neutralizeHandAnimation(state, side);
  const retired = removeLegacyHandDeformation(state, side);
  // An author's own binding on `handLFist` is a use like any other: deleting
  // the parameter under it would break their rig to tidy ours.
  for (const name of orphans) if (!parameterIsUsed(state, name)) {
    delete state.params?.[name];
    for (const stored of Object.values(state.states || {})) delete stored[name];
  }
  return retired;
}

/**
 * Convert one hand to styles, as one document revision: rig what the canvas
 * appended, retire what deformed, and rename what asked for a pose.
 *
 * @param {object} artwork what the canvas returned after appending the drawings
 */
export function addHandStylesCommand(store, history, side, artwork, options = {}) {
  const current = store.getDocument();
  if (!HAND_SIDES.includes(side) || !current.hands?.[side]) return false;
  const candidate = structuredClone(current);
  Object.assign(candidate, structuredClone(artwork));
  if (!installHandStyles(candidate, side, options)) return false;
  if (options.retireLegacy !== false) retireHandDeformation(candidate, side);
  history?.snapshot();
  store.execute({
    type: 'hands/use-styles', source: 'hands', domains: HAND_STYLE_DOMAINS,
    apply: (document) => {
      for (const field of ['svgMarkup', 'layers', 'layerMetadata', 'elements', 'hands', 'shapeKeys', 'keyforms', 'params', 'states', 'animationClips', 'expressions']) {
        document[field] = structuredClone(candidate[field]);
      }
    }
  });
  return true;
}

export { handStyleIds, handStyleElementId };
