import { composeBehaviorParams, normalizeBehaviors } from './behaviors.js';
export { composeBehaviorParams, normalizeBehaviors } from './behaviors.js';

export const RIG_SCHEMA_VERSION = 3;
export const BINDING_PROPERTIES = ['translateX', 'translateY', 'rotation', 'scaleX', 'scaleY', 'opacity'];
export const CURVES = ['linear', 'easeIn', 'easeOut', 'easeInOut'];

const expressionCache = new Map();

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

export function normalizeBinding(binding, legacyCurve = 'linear') {
  if (typeof binding === 'string' || typeof binding === 'number') {
    return { enabled: true, expression: String(binding), curve: legacyCurve, amplitude: 1, offset: 0 };
  }
  return {
    enabled: binding?.enabled !== false,
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
  const allowed = transitions?.[from];
  return !Array.isArray(allowed) || !allowed.length || allowed.includes(to);
}

export function resolveStateParams(params = {}, state = {}) {
  return Object.fromEntries(Object.entries(params).map(([name, param]) => {
    const fallback = typeof param === 'object' && param !== null ? finite(param.default, 0) : finite(param, 0);
    return [name, finite(state?.[name], fallback)];
  }));
}

function finite(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

export function createMascotEngine({ svgRoot, rig, fps = 20 }) {
  const params = parameterValues(rig.params), behaviors = normalizeBehaviors(rig); let activeState = rig.activeState || 'idle', raf = 0, last = 0, started = 0;
  const nodes = Object.fromEntries(Object.keys(rig.elements || {}).map((id) => [id, svgRoot.querySelector(`#${id}`)]));
  function tick(now) {
    if (now - last >= 1000 / fps) {
      last = now;
      const target = resolveStateParams(rig.params, rig.states?.[activeState]);
      Object.keys(target).forEach((key) => { params[key] += (target[key] - params[key]) * 0.2; });
      const effective = composeBehaviorParams(params, behaviors, (now - started) / 1000, { blinkActive: behaviors.some((b) => b.type === 'blink' && ((now / 1000) % Math.max(b.intervalMin, .2)) < b.duration) });
      const frame = compileRigFrame(rig.elements, effective, rig.globalConstraints, rig.stateConstraints?.[activeState]);
      Object.entries(frame).forEach(([id, item]) => {
        const node = nodes[id]; if (!node) return;
        const t = item.transform;
        node.style.transformOrigin = `${t.pivotX}px ${t.pivotY}px`;
        node.style.transform = `translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg) scale(${t.scaleX}, ${t.scaleY})`;
        node.style.opacity = item.opacity;
        if (item.morph && node.tagName.toLowerCase() === 'path') node.setAttribute('d', morphPath(item.morph.pathA, item.morph.pathB, item.morph.progress));
      });
    }
    raf = requestAnimationFrame(tick);
  }
  return { setParam(key, value) { if (key in params) params[key] = finite(value, params[key]); },
    setState(name) { if (!rig.states?.[name] || !canTransition(rig.transitions, activeState, name)) return false; activeState = name; return true; },
    setBehaviorEnabled(id, enabled) { const behavior = behaviors.find((item) => item.id === id); if (!behavior) return false; behavior.enabled = Boolean(enabled); return true; },
    start() { if (!raf) { started = performance.now(); raf = requestAnimationFrame(tick); } }, stop() { cancelAnimationFrame(raf); raf = 0; } };
}

function morphPath(a, b, t) {
  const aa = String(a || '').replace(/,/g, ' ').trim().split(/\s+/), bb = String(b || '').replace(/,/g, ' ').trim().split(/\s+/);
  if (aa.length !== bb.length) return a;
  return aa.map((v, i) => Number.isFinite(Number(v)) && Number.isFinite(Number(bb[i])) ? Number(v) + (Number(bb[i]) - Number(v)) * t : v).join(' ');
}
