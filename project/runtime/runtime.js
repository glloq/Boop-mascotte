export const RIG_SCHEMA_VERSION = 3;
export const BINDING_PROPERTIES = ['translateX', 'translateY', 'rotation', 'scaleX', 'scaleY', 'opacity'];
export const CURVES = ['linear', 'easeIn', 'easeOut', 'easeInOut'];

const expressionCache = new Map();

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

export function evaluateRigBinding(binding, params, legacyCurve) {
  const normalized = normalizeBinding(binding, legacyCurve);
  if (!normalized.enabled) return 0;
  return curveValue(evaluateExpression(normalized.expression, parameterValues(params)), normalized.curve)
    * normalized.amplitude + normalized.offset;
}

export function compileRigFrame(elements = {}, params = {}, globalConstraints = {}, stateConstraints = {}) {
  const frame = {}, values = parameterValues(params);
  for (const [id, element] of Object.entries(elements)) {
    const base = element.baseTransform || element;
    const enabled = element.constraints || {};
    const g = globalConstraints || {}, s = stateConstraints || {};
    const factor = (category) => finite(g[category], 1) * finite(s[category], 1);
    const value = (property) => evaluateRigBinding(element.bindings?.[property], values, element.bindingCurves?.[property]);
    const tx = enabled.translate === false ? 0 : value('translateX') * factor('translate');
    const ty = enabled.translate === false ? 0 : value('translateY') * factor('translate');
    const rotation = enabled.rotate === false ? 0 : value('rotation') * factor('rotate');
    const sx = enabled.scale === false || !element.bindings?.scaleX ? 1 : value('scaleX') * factor('scale');
    const sy = enabled.scale === false || !element.bindings?.scaleY ? 1 : value('scaleY') * factor('scale');
    const morph = element.morph?.enabled ? compileMorph(element.morph, values) : null;
    frame[id] = {
      transform: {
        x: finite(base.x, 0) + tx, y: finite(base.y, 0) + ty,
        rotation: finite(base.rotation, 0) + rotation,
        scaleX: finite(base.scaleX, 1) * sx, scaleY: finite(base.scaleY, 1) * sy,
        pivotX: finite(base.pivotX ?? element.pivotX, 0), pivotY: finite(base.pivotY ?? element.pivotY, 0)
      },
      opacity: clamp(finite(element.baseOpacity ?? element.opacity, 1) * (!element.bindings?.opacity ? 1 : value('opacity')), 0, 1),
      morph
    };
  }
  return frame;
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

function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function createMascotEngine({ svgRoot, rig, fps = 20, random = Math.random }) {
  const initial = resolveStateParams(rig.params, rig.states?.[rig.activeState]);
  let stateParams = { ...initial }, activeState = rig.activeState || Object.keys(rig.states || {})[0];
  const overrides = {}, behaviors = normalizeBehaviors(rig), behaviorState = new Map(); let transition = null, raf = 0, last = 0, started = 0;
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
  function tick(now) {
    if (now - last >= 1000 / fps) {
      last = now;
      const controlled = { ...paramsAt(now), ...overrides };
      const elapsed = (now - started) / 1000;
      const activeBlink = behaviors.find((behavior) => behavior.enabled && behavior.type === 'blink' && behaviorValue(behavior, elapsed).blink);
      const randomIdle = behaviors.find((behavior) => behavior.enabled && behavior.type === 'randomIdle');
      const effective = composeBehaviorParams(controlled, behaviors, elapsed, {
        blinkActive: Boolean(activeBlink), randomValue: randomIdle ? behaviorValue(randomIdle, elapsed).randomValue : undefined
      });
      const frame = compileRigFrame(rig.elements, effective, rig.globalConstraints, rig.stateConstraints?.[activeState]);
      Object.entries(frame).forEach(([id, item]) => {
        const node = nodes.get(id); if (!node) return;
        const t = item.transform;
        node.setAttribute('transform', `translate(${t.x} ${t.y}) rotate(${t.rotation} ${t.pivotX} ${t.pivotY}) translate(${t.pivotX} ${t.pivotY}) scale(${t.scaleX} ${t.scaleY}) translate(${-t.pivotX} ${-t.pivotY})`);
        node.setAttribute('opacity', String(item.opacity));
        if (item.morph && node.tagName.toLowerCase() === 'path') node.setAttribute('d', morphPath(item.morph.pathA, item.morph.pathB, item.morph.progress));
      });
    }
    raf = requestAnimationFrame(tick);
  }
  function behaviorValue(behavior, now) {
    let state = behaviorState.get(behavior.id);
    if (!state) {
      state = { next: now + randomDelay(behavior), blinkUntil: -1, randomValue: 0 };
      behaviorState.set(behavior.id, state);
    }
    if (now >= state.next) {
      if (behavior.type === 'blink') state.blinkUntil = now + behavior.duration;
      if (behavior.type === 'randomIdle') state.randomValue = behavior.min + random() * (behavior.max - behavior.min);
      state.next = now + randomDelay(behavior);
    }
    return { blink: now < state.blinkUntil, randomValue: state.randomValue };
  }
  function randomDelay(behavior) {
    const min = Math.min(behavior.intervalMin, behavior.intervalMax), max = Math.max(behavior.intervalMin, behavior.intervalMax);
    return min + random() * (max - min);
  }
  return { setParam(key, value) { if (!(key in (rig.params || {}))) return false; overrides[key] = finite(value, stateParams[key]); return true; },
    clearParam(key) { return delete overrides[key]; }, clearParams() { Object.keys(overrides).forEach((key) => delete overrides[key]); },
    setState(name) { if (!rig.states?.[name] || !canTransition(rig.transitions, activeState, name)) return false;
      const now = performance.now(), from = paramsAt(now), to = resolveStateParams(rig.params, rig.states[name]);
      const settings = rig.transitionSettings?.[`${activeState}->${name}`] || {};
      const duration = Math.max(1, finite(settings.duration, 300));
      activeState = name;
      if (!duration) { stateParams = to; transition = null; } else transition = { from, to, started: now, duration, easing: CURVES.includes(settings.easing) ? settings.easing : 'easeInOut' };
      return true; },
    setBehaviorEnabled(id, enabled) { const behavior = behaviors.find((item) => item.id === id); if (!behavior) return false; behavior.enabled = Boolean(enabled); return true; },
    start() { if (!raf) { started = performance.now(); last = 0; behaviorState.clear(); raf = requestAnimationFrame(tick); } }, stop() { if (raf) cancelAnimationFrame(raf); raf = 0; behaviorState.clear(); },
    getParams() { return { ...paramsAt(performance.now()), ...overrides }; } };
}

function morphPath(a, b, t) {
  const aa = String(a || '').replace(/,/g, ' ').trim().split(/\s+/), bb = String(b || '').replace(/,/g, ' ').trim().split(/\s+/);
  if (aa.length !== bb.length) return a;
  return aa.map((v, i) => Number.isFinite(Number(v)) && Number.isFinite(Number(bb[i])) ? Number(v) + (Number(bb[i]) - Number(v)) * t : v).join(' ');
}
