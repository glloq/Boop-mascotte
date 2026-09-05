export const RIG_SCHEMA_VERSION = 4;
export const BINDING_PROPERTIES = ['translateX', 'translateY', 'rotation', 'scaleX', 'scaleY', 'opacity'];
export const CURVES = ['linear', 'easeIn', 'easeOut', 'easeInOut'];

import { finite, clamp } from './numeric.js';
export { finite, clamp } from './numeric.js';

// Keyforms (docs/KEYFORM_ENGINE.md) live in their own module so the maths can be
// unit-tested without the engine, but they are part of the runtime surface.
import { compileKeyforms, normalizeKeyforms, evaluateCompiledKeyform } from './keyforms.js';
import { shapeKeyIndex, shapeKeyWeight, evaluateShapeTarget, normalizeShapeKeys } from './shape-keys.js';
import { normalizeHands, evaluateHands, handMotionParameters, HAND_SIDES } from './hands.js';
import { mixParameters } from './mixer.js';
import { createWeightBlender } from './transitions.js';
import { normalizeDeformers, compileDeformerMatrices } from './deformers.js';
import { normalizeParallax, parallaxOffset, clampDepth, depthBand, DEFAULT_PARALLAX } from './depth.js';
import { createDrawOrder } from './draw-order.js';
import { normalizeFollowers, createFollowerGroup } from './followers.js';
// The control rig's solvers (docs/FACE_CONTROL_RIG.md). They sit between the
// mixer and `compileRigFrame`, and they never write back into the parameters
// an author keyed -- that is the whole point of the effective layer.
import { createControlRig } from './effective-params.js';
import { normalizeWarps, normalizeWarpGrid, compileWarpTarget, warpDisplacement, weightWarpGrid } from './warp-grid.js';
// Pins: the structural layer under the controls (docs/FACE_CONTROL_RIG.md).
import { compilePinTarget, normalizeRigPins, pinDisplacement, pinOffsets, pinsFor } from './rig-pins.js';
// Constraints keep the rig's geometry true; holds put one thing on another,
// after the artwork has been deformed (docs/FACE_CONTROL_RIG.md).
import { hasRigConstraints, normalizeRigConstraints, solveRigConstraints } from './rig-constraints.js';
import { normalizeRigAttachments, normalizeRigHolds, solveRigHolds } from './rig-attachments.js';
export {
  normalizeWarp, normalizeWarps, normalizeWarpGrid, createWarpGrid, compileWarpTarget,
  warpDisplacement, applyWarp, isWarpGridMoved, locateInGrid, samplePosition, weightWarpGrid,
  normalizeWarpSize, WARP_GRID_SIZES, MIN_WARP_GRID, MAX_WARP_GRID
} from './warp-grid.js';

const warpCache = new WeakMap();

/** Compile a rig's warps once: parse each path and locate its points in the grid. */
export function warpIndex(records, elements) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const cached = warpCache.get(records);
  if (cached && cached.elements === elements) return cached.index;
  const index = new Map();
  for (const warp of normalizeWarps({ warps: records })) {
    const restPath = elements?.[warp.target]?.restPath;
    if (typeof restPath !== 'string' || !restPath.trim()) continue;
    try { index.set(warp.target, { warp, target: compileWarpTarget(restPath, warp.grid) }); } catch { /* reported by validation */ }
  }
  warpCache.set(records, { elements, index });
  return index.size ? index : null;
}
export {
  normalizeParallax, parallaxOffset, depthBand, depthBands, depthOrder, clampDepth,
  DEFAULT_PARALLAX, DEPTH_BANDS
} from './depth.js';
export { createDrawOrder } from './draw-order.js';
export {
  RIG_PIN_TYPES, PIN_FALLOFFS, PIN_FALLOFF_PRESETS, normalizeRigPin, normalizeRigPins,
  pinFalloff, pinDistance, pinWeightAt, compilePinTarget, pinOffsets, pinMotion, constrainPinOffset, pinDisplacement, applyPins, pinInfluence, pinsFor
} from './rig-pins.js';
export { pinDisplacementAt } from './rig-pins.js';
export {
  RIG_CONSTRAINT_TYPES, RIG_CONSTRAINT_LABELS, normalizeRigConstraint, normalizeRigConstraints,
  hasRigConstraints, solveRigConstraints
} from './rig-constraints.js';
export {
  ATTACHMENT_SPACES, normalizeRigAttachment, normalizeRigAttachments,
  normalizeRigHold, normalizeRigHolds, attachmentPoint, attachmentModel, solveRigHolds
} from './rig-attachments.js';
export {
  createControlRig, applyControlRig, eyelidFollowAmount,
  GAZE_TARGET_PARAMS, GAZE_EYE_PARAMS, GAZE_HEAD_PARAMS
} from './effective-params.js';
export {
  DEFAULT_GAZE_SOLVER, normalizeGazeSolver, gazeSolverActive,
  solveGaze, solveGazeAxis, createGazeFollower
} from './gaze-solver.js';
export { normalizeFollower, normalizeFollowers, createFollowerGroup, DEFAULT_FOLLOWER_AMOUNT, DEFAULT_FOLLOWER_INERTIA } from './followers.js';
import { transformToMatrix, multiplyMatrix, matrixToString, isIdentityMatrix } from './transform-2d.js';
export { normalizeDeformer, normalizeDeformers, compileDeformerMatrices, deformerIssues, deformerMatrixFor } from './deformers.js';
export { transformToMatrix, multiplyMatrix, applyMatrix, matrixToString, isIdentityMatrix, IDENTITY_MATRIX } from './transform-2d.js';

const pinCache = new WeakMap();

/**
 * Compile a rig's pins once: group them by the artwork they hold, and work out
 * how much each point of that artwork follows each of them.
 *
 * The weights depend on where the pins are and what the shape is, and neither
 * changes per frame — so this is the whole of the expensive part, and a running
 * mascot only ever multiplies and adds (docs/FACE_CONTROL_RIG.md).
 */
export function pinIndex(records, elements) {
  if (!Array.isArray(records) || records.length === 0) return null;
  // The cache is consulted *before* the records are normalized: normalizing is
  // an allocation per pin, and a running mascot hands over the same array every
  // frame (docs/RUNTIME_PERFORMANCE.md).
  const cached = pinCache.get(records);
  if (cached && cached.elements === elements) return cached.index;
  const list = normalizeRigPins({ rigPins: records });
  if (!list.length) return null;
  const index = new Map();
  for (const target of new Set(list.map((pin) => pin.target))) {
    const restPath = elements?.[target]?.restPath;
    if (typeof restPath !== 'string' || !restPath.trim()) continue;
    const pins = pinsFor(list, target);
    try { index.set(target, { pins, target: compilePinTarget(restPath, pins) }); } catch { /* reported by validation */ }
  }
  const resolved = index.size ? index : null;
  if (records && typeof records === 'object') pinCache.set(records, { elements, index: resolved });
  return resolved;
}

const extraTargetCache = new WeakMap();
const NO_TARGETS = Object.freeze([]);

/**
 * The elements whose path has to be rebuilt even though nothing shaped them: a
 * warped outline, a pinned mouth. Cached because the list is a property of the
 * rig and building a fresh array per frame would miss the shape-key cache
 * every time (docs/RUNTIME_PERFORMANCE.md).
 */
function displacedTargets(warps, pins) {
  if (!warps && !pins) return NO_TARGETS;
  const key = warps || pins;
  const cached = extraTargetCache.get(key);
  if (cached && cached.warps === warps && cached.pins === pins) return cached.list;
  const list = [...new Set([...(warps ? warps.keys() : []), ...(pins ? pins.keys() : [])])];
  extraTargetCache.set(key, { warps, pins, list });
  return list;
}

/**
 * Two offsets on the same numeric vector, added.
 *
 * A pinned mouth can still be warped and still carry shape keys, and none of
 * the three has to know about the others.
 */
function combineDisplacement(target, first, second) {
  if (!first) return second || null;
  if (!second) return first;
  const out = target.combined || (target.combined = new Float64Array(target.rest.length));
  for (let index = 0; index < out.length; index += 1) {
    out[index] = (index < first.length ? first[index] : 0) + (index < second.length ? second[index] : 0);
  }
  return out;
}

const constraintCache = new WeakMap();
const attachmentCache = new WeakMap();
const holdCache = new WeakMap();

/**
 * Normalize a rig's records once, keyed on the array the rig keeps.
 *
 * The engine normalizes at construction and hands the result over, but
 * `compileRigFrame` is a public entry point that a caller may hand raw records
 * to — and doing that per frame would allocate one object per record per frame,
 * which is exactly what the performance contract forbids
 * (docs/RUNTIME_PERFORMANCE.md). Normalizing a normalized record is a no-op, so
 * this is safe either way.
 */
function cachedList(cache, records, normalize) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const cached = cache.get(records);
  if (cached) return cached;
  const list = normalize(records);
  cache.set(records, list);
  return list;
}

const deformerCache = new WeakMap();

/** Normalize a rig's deformer list once; the matrices themselves are per-frame. */
export function deformerList(records) {
  if (!Array.isArray(records) || records.length === 0) return null;
  const cached = deformerCache.get(records);
  if (cached) return cached;
  const list = normalizeDeformers({ deformers: records });
  deformerCache.set(records, list);
  return list.length ? list : null;
}
export { mixParameters, orderLayers, parameterNeutral, MIXER_ORDER, MIX_MODES } from './mixer.js';
export { createWeightBlender, createParameterTransition, DEFAULT_TRANSITION_EASING } from './transitions.js';
import { createInertiaGroup } from './inertia.js';
export {
  normalizeHands, normalizeHand, normalizeHandPose, normalizeHandInertia, evaluateHands,
  handOffset, softenReach, anchorDrift, handMotionParameters, HAND_SIDES
} from './hands.js';
export { createSpringFollower, createInertiaGroup, DEFAULT_INERTIA } from './inertia.js';
export { applyElementTransform, inverseElementTransform, unrotateElementPoint, rotateAround, angleAround } from './transform-2d.js';
export {
  normalizeShapeKey, normalizeShapeKeys, normalizeShapeDriver, shapeDeltaFromPaths,
  applyShapeDelta, compileShapeKeys, shapeKeyIndex, shapeKeyWeight, evaluateShapeTarget,
  SHAPE_DRIVER_MODES
} from './shape-keys.js';
export { parsePath, canParsePath, pathSignature, pathsCompatible, serializePath, mapPathValues, PathParseError } from './path-vector.js';
export {
  compileKeyform, compileKeyforms, evaluateKeyform, evaluateCompiledKeyform,
  normalizeKeyform, normalizeKeyforms, keyformChannelNeutral, interpolate1D, interpolate2D,
  KEYFORM_CHANNELS, KEYFORM_CHANNEL_NEUTRAL, KEYFORM_EXTRAPOLATIONS
} from './keyforms.js';

/**
 * Channels whose keyform output adds to the binding result. The rest multiply.
 * `depth` adds to the element's authored depth for the same reason `translateX`
 * adds to its rest position: a pose records a difference, not a destination.
 */
export const ADDITIVE_KEYFORM_CHANNELS = Object.freeze(['translateX', 'translateY', 'rotation', 'depth']);

const keyformIndexCache = new WeakMap();
const EMPTY_KEYFORM_INDEX = new Map();

/**
 * Group keyforms by target element, compiling them the first time an array is
 * seen. The rig keeps the same array across frames, so a running mascot
 * compiles once and then only reads (docs/RUNTIME_PERFORMANCE.md).
 */
export function keyformIndex(records) {
  if (!Array.isArray(records) || records.length === 0) return EMPTY_KEYFORM_INDEX;
  const cached = keyformIndexCache.get(records);
  if (cached) return cached;
  const index = new Map();
  for (const compiled of compileKeyforms(records)) {
    const list = index.get(compiled.targetId);
    if (list) list.push(compiled); else index.set(compiled.targetId, [compiled]);
  }
  keyformIndexCache.set(records, index);
  return index;
}

const expressionCache = new Map();
const EXPRESSION_CACHE_LIMIT = 512;

// Kept in this module deliberately: runtime.js is the public, standalone export.
// Editor code imports the same functions through behaviors.js, which only re-exports
// these definitions, so preview and exported mascots cannot drift apart.
export function normalizeBehaviors(rig = {}) {
  if (Array.isArray(rig.behaviors)) return rig.behaviors.map(normalizeBehavior);
  const legacy = rig.runtimeConfig || {}, result = [];
  if (legacy.blink) result.push(normalizeBehavior({ type: 'blink', parameter: 'eyeOpen' }));
  if (Number(legacy.idleMotion) > 0) result.push(normalizeBehavior({ type: 'oscillator', name: 'Idle sway', parameter: 'headY', amplitude: legacy.idleMotion, frequency: 0.3 }));
  return result;
}

/** Behaviour types the runtime knows. `drift` is the V2 cartoon idle primitive. */
export const BEHAVIOR_TYPES = Object.freeze(['blink', 'randomIdle', 'oscillator', 'drift']);

export function normalizeBehavior(source = {}) {
  const type = BEHAVIOR_TYPES.includes(source.type) ? source.type : 'oscillator';
  return { id: source.id || `${type}-${Math.random().toString(36).slice(2, 8)}`, type,
    name: source.name || ({ blink: 'Blink', randomIdle: 'Random idle', oscillator: 'Oscillator', drift: 'Drift' }[type]), enabled: source.enabled !== false,
    // Drift: how long a move takes, and how long it rests before the next one.
    travelMin: Math.max(.01, finite(source.travelMin, .8)), travelMax: Math.max(.01, finite(source.travelMax, 1.6)),
    doubleChance: clamp(finite(source.doubleChance, 0), 0, 1),
    parameter: source.parameter || (type === 'blink' ? 'eyeOpen' : 'headY'), amplitude: finite(source.amplitude, .05), offset: finite(source.offset, 0),
    frequency: Math.max(0, finite(source.frequency ?? source.speed, .3)), waveform: 'sine', intervalMin: Math.max(0, finite(source.intervalMin, 2)),
    intervalMax: Math.max(0, finite(source.intervalMax, 6)), duration: Math.max(.01, finite(source.duration, .12)), closedValue: finite(source.closedValue, 0),
    min: finite(source.min, -.2), max: finite(source.max, .2) };
}

export function composeBehaviorParams(base, behaviors, time, runtime = {}) {
  const result = { ...base };
  for (const behavior of behaviors || []) {
    if (!behavior.enabled || !(behavior.parameter in result)) continue;
    // Per-behaviour results when the controller provides them; the older
    // shared fields remain the fallback so existing rigs are unaffected.
    const contribution = runtime.contributions?.[behavior.id];
    if (behavior.type === 'oscillator') result[behavior.parameter] += behavior.offset + Math.sin(time * Math.PI * 2 * behavior.frequency) * behavior.amplitude;
    if (behavior.type === 'blink') {
      const closed = runtime.closed ? runtime.closed[behavior.id] : runtime.blinkActive;
      // Never fight an expression that is already closing the eyes.
      if (closed) result[behavior.parameter] = Math.min(finite(result[behavior.parameter], 1), behavior.closedValue);
    }
    if (behavior.type === 'randomIdle') {
      const value = Number.isFinite(contribution) ? contribution : runtime.randomValue;
      if (Number.isFinite(value)) result[behavior.parameter] += value;
    }
    if (behavior.type === 'drift' && Number.isFinite(contribution)) result[behavior.parameter] += contribution;
  }
  return result;
}

/** Stateful scheduler shared by editor preview and the standalone runtime. */
export function createBehaviorController({ random = Math.random } = {}) {
  const states = new Map();
  const span = (min, max) => {
    const low = Math.min(min, max), high = Math.max(min, max);
    return low + random() * (high - low);
  };
  const delay = (behavior) => span(behavior.intervalMin, behavior.intervalMax);
  return {
    evaluate(behaviors, now) {
      let blinkActive = false, randomValue;
      const contributions = {}, closed = {};
      const liveIds = new Set((behaviors || []).map((behavior) => behavior.id));
      for (const id of states.keys()) if (!liveIds.has(id)) states.delete(id);
      for (const behavior of behaviors || []) {
        if (!behavior.enabled || !['blink', 'randomIdle', 'drift'].includes(behavior.type)) continue;
        let state = states.get(behavior.id);
        if (!state) {
          state = { next: now + delay(behavior), blinkUntil: -1, randomValue: 0, pending: 0, from: 0, to: 0, started: now, travel: 0 };
          states.set(behavior.id, state);
        }
        if (now >= state.next) {
          if (behavior.type === 'blink') {
            state.blinkUntil = now + behavior.duration;
            // A double blink is a short second close, not a longer one.
            if (state.pending > 0) { state.pending -= 1; state.next = now + behavior.duration * 2; }
            else { state.pending = random() < behavior.doubleChance ? 1 : 0; state.next = state.pending ? now + behavior.duration * 2 : now + delay(behavior); }
          } else if (behavior.type === 'randomIdle') {
            state.randomValue = span(behavior.min, behavior.max);
            state.next = now + delay(behavior);
          } else {
            // Drift: ease to a new target inside the amplitude, then rest.
            state.from = state.to;
            state.to = span(-Math.abs(behavior.amplitude), Math.abs(behavior.amplitude));
            state.started = now;
            state.travel = span(behavior.travelMin, behavior.travelMax);
            state.next = now + state.travel + delay(behavior);
          }
        }
        if (behavior.type === 'blink') { closed[behavior.id] = now < state.blinkUntil; blinkActive ||= closed[behavior.id]; }
        else if (behavior.type === 'randomIdle') { contributions[behavior.id] = state.randomValue; randomValue = state.randomValue; }
        else {
          const progress = state.travel > 0 ? clamp((now - state.started) / state.travel, 0, 1) : 1;
          contributions[behavior.id] = state.from + (state.to - state.from) * easingValue(progress, 'easeInOut');
        }
      }
      return { blinkActive, randomValue, contributions, closed };
    },
    reset() { states.clear(); }
  };
}

export function parseExpression(expr) {
  const source = String(expr ?? '0').trim();
  if (expressionCache.has(source)) return expressionCache.get(source);
  const tokens = source.match(/[A-Za-z_]\w*|(?:\d+\.?\d*|\.\d+)|[()+\-*/]/g) || [];
  if (!tokens.length || tokens.join('') !== source.replace(/\s+/g, '')) throw new Error('contains unsupported syntax');
  const output = [], operators = [], names = new Set();
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2, 'u-': 3 };
  let expectsValue = true;
  for (const token of tokens) {
    if (!Number.isNaN(Number(token))) { output.push(Number(token)); expectsValue = false; continue; }
    if (/^[A-Za-z_]/.test(token)) { output.push(token); names.add(token); expectsValue = false; continue; }
    if (token === '(') { operators.push(token); expectsValue = true; continue; }
    if (token === ')') {
      if (expectsValue) throw new Error('has an unexpected closing parenthesis');
      while (operators.length && operators.at(-1) !== '(') output.push(operators.pop());
      if (operators.pop() !== '(') throw new Error('has unbalanced parentheses');
      expectsValue = false; continue;
    }
    let operator = token;
    if (expectsValue && token === '-') operator = 'u-';
    else if (expectsValue) throw new Error(`has unexpected operator "${token}"`);
    while (operators.length && precedence[operators.at(-1)] >= precedence[operator]) output.push(operators.pop());
    operators.push(operator); expectsValue = true;
  }
  if (expectsValue) throw new Error('ends with an operator');
  while (operators.length) { const op = operators.pop(); if (op === '(') throw new Error('has unbalanced parentheses'); output.push(op); }
  const parsed = { output, variables: [...names] };
  expressionCache.set(source, parsed);
  if (expressionCache.size > EXPRESSION_CACHE_LIMIT) expressionCache.delete(expressionCache.keys().next().value);
  return parsed;
}

export function evaluateExpression(expr, scope = {}) {
  try {
    const { output } = parseExpression(expr);
    const stack = [];
    for (const token of output) {
      if (typeof token === 'number') { stack.push(token); continue; }
      if (token === 'u-') { if (!stack.length) return 0; stack.push(-stack.pop()); continue; }
      if (/^[A-Za-z_]/.test(token)) { const n = Number(scope[token]); stack.push(Number.isFinite(n) ? n : 0); continue; }
      if (stack.length < 2) return 0;
      const b = stack.pop(), a = stack.pop();
      const value = token === '+' ? a + b : token === '-' ? a - b : token === '*' ? a * b : b === 0 ? 0 : a / b;
      stack.push(Number.isFinite(value) ? value : 0);
    }
    return stack.length === 1 && Number.isFinite(stack[0]) ? stack[0] : 0;
  } catch { return 0; }
}

export function curveValue(value, curve = 'linear') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (Math.abs(numeric) > 1 || curve === 'linear') return numeric;
  const sign = Math.sign(numeric), t = Math.abs(numeric);
  if (curve === 'easeIn') return sign * t * t;
  if (curve === 'easeOut') return sign * (1 - (1 - t) ** 2);
  return sign * (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
}

export function easingValue(value, easing = 'linear') {
  const t = clamp(finite(value, 0), 0, 1);
  if (easing === 'easeIn') return t * t;
  if (easing === 'easeOut') return 1 - (1 - t) ** 2;
  if (easing === 'easeInOut') return t < .5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
  return t;
}

export function normalizeBinding(binding, legacyCurve = 'linear') {
  if (typeof binding === 'string' || typeof binding === 'number') {
    return { enabled: true, mode: 'advanced', expression: String(binding), curve: legacyCurve, amplitude: 1, offset: 0 };
  }
  return {
    enabled: binding?.enabled !== false,
    mode: binding?.mode === 'simple' ? 'simple' : 'advanced',
    expression: String(binding?.expression ?? '0'),
    curve: CURVES.includes(binding?.curve) ? binding.curve : 'linear',
    amplitude: finite(binding?.amplitude, 1), offset: finite(binding?.offset, 0)
  };
}

export function parameterValues(params = {}) {
  return Object.fromEntries(Object.entries(params).map(([name, param]) => [name,
    typeof param === 'object' && param !== null ? finite(param.value, finite(param.default, 0)) : finite(param, 0)
  ]));
}

export function bindingNeutral(property) {
  return ['scaleX', 'scaleY', 'opacity'].includes(property) ? 1 : 0;
}

export function evaluateRigBinding(binding, params, options = {}) {
  const legacyCurve = typeof options === 'string' ? options : options.curve;
  const neutral = typeof options === 'object' && Number.isFinite(options.neutral) ? options.neutral : 0;
  if (binding == null) return neutral;
  const normalized = normalizeBinding(binding, legacyCurve);
  if (!normalized.enabled) return neutral;
  return curveValue(evaluateExpression(normalized.expression, parameterValues(params)), normalized.curve)
    * normalized.amplitude + normalized.offset;
}

export function compileRigFrame(elements = {}, params = {}, globalConstraints = {}, stateConstraints = {}, options = {}) {
  const frame = {}, values = parameterValues(params);
  const keyforms = keyformIndex(options.keyforms);
  const warps = warpIndex(options.warps, elements);
  const pins = pinIndex(options.rigPins, elements);
  const shapes = shapeKeyIndex(options.shapeKeys, elements, displacedTargets(warps, pins));
  const parallax = options.parallax ? normalizeParallax(options.parallax) : null;
  // A band is reported even when a rig configures no parallax, exactly as hands
  // already do: it says where an element sits, not whether it drifts sideways.
  const bandSettings = parallax || DEFAULT_PARALLAX;
  const previousBands = options.previousBands || null;
  // Secondary motion (3D-10): how far behind each follower is *this frame*,
  // computed by the engine because it is the only thing here that remembers a
  // previous frame. Compiling stays a pure function of the pose it is given.
  const trailing = options.followerOffsets || null;
  // The hierarchy resolves before the elements, so a child can read the world
  // matrix it inherits (docs/DEFORMER_MODEL.md).
  const hierarchy = deformerList(options.deformers);
  const matrices = hierarchy && compileDeformerMatrices(hierarchy, values,
    (binding, scope, channel) => evaluateRigBinding(binding, scope, { neutral: bindingNeutral(channel) }));
  for (const [id, element] of Object.entries(elements)) {
    const base = element.baseTransform || element;
    const enabled = element.constraints || {};
    const g = globalConstraints || {}, s = stateConstraints || {};
    const factor = (category) => finite(g[category], 1) * finite(s[category], 1);
    const value = (property) => evaluateRigBinding(element.bindings?.[property], values, { curve: element.bindingCurves?.[property], neutral: bindingNeutral(property) });
    // Keyforms compose with bindings, not instead of them: additive channels sum,
    // the rest multiply, so a rig with no keyforms compiles exactly as before.
    const targeted = keyforms.get(id);
    let shapeWeights = null;
    // One accumulator per element, holding every channel's neutral. Spelled out
    // rather than spread from KEYFORM_CHANNEL_NEUTRAL: a literal is a shape the
    // engine can keep on the stack, while cloning a frozen table object measures
    // ~180 ns per element — and this line runs once per element per frame
    // (docs/RUNTIME_PERFORMANCE.md). A contract test walks the channel table
    // against the frame, so the two cannot drift apart in silence.
    const pose = { translateX: 0, translateY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, depth: 0 };
    if (targeted) for (const compiled of targeted) {
      const resolved = evaluateCompiledKeyform(compiled, values);
      if (compiled.channel === 'pathShape') {
        if (!compiled.shapeKey) continue;
        shapeWeights ||= {};
        shapeWeights[compiled.shapeKey] = finite(shapeWeights[compiled.shapeKey], 0) + resolved;
      } else if (ADDITIVE_KEYFORM_CHANNELS.includes(compiled.channel)) pose[compiled.channel] += resolved;
      else pose[compiled.channel] *= resolved;
    }
    // The depth an element actually has is its authored depth plus whatever a
    // pose moved it by, under the same clamp as the authored value — so turning
    // the head can push an ear through a band without the runtime learning a
    // second notion of depth (docs/DEPTH_PARALLAX.md).
    const authored = clampDepth(finite(element.depth, 0));
    const depth = clampDepth(finite(element.depth, 0) + pose.depth);
    // Parallax is driven by the *authored* depth alone, on purpose.
    // `parallaxOffset` is the cheap stand-in for a rotation — `headX · depth ·
    // amount`, three multiplications — and a pose that writes a depth is
    // written by something that has already done that rotation properly (3D-08:
    // the head turn projects each feature and reports where it ended). Letting
    // the stand-in fire again on top would displace the part twice, by two
    // different approximations of one movement, and it broke the left/right
    // symmetry of a generated turn when it did. A depth pose therefore says
    // where a part is in the stack; a translate pose says where it is on screen.
    const drift = parallax && authored ? parallaxOffset(authored, values, parallax) : null;
    const trail = trailing ? trailing[id] : null;
    const tx = enabled.translate === false ? 0 : (value('translateX') + pose.translateX + (drift ? drift.x : 0) + (trail ? trail.x : 0)) * factor('translate');
    const ty = enabled.translate === false ? 0 : (value('translateY') + pose.translateY + (drift ? drift.y : 0) + (trail ? trail.y : 0)) * factor('translate');
    const rotation = enabled.rotate === false ? 0 : (value('rotation') + pose.rotation + (trail ? trail.rotation : 0)) * factor('rotate');
    const sx = enabled.scale === false ? 1 : 1 + (value('scaleX') * pose.scaleX - 1) * factor('scale');
    const sy = enabled.scale === false ? 1 : 1 + (value('scaleY') * pose.scaleY - 1) * factor('scale');
    const morph = element.morph?.enabled ? compileMorph(element.morph, values) : null;
    frame[id] = {
      transform: {
        x: finite(base.x, 0) + tx, y: finite(base.y, 0) + ty,
        rotation: finite(base.rotation, 0) + rotation,
        scaleX: finite(base.scaleX, 1) * sx, scaleY: finite(base.scaleY, 1) * sy,
        pivotX: finite(base.pivotX ?? element.pivotX, 0), pivotY: finite(base.pivotY ?? element.pivotY, 0)
      },
      opacity: clamp(finite(element.baseOpacity ?? element.opacity, 1) * value('opacity') * pose.opacity, 0, 1),
      morph
    };
    if (shapeWeights) frame[id].shapeWeights = shapeWeights;
    if (depth) frame[id].depth = depth;
    // behind / normal / front for every element, through the same hysteresis the
    // hands use. It is *reported*, never acted on: nothing here reorders a node,
    // and the band exists so a later pass can sort without re-deriving depth.
    frame[id].depthBand = depthBand(depth, bandSettings, previousBands?.[id] || null);
    // Local deformation and the local transform are already done; only now does
    // the parent chain apply. Never the other way round.
    const inherited = matrices && element.deformer ? matrices.get(element.deformer) : null;
    if (inherited && !isIdentityMatrix(inherited)) {
      frame[id].deformer = element.deformer;
      frame[id].matrix = multiplyMatrix(inherited, transformToMatrix(frame[id].transform));
    }
  }
  // Hands hang off an anchor on the body, so they resolve once every element
  // they might follow has a frame (docs/HAND_RIGGING.md).
  if (options.hands) evaluateHands(options.hands, elements, frame, values, { matrices, parallax: parallax || undefined, previousBands: options.previousBands });
  // Stage 10 of the evaluation order: the relationships the rig has to hold,
  // solved in the order they are listed (docs/FACE_CONTROL_RIG.md).
  const constraints = cachedList(constraintCache, options.rigConstraints, (records) => normalizeRigConstraints({ rigConstraints: records }));
  if (constraints) solveRigConstraints(constraints, frame, values);
  if (shapes) for (const [id, shapeTarget] of shapes.targets) {
    const entry = frame[id];
    if (!entry) continue;
    const weights = shapeTarget.scratchWeights;
    for (let k = 0; k < shapeTarget.keys.length; k += 1) {
      weights[k] = shapeKeyWeight(shapeTarget.keys[k], values, entry.shapeWeights, evaluateShapeDriver);
    }
    // Shape keys and a warp are both offsets on the same numeric vector, so a
    // warped mouth can still smile (docs/WARP_GRID.md).
    const warp = warps?.get(id);
    const grid = warp ? weightWarpGrid(warp.warp.grid, warpWeight(warp.warp, values)) : null;
    // Stage 12 of the evaluation order: the pins move the artwork around them
    // before the warp pushes the space it sits in (docs/FACE_CONTROL_RIG.md).
    const pinned = pins?.get(id);
    const held = pinned ? pinDisplacement(pinned.target, pinOffsets(pinned.pins, values, evaluatePinMotion)) : null;
    if (pinned) entry.pins = pinned.pins.length;
    entry.path = evaluateShapeTarget(shapeTarget, weights,
      combineDisplacement(shapeTarget, held, grid ? warpDisplacement(warp.target, grid) : null));
  }
  // Stage 15: one thing holding another. Last, because "where did the cheek end
  // up" is only a question with an answer once the cheek has been deformed.
  const holds = cachedList(holdCache, options.rigHolds, (records) => normalizeRigHolds({ rigHolds: records }));
  if (holds) {
    const points = cachedList(attachmentCache, options.rigAttachments, (records) => normalizeRigAttachments({ rigAttachments: records })) || [];
    solveRigHolds(holds, points, frame, { pins, values, evaluate: evaluatePinMotion });
  }
  return frame;
}

/** A pin's own movement reads like a binding, because that is what it is. */
const evaluatePinMotion = (motion, values) => evaluateRigBinding(motion, values, { neutral: 0 });

/** A warp may be faded in and out by a parameter, through the same range rule. */
function warpWeight(warp, values) {
  if (!warp.driver?.parameter) return 1;
  const span = warp.driver.max - warp.driver.min;
  if (span === 0) return 1;
  return clamp((finite(values[warp.driver.parameter], 0) - warp.driver.min) / span, 0, 1);
}

/** Expression-mode shape drivers reuse the binding maths, never a second parser. */
function evaluateShapeDriver(driver, values) {
  return curveValue(evaluateExpression(driver.expression, values), driver.curve) * driver.amplitude + driver.offset;
}

function compileMorph(morph, values) {
  const raw = finite(values[morph.param || 'mouthOpen'], 0);
  const t = clamp((raw - finite(morph.min, -1)) / (finite(morph.max, 1) - finite(morph.min, -1) || 1), 0, 1);
  return { ...morph, progress: t };
}

export function canTransition(transitions, from, to) {
  if (from === to) return true;
  const allowed = transitions?.[from];
  // A missing source preserves the legacy unrestricted graph. An explicitly
  // configured empty list is an intentional deny-all policy.
  return allowed === undefined || (Array.isArray(allowed) && allowed.includes(to));
}

export function resolveStateParams(params = {}, state = {}) {
  return Object.fromEntries(Object.entries(params).map(([name, param]) => {
    const fallback = typeof param === 'object' && param !== null ? finite(param.default, 0) : finite(param, 0);
    return [name, finite(state?.[name], fallback)];
  }));
}


/** Expressions: named target values for semantic controls, applied at an intensity (see docs/ADR_EXPRESSIONS.md). */
/** How long an expression change takes. 0 keeps the pre-V2 instant switch. */
export function normalizeExpressionBlend(source = {}) {
  return {
    duration: Math.max(0, finite(source?.duration, 0)),
    easing: CURVES.includes(source?.easing) ? source.easing : 'easeInOut'
  };
}

/** How long one motion takes to become another. 0 keeps the pre-V2 instant cut. */
export function normalizeMotionBlend(source = {}) {
  return {
    duration: Math.max(0, finite(source?.duration, 0)),
    easing: CURVES.includes(source?.easing) ? source.easing : 'easeInOut'
  };
}

/**
 * The motion layer (docs/ADR_MOTION_LAYERING.md).
 *
 * One place where clips are held, weighted and handed over, used by both the
 * engine and the editor preview so the two cannot drift. Playing a motion
 * cross-fades to it from whatever is playing; `layer: true` runs it alongside
 * instead. A clip is mixed as `weightedOverride`, so its keys are the pose it
 * is worth at that weight, and a clip that reaches its end fades out rather
 * than disappearing in one frame.
 *
 * @param {{blend?: object|(() => object), clips?: object[]|(() => object[])}} options
 */
export function createMotionLayer({ blend, clips } = {}) {
  const readBlend = typeof blend === 'function' ? blend : () => blend;
  const readClips = typeof clips === 'function' ? clips : () => clips || [];
  // Every call passes its own span, so the blender needs no default of its own.
  const weights = createWeightBlender();
  let entries = [];

  const span = (options = {}) => {
    const base = normalizeMotionBlend(readBlend() || {});
    return { duration: Math.max(0, finite(options.fade, base.duration)), easing: CURVES.includes(options.easing) ? options.easing : base.easing };
  };
  const find = (id) => entries.find((entry) => entry.clip.id === id) || null;
  /** An entry is alive while it is showing, or while it is on its way in. */
  const alive = () => { const showing = weights.values(), wanted = weights.targets(); return entries.filter((entry) => showing[entry.clip.id] > 0 || wanted[entry.clip.id] > 0); };

  const api = {
    /** @returns {boolean} whether a clip with that id exists */
    play(id, at = 0, options = {}) {
      const clip = readClips().find((item) => item.id === id);
      if (!clip) return false;
      const entry = find(id);
      if (entry) { entry.clip = clip; entry.started = finite(at, 0); }
      else entries = [...entries, { clip, started: finite(at, 0) }];
      const blending = span(options);
      if (options.layer) weights.set(id, 1, blending);
      else weights.transitionTo(id, { ...blending, weight: 1 });
      return true;
    },
    /** Stop one motion, or every motion when no id is given. */
    stop(id, options = {}) {
      if (id && typeof id === 'object') { options = id; id = undefined; }
      const had = alive().length > 0;
      const blending = span(options);
      if (id === undefined) weights.clearAll(blending);
      else if (find(id)) weights.clear(id, blending);
      else return false;
      return had;
    },
    /** Move a playing clip's clock, so a scrub keeps the pose it is showing. */
    seek(id, at, time) { const entry = find(id); if (!entry) return false; entry.started = finite(at, 0) - Math.max(0, finite(time, 0)); return true; },
    /** Seconds into `id`, clamped to its duration unless it loops. */
    timeOf(id, elapsed) {
      const entry = find(id);
      if (!entry) return null;
      const time = Math.max(0, finite(elapsed, 0) - entry.started);
      return entry.clip.loop ? time : Math.min(time, finite(entry.clip.duration, 0));
    },
    advance(deltaMs) { weights.advance(deltaMs); },

    /**
     * Mixer layers for this frame, in start order — a motion started later wins
     * on a parameter two of them share. Ended clips are released here, which is
     * what turns "the clip stopped" into a fade instead of a cut.
     */
    layers(elapsed, base = {}) {
      const now = finite(elapsed, 0), wanted = weights.targets();
      for (const entry of entries) {
        if (entry.clip.loop || !wanted[entry.clip.id]) continue;
        if (now - entry.started > finite(entry.clip.duration, 0)) weights.clear(entry.clip.id, span());
      }
      entries = alive();
      const showing = weights.values(), out = [];
      for (const entry of entries) {
        const weight = showing[entry.clip.id] || 0;
        if (weight <= 0) continue;
        // An additive motion contributes its distance from the movement's own
        // neutral, scaled by how far it has faded in -- so it layers over what
        // is already playing instead of replacing it, and fades to nothing
        // rather than to the pose it happens to hold.
        const mode = entry.clip.blend === 'additive' ? 'additive' : 'weightedOverride';
        out.push({ source: 'motion', mode, weight, values: evaluateAnimationClip(entry.clip, api.timeOf(entry.clip.id, now), base) });
      }
      return out;
    },

    /** Weights as they look right now, keyed by clip id. */
    values: () => weights.values(),
    /** The motion an API caller would call "the one playing": the newest one still wanted. */
    active() { const wanted = weights.targets(); for (let index = entries.length - 1; index >= 0; index--) if (wanted[entries[index].clip.id]) return entries[index].clip.id; return null; },
    playing() { const wanted = weights.targets(); return entries.filter((entry) => wanted[entry.clip.id]).map((entry) => entry.clip.id); },
    settled: () => weights.settled(),
    reset() { entries = []; weights.reset(); }
  };
  return api;
}

export function normalizeExpressions(rig = {}) {
  if (!Array.isArray(rig.expressions)) return [];
  return rig.expressions.filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && item.id).map((item) => ({
    id: item.id, name: typeof item.name === 'string' && item.name ? item.name : item.id, source: typeof item.source === 'string' ? item.source : 'manual',
    controls: Object.fromEntries(Object.entries(item.controls || {}).filter(([, value]) => Number.isFinite(Number(value))).map(([key, value]) => [key, Number(value)]))
  }));
}

/**
 * effective[p] = clamp(base[p] + Σ weight × (target[p] − neutral[p])). Intensity 0 is the base
 * pose, 1 the authored target; expressions stack additively. Shared by the editor preview and
 * the exported runtime so both compose identically.
 */
export function composeExpressionParams(base = {}, expressions = [], active = {}, params = {}) {
  const result = { ...base };
  const weights = Object.entries(active || {}).filter(([, weight]) => Number.isFinite(Number(weight)) && Number(weight) !== 0);
  if (!weights.length) return result;
  const touched = new Set();
  for (const [id, weight] of weights) {
    const expression = expressions.find((item) => item.id === id);
    if (!expression) continue;
    for (const [name, target] of Object.entries(expression.controls || {})) {
      const param = params[name];
      if (param === undefined) continue;
      const neutral = finite(typeof param === 'object' && param !== null ? param.default : param, 0);
      result[name] = finite(result[name], neutral) + Number(weight) * (finite(target, neutral) - neutral);
      touched.add(name);
    }
  }
  for (const name of touched) {
    const param = params[name];
    if (param && typeof param === 'object' && Number.isFinite(Number(param.min)) && Number.isFinite(Number(param.max))) result[name] = clamp(result[name], Number(param.min), Number(param.max));
  }
  return result;
}


/**
 * Animation clips (Timeline / Motion presets): sorted keyframe tracks per
 * parameter. Shared by the editor preview and the exported runtime.
 */
export function evaluateAnimationClip(clip, time, defaults = {}) {
  const duration = Number(clip?.duration);
  if (!Number.isFinite(duration) || duration <= 0) return {};
  const numericTime = Number.isFinite(Number(time)) ? Number(time) : 0;
  const t = clip.loop ? ((numericTime % duration) + duration) % duration : Math.max(0, Math.min(duration, numericTime));
  const result = {};
  for (const [parameter, frames] of Object.entries(clip.tracks || {})) {
    if (!frames.length) continue;
    if (t <= frames[0].time) { result[parameter] = frames[0].value; continue; }
    if (t >= frames.at(-1).time) { result[parameter] = frames.at(-1).value; continue; }
    const rightIndex = frames.findIndex((frame) => frame.time >= t), left = frames[rightIndex - 1], right = frames[rightIndex];
    const progress = easingValue((t - left.time) / (right.time - left.time), right.easing);
    result[parameter] = left.value + (right.value - left.value) * progress;
  }
  return { ...Object.fromEntries(Object.keys(clip.tracks || {}).filter((key) => !(key in result) && key in defaults).map((key) => [key, defaults[key]])), ...result };
}

/** Tolerant reader for `rig.animations` (docs/ADR_REACTIONS.md): invalid clips and frames are dropped. */
export function normalizeAnimations(rig = {}) {
  if (!Array.isArray(rig.animations)) return [];
  const result = [];
  for (const source of rig.animations) {
    if (!source || typeof source !== 'object' || typeof source.id !== 'string' || !source.id) continue;
    const duration = Number(source.duration);
    if (!Number.isFinite(duration) || duration <= 0) continue;
    const tracks = {};
    for (const [parameter, frames] of Object.entries(source.tracks || {})) {
      if (!Array.isArray(frames)) continue;
      tracks[parameter] = frames.filter((frame) => frame && Number.isFinite(Number(frame.time)) && Number.isFinite(Number(frame.value)))
        .map((frame) => ({ time: clamp(Number(frame.time), 0, duration), value: Number(frame.value), easing: CURVES.includes(frame.easing) ? frame.easing : 'linear' }))
        .sort((a, b) => a.time - b.time);
    }
    // How this motion meets whatever else is playing (VNX-31). `override` is
    // what every clip did and still does by default; `additive` lets a nod and
    // a look-around both drive `headY` and *sum* instead of the later one
    // winning outright, which is the resolution an overlapping arrangement
    // wanted and the engine could not honour (VNX-32).
    result.push({ id: source.id, name: typeof source.name === 'string' && source.name ? source.name : source.id, duration, loop: Boolean(source.loop), ...(source.blend === 'additive' ? { blend: 'additive' } : {}), tracks });
  }
  return result;
}

/** The parameter a hand pose is driven by, matching what the hand panel writes. */
export function handPoseParameterName(side, poseId) {
  const prefix = side === 'right' ? 'handR' : 'handL';
  return `${prefix}${String(poseId).charAt(0).toUpperCase()}${String(poseId).slice(1)}`;
}

export const REACTION_TRIGGERS = Object.freeze(['click', 'hover', 'timer', 'custom']);
export const REACTION_TIMINGS = Object.freeze({
  fast: Object.freeze({ attack: .1, hold: .6, release: .3 }),
  normal: Object.freeze({ attack: .2, hold: 1.2, release: .5 }),
  slow: Object.freeze({ attack: .4, hold: 2, release: .8 })
});

/** One reaction: When (trigger) → Do (expression at a weight, optional motion clip) → Timing → After. */
export function normalizeReaction(source = {}) {
  const rawTrigger = source.trigger && typeof source.trigger === 'object' ? source.trigger : { type: source.trigger };
  const type = REACTION_TRIGGERS.includes(rawTrigger.type) ? rawTrigger.type : 'click';
  const trigger = { type };
  if (type === 'custom') trigger.name = String(rawTrigger.name || 'custom');
  if (type === 'timer') trigger.interval = Math.max(.1, finite(rawTrigger.interval, 5));
  const timingSource = source.timing && typeof source.timing === 'object' ? source.timing : REACTION_TIMINGS[source.timing] || REACTION_TIMINGS.normal;
  const expression = source.expression && typeof source.expression === 'object' && typeof source.expression.id === 'string' && source.expression.id
    ? { id: source.expression.id, weight: clamp(finite(source.expression.weight, 1), 0, 1) } : null;
  const motion = source.motion && typeof source.motion === 'object' && typeof source.motion.clipId === 'string' && source.motion.clipId ? { clipId: source.motion.clipId } : null;
  // Hand gestures (docs/HAND_GESTURES.md): a reaction raises named hand poses
  // for as long as it runs. They are ordinary parameters, so they reach the
  // same mixer as everything else -- a reaction never animates anything itself.
  const gestures = (Array.isArray(source.gestures) ? source.gestures : [])
    .filter((item) => item && typeof item === 'object' && HAND_SIDES.includes(item.side) && typeof item.pose === 'string' && item.pose)
    .map((item) => ({ side: item.side, pose: item.pose, weight: clamp(finite(item.weight, 1), 0, 1) }));
  const id = typeof source.id === 'string' && source.id ? source.id : `reaction-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id, name: typeof source.name === 'string' && source.name ? source.name : id, enabled: source.enabled !== false, trigger, expression, motion, gestures,
    timing: { attack: Math.max(0, finite(timingSource.attack, .2)), hold: Math.max(0, finite(timingSource.hold, 1.2)), release: Math.max(0, finite(timingSource.release, .5)) },
    after: source.after === 'stay' ? 'stay' : 'return', priority: Math.round(finite(source.priority, 0)), interrupt: source.interrupt === 'ignore' ? 'ignore' : 'replace'
  };
}

export function normalizeReactions(rig = {}) {
  return Array.isArray(rig.reactions) ? rig.reactions.filter((item) => item && typeof item === 'object').map(normalizeReaction) : [];
}

/**
 * Reaction sequencer shared by the editor preview and the exported runtime.
 * Time is in seconds on the caller's clock. One reaction is active at a time:
 * attack ramps the expression in, hold keeps it (at least as long as the
 * motion clip), release ramps it out (or `after: 'stay'` leaves it applied).
 * A new reaction replaces the active one only if its priority is not lower;
 * `interrupt: 'ignore'` reactions never fire while another one is active.
 */
export function createReactionController(source = () => ({ reactions: [], clips: [] })) {
  let active = null;
  // A reaction that is replaced mid-flight keeps releasing here instead of
  // vanishing, so two reactions cross-fade rather than passing through neutral
  // (docs/CONTINUOUS_TRANSITIONS.md). Bounded: rapid fire retires the oldest.
  let retiring = [];
  const RETIRING_LIMIT = 4;
  const stay = {}, stayedGestures = {}, timers = new Map();
  const resolve = () => { const data = typeof source === 'function' ? source() : source; return { reactions: data?.reactions || [], clips: data?.clips || [] }; };

  /** Attack / hold / release envelope of one entry at `elapsed` seconds in. */
  function envelope(entry, elapsed) {
    const { attack, hold, release } = entry.reaction.timing, clip = entry.clip;
    const activeLength = Math.max(attack + hold, clip && !clip.loop ? clip.duration : 0);
    if (elapsed < attack) return { phase: 'attack', weight: attack ? easingValue(elapsed / attack, 'easeOut') : 1, activeLength };
    if (elapsed < activeLength) return { phase: 'hold', weight: 1, activeLength };
    if (entry.reaction.after !== 'stay' && elapsed < activeLength + release) return { phase: 'release', weight: release ? 1 - easingValue((elapsed - activeLength) / release, 'easeIn') : 0, activeLength };
    return { phase: 'done', weight: 0, activeLength };
  }

  /**
   * Add one entry's contribution at `weight`, on top of whatever earlier
   * entries left in `params`.
   *
   * The envelope shapes the motion exactly as it shapes the expression and the
   * gestures: a slow reaction eases its movement in and out instead of snapping
   * it, and a clip past its end holds its last pose and fades rather than
   * disappearing in one frame.
   */
  function contribute(entry, now, base, weight, expressions, params) {
    const { reaction, clip } = entry;
    if (reaction.expression) expressions[reaction.expression.id] = Math.max(expressions[reaction.expression.id] || 0, reaction.expression.weight * weight);
    if (clip) {
      const raw = Math.max(0, now - entry.started);
      const time = clip.loop ? raw : Math.min(raw, finite(clip.duration, 0));
      for (const [name, value] of Object.entries(evaluateAnimationClip(clip, time, base))) {
        const from = finite(params[name], finite(base[name], value));
        params[name] = from + (value - from) * weight;
      }
    }
    for (const gesture of reaction.gestures) {
      const name = handPoseParameterName(gesture.side, gesture.pose);
      params[name] = Math.max(finite(params[name], 0), gesture.weight * weight);
    }
  }

  function fire(id, at = 0) {
    const { reactions, clips } = resolve();
    const reaction = typeof id === 'object' && id ? id : reactions.find((item) => item.id === id);
    if (!reaction || !reaction.enabled) return false;
    if (active && active.phase !== 'release' && (reaction.interrupt === 'ignore' || reaction.priority < active.reaction.priority)) return false;
    if (reaction.expression && reaction.after === 'return') delete stay[reaction.expression.id];
    if (reaction.after === 'return') for (const gesture of reaction.gestures) delete stayedGestures[handPoseParameterName(gesture.side, gesture.pose)];
    // Hand the outgoing reaction over instead of dropping it: it fades from the
    // weight it is showing, over its own release time.
    if (active) {
      const from = envelope(active, Math.max(0, finite(at, 0) - active.started)).weight;
      const release = Math.max(0, finite(active.reaction.timing.release, 0));
      if (from > 0 && release > 0) retiring = [...retiring, { ...active, from, retiredAt: finite(at, 0), release }].slice(-RETIRING_LIMIT);
    }
    active = { reaction, clip: reaction.motion ? clips.find((clip) => clip.id === reaction.motion.clipId) || null : null, started: finite(at, 0), phase: 'attack', elapsed: 0 };
    return true;
  }
  function trigger(event, at = 0) {
    const { reactions } = resolve();
    const type = typeof event === 'string' ? event : event?.type, name = typeof event === 'object' && event ? event.name : undefined;
    const candidates = reactions.filter((item) => item.enabled && item.trigger.type === type && (type !== 'custom' || item.trigger.name === name)).sort((a, b) => b.priority - a.priority);
    for (const reaction of candidates) if (fire(reaction, at)) return reaction.id;
    return null;
  }
  function evaluate(now, base = {}) {
    const { reactions } = resolve();
    for (const reaction of reactions) {
      if (!reaction.enabled || reaction.trigger.type !== 'timer') { timers.delete(reaction.id); continue; }
      let next = timers.get(reaction.id);
      if (next === undefined) { next = now + reaction.trigger.interval; timers.set(reaction.id, next); }
      if (now >= next) { timers.set(reaction.id, now + reaction.trigger.interval); fire(reaction, now); }
    }
    const expressions = { ...stay };
    const params = {};
    // A gesture that stayed keeps its parameter raised, like a stayed
    // expression. Everything below layers on top of it rather than replacing
    // it, so a stayed hand survives a reaction that carries a motion.
    for (const [name, value] of Object.entries(stayedGestures)) params[name] = value;

    // Reactions on their way out first, so the incoming one blends over them.
    if (retiring.length) {
      const still = [];
      for (const entry of retiring) {
        const since = Math.max(0, now - entry.retiredAt);
        if (since >= entry.release) continue;
        contribute(entry, now, base, entry.from * (1 - easingValue(since / entry.release, 'easeIn')), expressions, params);
        still.push(entry);
      }
      retiring = still;
    }

    if (active) {
      const { reaction } = active, elapsed = Math.max(0, now - active.started);
      const { phase, weight } = envelope(active, elapsed);
      if (phase === 'done') {
        if (reaction.after === 'stay' && reaction.expression) { stay[reaction.expression.id] = reaction.expression.weight; expressions[reaction.expression.id] = reaction.expression.weight; }
        if (reaction.after === 'stay') for (const gesture of reaction.gestures) {
          const name = handPoseParameterName(gesture.side, gesture.pose);
          stayedGestures[name] = gesture.weight;
          params[name] = gesture.weight;
        }
        active = null;
      } else {
        active.phase = phase; active.elapsed = elapsed;
        contribute(active, now, base, weight, expressions, params);
      }
    }
    return { expressions, params, active: active ? { id: active.reaction.id, phase: active.phase, elapsed: active.elapsed } : null };
  }
  return {
    fire, trigger, evaluate,
    getActive: () => (active ? { id: active.reaction.id, phase: active.phase, elapsed: active.elapsed } : null),
    getStayed: () => ({ ...stay }),
    clearStayed(id) { if (id === undefined) { for (const key of Object.keys(stay)) delete stay[key]; for (const key of Object.keys(stayedGestures)) delete stayedGestures[key]; } else delete stay[id]; },
    cancel() { active = null; retiring = []; },
    reset() { active = null; retiring = []; for (const key of Object.keys(stay)) delete stay[key]; for (const key of Object.keys(stayedGestures)) delete stayedGestures[key]; timers.clear(); }
  };
}

export function createMascotEngine({ svgRoot, rig, fps = 20, random = Math.random, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame, now = () => performance.now() }) {
  const initial = resolveStateParams(rig.params, rig.states?.[rig.activeState]);
  let stateParams = { ...initial }, activeState = rig.activeState || Object.keys(rig.states || {})[0];
  const overrides = {}, behaviors = normalizeBehaviors(rig), behaviorController = createBehaviorController({ random }); let transition = null, raf = 0, last = 0, started = 0, generation = 0;
  const expressions = normalizeExpressions(rig);
  // Expression weights ramp rather than jump. The default span is 0, so a rig
  // that does not configure one behaves exactly as it did before V2; any span
  // makes a change start from the weight currently on screen, never from
  // neutral (docs/CONTINUOUS_TRANSITIONS.md).
  const expressionBlend = normalizeExpressionBlend(rig.expressionBlend);
  const activeExpressions = createWeightBlender(expressionBlend);
  // Reactions and animations (docs/ADR_REACTIONS.md): additive blocks, absent in older rigs.
  const animations = normalizeAnimations(rig), reactions = normalizeReactions(rig), reactionController = createReactionController({ reactions, clips: animations });
  // Compiled once at construction; the render loop never revisits the records.
  const keyforms = normalizeKeyforms(rig), shapeKeys = normalizeShapeKeys(rig), hands = normalizeHands(rig), deformers = normalizeDeformers(rig), parallax = normalizeParallax(rig.parallax), warps = normalizeWarps(rig), rigPins = normalizeRigPins(rig), rigConstraints = normalizeRigConstraints(rig), rigAttachments = normalizeRigAttachments(rig), rigHolds = normalizeRigHolds(rig);
  const depthBands = {};
  // One follower group per hand: the two sides are tuned independently, and a
  // group with `enabled: false` is a pass-through (docs/HAND_RIGGING.md).
  const handInertia = hands ? Object.fromEntries(HAND_SIDES.filter((side) => hands[side])
    .map((side) => [side, { group: createInertiaGroup(hands[side].inertia), names: handMotionParameters(hands[side]) }])) : null;
  // Motions are held, weighted and handed over by the shared motion layer, so
  // the engine and the editor preview cannot drift (docs/ADR_MOTION_LAYERING.md).
  const motionLayer = createMotionLayer({ blend: normalizeMotionBlend(rig.motionBlend), clips: animations });
  const seconds = (timestamp) => Math.max(0, (finite(timestamp, 0) - started) / 1000);
  const composed = (timestamp) => {
    // Layers are declared and ordered, never spread-merged ad hoc
    // (docs/PARAMETER_MIXER.md). Expressions keep their own neutral-relative
    // additive rule, which is the mixer's `expression` stage.
    const state = paramsAt(timestamp);
    const elapsed = seconds(timestamp);
    const layers = motionLayer.layers(elapsed, state);
    const reaction = reactionController.evaluate(elapsed, state);
    layers.push({ source: 'reaction', mode: 'override', values: reaction.params });
    const base = mixParameters(state, layers, rig.params);
    const weights = activeExpressions.values();
    for (const [id, weight] of Object.entries(reaction.expressions)) weights[id] = Math.max(weights[id] || 0, weight);
    return composeExpressionParams(base, expressions, weights, rig.params);
  };
  const triggerAt = (event) => reactionController.trigger(event, seconds(now()));
  const applied = new WeakMap();
  const nodes = new Map();
  if (svgRoot.id) nodes.set(svgRoot.id, svgRoot);
  if (svgRoot.querySelectorAll) svgRoot.querySelectorAll('[id]').forEach((node) => nodes.set(node.id, node));
  else for (const id of Object.keys(rig.elements || {})) {
    const node = svgRoot.querySelector?.(`#${id}`);
    if (node) nodes.set(id, node);
  }
  // Depth finally reaches paint order (3D-03, docs/DEPTH_PARALLAX.md). Resolved
  // once, here, because the scopes it may reorder are a property of the artwork
  // and not of the frame: the render loop only ever hands it the bands.
  const drawOrder = parallax.enabled && parallax.drawOrder ? createDrawOrder(nodes, Object.keys(rig.elements || {})) : null;
  // Secondary motion (3D-10): the springs live here because the engine is what
  // has a previous frame; `compileRigFrame` is handed the offsets and stays a
  // pure function of the pose.
  const followerGroup = createFollowerGroup(normalizeFollowers(rig));
  // The gaze solver and the eyelid follow (docs/FACE_CONTROL_RIG.md). Inert
  // unless the rig configures them, in which case `step` hands back the very
  // object it was given -- an older mascot pays nothing for this.
  const controlRig = createControlRig(rig);
  function paramsAt(now) {
    if (!transition) return { ...stateParams };
    const progress = clamp((now - transition.started) / transition.duration, 0, 1);
    const eased = easingValue(progress, transition.easing);
    const current = Object.fromEntries(Object.keys(rig.params || {}).map((key) => [key,
      transition.from[key] + (transition.to[key] - transition.from[key]) * eased]));
    if (progress >= 1) { stateParams = { ...transition.to }; transition = null; }
    return current;
  }
  function applyHandInertia(params, delta) {
    if (!handInertia) return params;
    let next = params;
    for (const { group, names } of Object.values(handInertia)) {
      const targets = {};
      for (const name of names) targets[name] = finite(params[name], 0);
      next = { ...next, ...group.step(targets, delta) };
    }
    return next;
  }
  function tick(timestamp, token) {
    if (!raf || token !== generation) return;
    raf = 0;
    if (timestamp - last >= 1000 / fps) {
      const delta = last ? (timestamp - last) / 1000 : 1 / 60;
      last = timestamp;
      activeExpressions.advance(delta * 1000);
      motionLayer.advance(delta * 1000);
      const controlled = mixParameters(composed(timestamp), [{ source: 'override', mode: 'override', values: overrides }], rig.params);
      const elapsed = (timestamp - started) / 1000;
      const effective = applyHandInertia(composeBehaviorParams(controlled, behaviors, elapsed, behaviorController.evaluate(behaviors, elapsed)), delta);
      // Raw in, effective out: what the artwork is posed from this frame, with
      // `effective` itself left exactly as the mixer produced it.
      const posed = controlRig.step(effective, delta);
      const followerOffsets = followerGroup.size ? followerGroup.step(posed, delta) : null;
      const frame = compileRigFrame(rig.elements, posed, rig.globalConstraints, rig.stateConstraints?.[activeState], { keyforms, shapeKeys, hands, deformers, parallax, warps, rigPins, rigConstraints, rigAttachments, rigHolds, previousBands: depthBands, followerOffsets });
      for (const [id, item] of Object.entries(frame)) if (item.depthBand) depthBands[id] = item.depthBand;
      // A no-op on every frame but the ones where a band actually moved, and
      // the hysteresis in `depthBand` is what keeps those rare.
      if (drawOrder) drawOrder.apply(depthBands);
      Object.entries(frame).forEach(([id, item]) => {
        const node = nodes.get(id); if (!node) return;
        const t = item.transform;
        // A composed hierarchy is written as one matrix: decomposing it back
        // into channels would lose a parent's rotation and scale.
        const transform = item.matrix ? matrixToString(item.matrix)
          : `translate(${t.x} ${t.y}) rotate(${t.rotation} ${t.pivotX} ${t.pivotY}) translate(${t.pivotX} ${t.pivotY}) scale(${t.scaleX} ${t.scaleY}) translate(${-t.pivotX} ${-t.pivotY})`;
        const opacity=String(item.opacity);
        const previous=applied.get(node)||{};
        if(previous.transform!==transform)node.setAttribute('transform',transform);
        if(previous.opacity!==opacity)node.setAttribute('opacity',opacity);
        let path=previous.path;
        // Shape keys own the shape when present; legacy A/B morph still applies otherwise.
        if(item.path&&node.tagName.toLowerCase()==='path'){path=item.path;if(previous.path!==path)node.setAttribute('d',path);}
        else if(item.morph&&node.tagName.toLowerCase()==='path'){path=morphPath(item.morph.pathA,item.morph.pathB,item.morph.progress);if(previous.path!==path)node.setAttribute('d',path);}
        applied.set(node,{transform,opacity,path});
      });
    }
    if(token===generation)raf=requestFrame((next)=>tick(next,token));
  }
  return { setParam(key, value) { if (!(key in (rig.params || {}))) return false; overrides[key] = finite(value, stateParams[key]); return true; },
    clearParam(key) { return delete overrides[key]; }, clearParams() { Object.keys(overrides).forEach((key) => delete overrides[key]); },
    setState(name) { if (!rig.states?.[name] || !canTransition(rig.transitions, activeState, name)) return false;
      const timestamp = now(), from = paramsAt(timestamp), to = resolveStateParams(rig.params, rig.states[name]);
      const settings = rig.transitionSettings?.[`${activeState}->${name}`] || {};
      const duration = Math.max(1, finite(settings.duration, 300));
      activeState = name;
      if (!duration) { stateParams = to; transition = null; } else transition = { from, to, started: timestamp, duration, easing: CURVES.includes(settings.easing) ? settings.easing : 'easeInOut' };
      return true; },
    setBehaviorEnabled(id, enabled) { const behavior = behaviors.find((item) => item.id === id); if (!behavior) return false; behavior.enabled = Boolean(enabled); return true; },
    setExpression(id, weight = 1, options = {}) { if (!expressions.some((item) => item.id === id)) return false; activeExpressions.set(id, clamp(finite(weight, 1), 0, 1), options); return true; },
    /** Cross-fade to one expression from whatever is showing (never via neutral). */
    transitionToExpression(id, options = {}) { if (id && !expressions.some((item) => item.id === id)) return false; activeExpressions.transitionTo(id, options); return true; },
    clearExpression(id, options = {}) { return activeExpressions.clear(id, options); }, clearExpressions(options = {}) { activeExpressions.clearAll(options); },
    /** Targets that were asked for. `getExpressionWeights()` is what is showing. */
    getExpressions() { return activeExpressions.targets(); },
    getExpressionWeights() { return activeExpressions.values(); },
    isSettled() { return activeExpressions.settled() && motionLayer.settled() && !transition; },
    trigger(type, detail = {}) { return triggerAt(typeof type === 'string' ? { ...detail, type } : type); },
    fire(id) { return reactionController.fire(id, seconds(now())); },
    getActiveReaction() { return reactionController.getActive(); },
    clearReactions() { reactionController.reset(); },
    getReactions() { return reactions.map((item) => ({ id: item.id, name: item.name, trigger: { ...item.trigger }, enabled: item.enabled })); },
    /**
     * Cross-fade to a motion from whatever is playing. `layer: true` runs it
     * alongside instead; `fade` / `easing` override the rig's `motionBlend`
     * for this call (docs/ADR_MOTION_LAYERING.md).
     */
    playAnimation(id, options = {}) { return motionLayer.play(id, seconds(now()), options); },
    stopAnimation(id, options) { return motionLayer.stop(id, options); },
    getAnimation() { return motionLayer.active(); },
    /** Every motion still on screen, with the weight it is showing at. */
    getMotionWeights() { return motionLayer.values(); },
    getAnimations() { return animations.map((item) => ({ id: item.id, name: item.name, duration: item.duration, loop: item.loop })); },
    bindEvents(target = svgRoot) {
      const onClick = () => triggerAt({ type: 'click' }), onEnter = () => triggerAt({ type: 'hover' });
      target?.addEventListener?.('click', onClick); target?.addEventListener?.('pointerenter', onEnter);
      return () => { target?.removeEventListener?.('click', onClick); target?.removeEventListener?.('pointerenter', onEnter); };
    },
    setHandInertiaEnabled(side, enabled) { const entry = handInertia?.[side]; if (!entry) return false; entry.group.configure({ enabled: Boolean(enabled) }); return true; },
    start() { if (!raf) { started = now(); last = 0; behaviorController.reset(); followerGroup.reset(); controlRig.reset(); Object.values(handInertia || {}).forEach((entry) => entry.group.reset());const token=++generation;raf=requestFrame(timestamp=>tick(timestamp,token)); } }, stop() { generation++;if (raf) cancelFrame(raf); raf = 0; behaviorController.reset(); },
    getParams() { return { ...composed(now()), ...overrides }; },
    /**
     * The same pose after the solvers, which is what the artwork is showing.
     *
     * `getParams()` stays the authored truth -- a gaze that turns the head
     * must never look like the author keyed a head turn (docs/FACE_CONTROL_RIG.md).
     */
    getEffectiveParams() { return { ...controlRig.peek({ ...composed(now()), ...overrides }) }; },
    /** What the solvers are adding right now: eye, head, lids, and the angles. */
    getControlRigContribution() { return controlRig.contribution; },

    /* ── Friendly aliases (docs/RUNTIME_API.md) ─────────────────────────── */

    /** Same as `setParam`, spelled the way the public API documents it. */
    setParameter(key, value) { return this.setParam(key, value); },
    clearParameter(key) { return this.clearParam(key); },
    /** Same as `playAnimation`: a motion is what an author calls a clip. */
    playMotion(id, options) { return this.playAnimation(id, options); },
    stopMotion(id, options) { return this.stopAnimation(id, options); },
    getMotions() { return this.getAnimations(); },
    /** Fire a reaction by id, or by the event that triggers it. */
    triggerReaction(idOrEvent, detail) {
      return typeof idOrEvent === 'string' && reactions.some((item) => item.id === idOrEvent)
        ? this.fire(idOrEvent) : this.trigger(idOrEvent, detail);
    },
    /** Raise a hand pose directly, without going through a reaction. */
    setHandPose(side, poseId, weight = 1) {
      const hand = hands?.[side];
      if (!hand?.poses.some((pose) => pose.id === poseId)) return false;
      return this.setParam(handPoseParameterName(side, poseId), clamp(finite(weight, 1), 0, 1));
    },
    getHandPoses(side) { return (hands?.[side]?.poses || []).map((pose) => ({ id: pose.id, name: pose.name })); }
  };
}

/**
 * Load a mascot into a page: the artwork, the rig, and a running engine.
 *
 * ```js
 * const mascot = await BoopMascot.load({ mount: '#mascot', svg: 'mascot.svg', rig: 'rig.json' });
 * mascot.setExpression('happy');
 * mascot.playMotion('wave');
 * mascot.triggerReaction('hello');
 * mascot.setParameter('headX', 0.5);
 * ```
 *
 * `svg` and `rig` may each be a URL or the value itself, so a page that already
 * has the markup inline does not have to fetch anything.
 */
export async function load({ mount, svg, rig, autoStart = true, bindEvents = true, ...options } = {}) {
  const host = typeof mount === 'string' ? document.querySelector(mount) : mount;
  if (!host) throw new Error(`Boop: no element matches "${mount}".`);
  const markup = typeof svg === 'string' && !svg.trim().startsWith('<') ? await (await fetch(svg)).text() : svg;
  const model = typeof rig === 'string' ? await (await fetch(rig)).json() : rig;
  if (typeof markup === 'string') host.innerHTML = markup;
  const svgRoot = host.querySelector('svg') || host;
  const engine = createMascotEngine({ svgRoot, rig: model, ...options });
  if (bindEvents) engine.unbindEvents = engine.bindEvents(svgRoot);
  if (autoStart) engine.start();
  return engine;
}

function morphPath(a, b, t) {
  const aa = String(a || '').replace(/,/g, ' ').trim().split(/\s+/), bb = String(b || '').replace(/,/g, ' ').trim().split(/\s+/);
  if (aa.length !== bb.length) return a;
  return aa.map((v, i) => Number.isFinite(Number(v)) && Number.isFinite(Number(bb[i])) ? Number(v) + (Number(bb[i]) - Number(v)) * t : v).join(' ');
}
