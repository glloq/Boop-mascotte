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
import { createInertiaGroup } from './inertia.js';
export {
  normalizeHands, normalizeHand, normalizeHandPose, normalizeHandInertia, evaluateHands,
  handOffset, softenReach, anchorDrift, applyElementTransform, handMotionParameters, HAND_SIDES
} from './hands.js';
export { createSpringFollower, createInertiaGroup, DEFAULT_INERTIA } from './inertia.js';
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

/** Channels whose keyform output adds to the binding result. The rest multiply. */
export const ADDITIVE_KEYFORM_CHANNELS = Object.freeze(['translateX', 'translateY', 'rotation']);

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

export function normalizeBehavior(source = {}) {
  const type = ['blink', 'randomIdle', 'oscillator'].includes(source.type) ? source.type : 'oscillator';
  return { id: source.id || `${type}-${Math.random().toString(36).slice(2, 8)}`, type,
    name: source.name || ({ blink: 'Blink', randomIdle: 'Random idle', oscillator: 'Oscillator' }[type]), enabled: source.enabled !== false,
    parameter: source.parameter || (type === 'blink' ? 'eyeOpen' : 'headY'), amplitude: finite(source.amplitude, .05), offset: finite(source.offset, 0),
    frequency: Math.max(0, finite(source.frequency ?? source.speed, .3)), waveform: 'sine', intervalMin: Math.max(0, finite(source.intervalMin, 2)),
    intervalMax: Math.max(0, finite(source.intervalMax, 6)), duration: Math.max(.01, finite(source.duration, .12)), closedValue: finite(source.closedValue, 0),
    min: finite(source.min, -.2), max: finite(source.max, .2) };
}

export function composeBehaviorParams(base, behaviors, time, runtime = {}) {
  const result = { ...base };
  for (const behavior of behaviors || []) {
    if (!behavior.enabled || !(behavior.parameter in result)) continue;
    if (behavior.type === 'oscillator') result[behavior.parameter] += behavior.offset + Math.sin(time * Math.PI * 2 * behavior.frequency) * behavior.amplitude;
    if (behavior.type === 'blink' && runtime.blinkActive) result[behavior.parameter] = behavior.closedValue;
    if (behavior.type === 'randomIdle' && Number.isFinite(runtime.randomValue)) result[behavior.parameter] += runtime.randomValue;
  }
  return result;
}

/** Stateful scheduler shared by editor preview and the standalone runtime. */
export function createBehaviorController({ random = Math.random } = {}) {
  const states = new Map();
  const delay = (behavior) => {
    const min = Math.min(behavior.intervalMin, behavior.intervalMax), max = Math.max(behavior.intervalMin, behavior.intervalMax);
    return min + random() * (max - min);
  };
  return {
    evaluate(behaviors, now) {
      let blinkActive = false, randomValue;
      const liveIds = new Set((behaviors || []).map((behavior) => behavior.id));
      for (const id of states.keys()) if (!liveIds.has(id)) states.delete(id);
      for (const behavior of behaviors || []) {
        if (!behavior.enabled || !['blink', 'randomIdle'].includes(behavior.type)) continue;
        let state = states.get(behavior.id);
        if (!state) { state = { next: now + delay(behavior), blinkUntil: -1, randomValue: 0 }; states.set(behavior.id, state); }
        if (now >= state.next) {
          if (behavior.type === 'blink') state.blinkUntil = now + behavior.duration;
          else state.randomValue = behavior.min + random() * (behavior.max - behavior.min);
          state.next = now + delay(behavior);
        }
        if (behavior.type === 'blink') blinkActive ||= now < state.blinkUntil;
        else randomValue = state.randomValue;
      }
      return { blinkActive, randomValue };
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
  const shapes = shapeKeyIndex(options.shapeKeys, elements);
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
    const pose = { translateX: 0, translateY: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1 };
    if (targeted) for (const compiled of targeted) {
      const resolved = evaluateCompiledKeyform(compiled, values);
      if (compiled.channel === 'pathShape') {
        if (!compiled.shapeKey) continue;
        shapeWeights ||= {};
        shapeWeights[compiled.shapeKey] = finite(shapeWeights[compiled.shapeKey], 0) + resolved;
      } else if (ADDITIVE_KEYFORM_CHANNELS.includes(compiled.channel)) pose[compiled.channel] += resolved;
      else pose[compiled.channel] *= resolved;
    }
    const tx = enabled.translate === false ? 0 : (value('translateX') + pose.translateX) * factor('translate');
    const ty = enabled.translate === false ? 0 : (value('translateY') + pose.translateY) * factor('translate');
    const rotation = enabled.rotate === false ? 0 : (value('rotation') + pose.rotation) * factor('rotate');
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
  }
  // Hands hang off an anchor on the body, so they resolve once every element
  // they might follow has a frame (docs/HAND_RIGGING.md).
  if (options.hands) evaluateHands(options.hands, elements, frame, values);
  if (shapes) for (const [id, shapeTarget] of shapes.targets) {
    const entry = frame[id];
    if (!entry) continue;
    const weights = shapeTarget.scratchWeights;
    for (let k = 0; k < shapeTarget.keys.length; k += 1) {
      weights[k] = shapeKeyWeight(shapeTarget.keys[k], values, entry.shapeWeights, evaluateShapeDriver);
    }
    entry.path = evaluateShapeTarget(shapeTarget, weights);
  }
  return frame;
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
    result.push({ id: source.id, name: typeof source.name === 'string' && source.name ? source.name : source.id, duration, loop: Boolean(source.loop), tracks });
  }
  return result;
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
  const id = typeof source.id === 'string' && source.id ? source.id : `reaction-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id, name: typeof source.name === 'string' && source.name ? source.name : id, enabled: source.enabled !== false, trigger, expression, motion,
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
  const stay = {}, timers = new Map();
  const resolve = () => { const data = typeof source === 'function' ? source() : source; return { reactions: data?.reactions || [], clips: data?.clips || [] }; };
  function fire(id, at = 0) {
    const { reactions, clips } = resolve();
    const reaction = typeof id === 'object' && id ? id : reactions.find((item) => item.id === id);
    if (!reaction || !reaction.enabled) return false;
    if (active && active.phase !== 'release' && (reaction.interrupt === 'ignore' || reaction.priority < active.reaction.priority)) return false;
    if (reaction.expression && reaction.after === 'return') delete stay[reaction.expression.id];
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
    let params = {};
    if (active) {
      const { reaction, clip } = active, elapsed = Math.max(0, now - active.started), { attack, hold, release } = reaction.timing;
      const activeLength = Math.max(attack + hold, clip && !clip.loop ? clip.duration : 0);
      let phase, weight = 0;
      if (elapsed < attack) { phase = 'attack'; weight = attack ? easingValue(elapsed / attack, 'easeOut') : 1; }
      else if (elapsed < activeLength) { phase = 'hold'; weight = 1; }
      else if (reaction.after !== 'stay' && elapsed < activeLength + release) { phase = 'release'; weight = release ? 1 - easingValue((elapsed - activeLength) / release, 'easeIn') : 0; }
      else phase = 'done';
      if (phase === 'done') {
        if (reaction.after === 'stay' && reaction.expression) { stay[reaction.expression.id] = reaction.expression.weight; expressions[reaction.expression.id] = reaction.expression.weight; }
        active = null;
      } else {
        active.phase = phase; active.elapsed = elapsed;
        if (reaction.expression) expressions[reaction.expression.id] = Math.max(expressions[reaction.expression.id] || 0, reaction.expression.weight * weight);
        if (clip && (clip.loop ? elapsed < activeLength : elapsed <= clip.duration)) params = evaluateAnimationClip(clip, elapsed, base);
      }
    }
    return { expressions, params, active: active ? { id: active.reaction.id, phase: active.phase, elapsed: active.elapsed } : null };
  }
  return {
    fire, trigger, evaluate,
    getActive: () => (active ? { id: active.reaction.id, phase: active.phase, elapsed: active.elapsed } : null),
    getStayed: () => ({ ...stay }),
    clearStayed(id) { if (id === undefined) for (const key of Object.keys(stay)) delete stay[key]; else delete stay[id]; },
    cancel() { active = null; },
    reset() { active = null; for (const key of Object.keys(stay)) delete stay[key]; timers.clear(); }
  };
}

export function createMascotEngine({ svgRoot, rig, fps = 20, random = Math.random, requestFrame = requestAnimationFrame, cancelFrame = cancelAnimationFrame, now = () => performance.now() }) {
  const initial = resolveStateParams(rig.params, rig.states?.[rig.activeState]);
  let stateParams = { ...initial }, activeState = rig.activeState || Object.keys(rig.states || {})[0];
  const overrides = {}, behaviors = normalizeBehaviors(rig), behaviorController = createBehaviorController({ random }); let transition = null, raf = 0, last = 0, started = 0, generation = 0;
  const expressions = normalizeExpressions(rig), activeExpressions = {};
  // Reactions and animations (docs/ADR_REACTIONS.md): additive blocks, absent in older rigs.
  const animations = normalizeAnimations(rig), reactions = normalizeReactions(rig), reactionController = createReactionController({ reactions, clips: animations });
  // Compiled once at construction; the render loop never revisits the records.
  const keyforms = normalizeKeyforms(rig), shapeKeys = normalizeShapeKeys(rig), hands = normalizeHands(rig);
  // One follower group per hand: the two sides are tuned independently, and a
  // group with `enabled: false` is a pass-through (docs/HAND_RIGGING.md).
  const handInertia = hands ? Object.fromEntries(HAND_SIDES.filter((side) => hands[side])
    .map((side) => [side, { group: createInertiaGroup(hands[side].inertia), names: handMotionParameters(hands[side]) }])) : null;
  let animation = null;
  const seconds = (timestamp) => Math.max(0, (finite(timestamp, 0) - started) / 1000);
  const composed = (timestamp) => {
    let base = paramsAt(timestamp);
    const elapsed = seconds(timestamp);
    if (animation) {
      const time = elapsed - animation.started;
      if (animation.clip.loop || time <= animation.clip.duration) base = { ...base, ...evaluateAnimationClip(animation.clip, time, base) };
      else animation = null;
    }
    const reaction = reactionController.evaluate(elapsed, base);
    base = { ...base, ...reaction.params };
    const weights = { ...activeExpressions };
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
      const controlled = { ...composed(timestamp), ...overrides };
      const elapsed = (timestamp - started) / 1000;
      const effective = applyHandInertia(composeBehaviorParams(controlled, behaviors, elapsed, behaviorController.evaluate(behaviors, elapsed)), delta);
      const frame = compileRigFrame(rig.elements, effective, rig.globalConstraints, rig.stateConstraints?.[activeState], { keyforms, shapeKeys, hands });
      Object.entries(frame).forEach(([id, item]) => {
        const node = nodes.get(id); if (!node) return;
        const t = item.transform;
        const transform=`translate(${t.x} ${t.y}) rotate(${t.rotation} ${t.pivotX} ${t.pivotY}) translate(${t.pivotX} ${t.pivotY}) scale(${t.scaleX} ${t.scaleY}) translate(${-t.pivotX} ${-t.pivotY})`, opacity=String(item.opacity);
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
    setExpression(id, weight = 1) { if (!expressions.some((item) => item.id === id)) return false; const value = clamp(finite(weight, 1), 0, 1); if (value === 0) delete activeExpressions[id]; else activeExpressions[id] = value; return true; },
    clearExpression(id) { return delete activeExpressions[id]; }, clearExpressions() { Object.keys(activeExpressions).forEach((key) => delete activeExpressions[key]); },
    getExpressions() { return { ...activeExpressions }; },
    trigger(type, detail = {}) { return triggerAt(typeof type === 'string' ? { ...detail, type } : type); },
    fire(id) { return reactionController.fire(id, seconds(now())); },
    getActiveReaction() { return reactionController.getActive(); },
    clearReactions() { reactionController.reset(); },
    getReactions() { return reactions.map((item) => ({ id: item.id, name: item.name, trigger: { ...item.trigger }, enabled: item.enabled })); },
    playAnimation(id) { const clip = animations.find((item) => item.id === id); if (!clip) return false; animation = { clip, started: seconds(now()) }; return true; },
    stopAnimation() { const had = Boolean(animation); animation = null; return had; },
    getAnimation() { return animation ? animation.clip.id : null; },
    getAnimations() { return animations.map((item) => ({ id: item.id, name: item.name, duration: item.duration, loop: item.loop })); },
    bindEvents(target = svgRoot) {
      const onClick = () => triggerAt({ type: 'click' }), onEnter = () => triggerAt({ type: 'hover' });
      target?.addEventListener?.('click', onClick); target?.addEventListener?.('pointerenter', onEnter);
      return () => { target?.removeEventListener?.('click', onClick); target?.removeEventListener?.('pointerenter', onEnter); };
    },
    setHandInertiaEnabled(side, enabled) { const entry = handInertia?.[side]; if (!entry) return false; entry.group.configure({ enabled: Boolean(enabled) }); return true; },
    start() { if (!raf) { started = now(); last = 0; behaviorController.reset(); Object.values(handInertia || {}).forEach((entry) => entry.group.reset());const token=++generation;raf=requestFrame(timestamp=>tick(timestamp,token)); } }, stop() { generation++;if (raf) cancelFrame(raf); raf = 0; behaviorController.reset(); },
    getParams() { return { ...composed(now()), ...overrides }; } };
}

function morphPath(a, b, t) {
  const aa = String(a || '').replace(/,/g, ' ').trim().split(/\s+/), bb = String(b || '').replace(/,/g, ' ').trim().split(/\s+/);
  if (aa.length !== bb.length) return a;
  return aa.map((v, i) => Number.isFinite(Number(v)) && Number.isFinite(Number(bb[i])) ? Number(v) + (Number(bb[i]) - Number(v)) * t : v).join(' ');
}
