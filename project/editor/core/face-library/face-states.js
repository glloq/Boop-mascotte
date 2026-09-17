/**
 * The named states an eye and a mouth can be in (docs/FACE_SVG_STATES.md).
 *
 * ```text
 *  one drawing  +  semantic controls  +  optional corrective  =  every state
 * ```
 *
 * A *state* here is data and almost nothing else: a handful of values for the
 * movements the face already has. `closed` is `eyeOpen 0`; `happyClosed` is
 * `eyeOpen 0` with the lid arced upwards; `AE` is an open, slightly widened,
 * barely rounded mouth. None of them is a second drawing, a second rig or a
 * second timeline — which is the whole point, because eight eye states and
 * nine visemes drawn as files would be seventeen SVGs to keep in step with
 * every change to the face.
 *
 * Where the controls genuinely cannot hold a shape, a **corrective** does
 * (`face-correctives.js`): an additive shape key applied after the structural
 * deformation, optional everywhere, and absent in every project that predates
 * this. A state with no corrective is the plain composition of its controls.
 *
 * Pure data and pure resolution. Nothing here writes to a document; the two
 * catalogues sit in the core face library rather than in a panel so the pose
 * chips, the authoring panel, the starter kit and the tests all read one list.
 */
import { REQUIRED_VISEME_KEYS, VISEME_KEYS, visemeExpressionId, visemeKey } from '../../../runtime/visemes.js';

export { VISEME_KEYS, REQUIRED_VISEME_KEYS, visemeExpressionId, visemeKey };

const state = (id, name, description, controls) => Object.freeze({ id, name, description, controls: Object.freeze({ ...controls }) });

/**
 * The eight states one pair of eyes can be in.
 *
 * Read down the `eyeOpen` column and the set is obvious: the lids travel, and
 * the other two columns say *how* rather than *how far*. `eyeSquint` narrows
 * from below, which is a different face from a lid half way down; `eyeCurve`
 * bends the line the lids meet on, which is the whole difference between a
 * happy shut eye, a flat shut eye and a tired one.
 *
 * ```text
 *            eyeOpen  eyeSquint  eyeCurve
 *  neutral      1         0          0
 *  wide         1         0          0      (the pupils do the widening)
 *  halfOpen     .5        0          0
 *  closed       0         0          0
 *  squint       .45      .85         0
 *  happyClosed  0         0         +1
 *  tired        .38      .3        -.65
 *  suspicious   .5       .7        -.25
 * ```
 *
 * **The gaze is not here, and never will be.** `lookX` / `lookY` aim the
 * pupils and these shape the lids, so *happy + look left* and *half open +
 * look right* are compositions rather than states somebody has to author
 * (docs/FACE_SVG_STATES.md, "The gaze is orthogonal").
 */
export const EYE_POSE_PRESETS = Object.freeze([
  state('neutral', 'Neutral', 'Open, as drawn.', { eyeOpen: 1, eyeSquint: 0, eyeCurve: 0 }),
  state('wide', 'Wide', 'Fully open with the pupils dilated.', { eyeOpen: 1, eyeSquint: 0, eyeCurve: 0, pupilScale: 1.4 }),
  state('halfOpen', 'Half open', 'Lids half way down.', { eyeOpen: 0.5, eyeSquint: 0, eyeCurve: 0 }),
  state('closed', 'Closed', 'Shut, on a flat seam.', { eyeOpen: 0, eyeSquint: 0, eyeCurve: 0 }),
  state('squint', 'Squint', 'Narrowed from below, not half shut.', { eyeOpen: 0.45, eyeSquint: 0.85, eyeCurve: 0 }),
  state('happyClosed', 'Happy closed', 'Shut, arcing upwards.', { eyeOpen: 0, eyeSquint: 0, eyeCurve: 1 }),
  state('tired', 'Tired', 'Heavy, drooping lids.', { eyeOpen: 0.38, eyeSquint: 0.3, eyeCurve: -0.65 }),
  state('suspicious', 'Suspicious', 'Narrow and level, brows low.', { eyeOpen: 0.5, eyeSquint: 0.7, eyeCurve: -0.25, browRaise: -0.4 })
]);

export const eyePoseById = (id) => EYE_POSE_PRESETS.find((pose) => pose.id === id) || null;

/**
 * The visemes, as values for the mouth's own movements.
 *
 * Three numbers carry almost all of it. `mouthOpen` is the aperture,
 * `mouthWidth` how far the corners are pulled apart or in, and `mouthRound`
 * how far the lips pucker — which is the axis that separates `AE` from `OO`
 * and the reason that control exists at all (docs/VISEME_SYSTEM.md).
 *
 * `smile` appears only where the sound really does shape the corners (`EE`
 * pulls them back), because a viseme that set `smile` would fight the
 * expression it is spoken through. That is the rule the whole speech layer
 * turns on: **a viseme says as little as it can**, so that what it leaves
 * alone stays the face's.
 *
 * `teeth` and `tongue` are the two exceptions worth making — `FV` is the lower
 * lip meeting the upper teeth and `L` is a tongue against them, and neither
 * reads at all without the artwork behind the lips showing.
 */
export const VISEME_PRESETS = Object.freeze([
  state('REST', 'Rest', 'At rest, lips together.', { mouthOpen: 0, mouthWidth: 0, mouthRound: 0 }),
  state('MBP', 'M · B · P', 'Lips pressed shut.', { mouthOpen: 0, mouthWidth: -0.1, mouthRound: 0.1, mouthLock: 0.85 }),
  state('FV', 'F · V', 'Lower lip against the upper teeth.', { mouthOpen: 0.16, mouthWidth: 0.1, mouthRound: 0, teeth: 0.7 }),
  state('AE', 'A · E', 'Open wide.', { mouthOpen: 0.75, mouthWidth: 0.3, mouthRound: 0.15, teeth: 0.4 }),
  state('EE', 'E · I', 'Wide and shallow, corners back.', { mouthOpen: 0.3, mouthWidth: 0.85, mouthRound: 0, smile: 0.25, teeth: 0.55 }),
  state('OH', 'O · AW', 'Open and rounded.', { mouthOpen: 0.6, mouthWidth: -0.35, mouthRound: 0.7, teeth: 0.2 }),
  state('OO', 'OO · U', 'Small and strongly rounded.', { mouthOpen: 0.32, mouthWidth: -0.7, mouthRound: 1 }),
  state('L', 'L · N · D · T', 'Tongue up against the upper teeth.', { mouthOpen: 0.42, mouthWidth: 0.15, mouthRound: 0, teeth: 0.5, tongue: 0.8, tongueY: -0.55 }),
  state('WQ', 'W · QU', 'Rounded and opening.', { mouthOpen: 0.45, mouthWidth: -0.6, mouthRound: 0.9 })
]);

export const visemeById = (key) => VISEME_PRESETS.find((item) => item.id === visemeKey(key)) || null;

const number = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
/**
 * A side offset is a subtraction, and a subtraction of two tenths leaves a
 * tail of binary noise behind it (`1.4 - 1` is `0.3999999999999999`). Rounded
 * where the value leaves the resolver, for the same reason `roundTo` exists in
 * the runtime: a pose that should read 0.4 has to read 0.4, in a panel and in
 * a saved project alike.
 */
const round = (value) => Math.round(number(value) * 1e5) / 1e5;

/**
 * One state against one project: the controls it has, and the ones it wants.
 *
 * The same `{ controls, missing, usable }` shape every other preset catalogue
 * in the editor reports, so a face without `mouthRound` can still say `AE`
 * — a little less roundly — and the panel can say which movement would make it
 * exact rather than refusing the state outright.
 */
function resolveState(document, source) {
  const params = document?.params || {};
  const controls = {};
  const missing = [];
  for (const [name, value] of Object.entries(source?.controls || {})) {
    const parameter = params[name];
    if (!parameter) { missing.push(name); continue; }
    controls[name] = clamp(number(value), number(parameter.min, -Infinity), number(parameter.max, Infinity));
  }
  return { id: source.id, name: source.name, description: source.description, controls, missing, usable: Object.keys(controls).length > 0 };
}

/** One eye state, resolved against this project. */
export function resolveEyePose(document, id) {
  const source = typeof id === 'string' ? eyePoseById(id) : id;
  if (!source) throw new Error(`Unknown eye state "${id}".`);
  return resolveState(document, source);
}

/** One viseme, resolved against this project. */
export function resolveViseme(document, key) {
  const source = typeof key === 'string' || typeof key !== 'object' ? visemeById(key) : key;
  if (!source) throw new Error(`Unknown viseme "${key}".`);
  return resolveState(document, source);
}

/** Every eye state for this project, in catalogue order. */
export const eyePoseAvailability = (document) => EYE_POSE_PRESETS.map((pose) => resolveState(document, pose));

/** Every viseme for this project, in mouth order. */
export const visemeAvailability = (document) => VISEME_PRESETS.map((item) => resolveState(document, item));

/**
 * One eye state on one eye, or on both.
 *
 * The shared movement carries the state and the **side offset** carries the
 * disagreement, which is the mechanism the eyes have always used for a wink
 * (docs/FACE_CONTROL_RIG.md, §5). So `eyePoseValues(doc, 'closed', 'left')` is
 * not a second way to close an eye: it is `eyeOpenLeft` taking the left eye
 * from wherever the shared control has put it down to 0, with the right eye
 * left exactly where it was.
 *
 * That is what makes a wink a composition — *neutral* on the pair, *closed* on
 * one side — rather than a state of its own that no gaze or expression could
 * then be added to.
 *
 * @param {object} document
 * @param {string} id one of `EYE_POSE_PRESETS`
 * @param {'left'|'right'|null} side `null` for both eyes
 * @returns {Record<string, number>} values to write, and nothing else
 */
export function eyePoseValues(document, id, side = null) {
  const resolved = resolveEyePose(document, id);
  if (!side) return { ...resolved.controls };
  const suffix = side === 'left' ? 'Left' : 'Right';
  const params = document?.params || {};
  const values = {};
  for (const [name, target] of Object.entries(resolved.controls)) {
    const offset = `${name}${suffix}`;
    const parameter = params[offset];
    // No offset parameter means this movement does not take sides on this rig:
    // the pair moves, which is the behaviour a rig that cannot wink has always
    // had, rather than nothing happening at all.
    if (!parameter) { values[name] = target; continue; }
    const shared = number(document?.params?.[name]?.default, 0);
    values[offset] = round(clamp(target - shared, number(parameter.min, -Infinity), number(parameter.max, Infinity)));
  }
  return values;
}

/**
 * A face, an eye state and a viseme, composed the way the rig composes them.
 *
 * ```text
 *  neutral  →  expression  →  eye state  →  viseme × blend
 * ```
 *
 * Every layer after the first is a **delta from neutral**, added, which is
 * exactly `composeExpressionParams` and exactly `mixParameters`' additive
 * mode — the same arithmetic, spelled out here so an authoring panel can show
 * the result of a combination without running a preview frame. It is not a
 * second evaluator: the frame is still compiled by `compileRigFrame` from the
 * values this returns.
 *
 * The order is the mixer's own, and it matters: the viseme is last because
 * speech happens *to* a face rather than instead of one, so `happy + AE` keeps
 * happy's smile and adds AE's opening. Nothing here ever returns the face to
 * neutral.
 *
 * @param {object} document
 * @param {object} options
 * @param {Record<string, number>} [options.base] where to start; the parameter
 *        defaults when absent
 * @param {Record<string, number>|null} [options.expression] a face's controls
 * @param {string|null} [options.eyePose] an eye state id
 * @param {'left'|'right'|null} [options.eyeSide] which eye the state is for
 * @param {string|null} [options.viseme] a viseme key
 * @param {string|null} [options.previousViseme] the viseme being left
 * @param {number} [options.blend] 0 → `previousViseme`, 1 → `viseme`
 * @returns {Record<string, number>} the composed parameter values
 */
export function composeFaceState(document, {
  base = null, expression = null, eyePose = null, eyeSide = null,
  viseme = null, previousViseme = null, blend = 1
} = {}) {
  const params = document?.params || {};
  const neutral = (name) => number(params[name]?.default, 0);
  const result = {};
  for (const name of Object.keys(params)) result[name] = number(base?.[name], neutral(name));
  const add = (values, weight = 1) => {
    if (!values || weight === 0) return;
    for (const [name, target] of Object.entries(values)) {
      if (!params[name]) continue;
      result[name] = number(result[name], neutral(name)) + weight * (number(target, neutral(name)) - neutral(name));
    }
  };
  add(expression ? resolveState(document, { id: 'expression', name: '', description: '', controls: expression }).controls : null);
  if (eyePose) add(eyePoseValues(document, eyePose, eyeSide));
  // Two visemes at once is a transition, and a transition is the two deltas
  // live together -- never one pose replaced by another through neutral.
  const weight = clamp(number(blend, 1), 0, 1);
  if (previousViseme && viseme && visemeKey(previousViseme) === visemeKey(viseme)) add(resolveViseme(document, viseme).controls, 1);
  else {
    if (previousViseme && 1 - weight > 0) add(resolveViseme(document, previousViseme).controls, 1 - weight);
    if (viseme && weight > 0) add(resolveViseme(document, viseme).controls, weight);
  }
  for (const [name, parameter] of Object.entries(params)) {
    if (Number.isFinite(Number(parameter?.min)) && Number.isFinite(Number(parameter?.max))) {
      result[name] = clamp(result[name], Number(parameter.min), Number(parameter.max));
    }
    result[name] = round(result[name]);
  }
  return result;
}
