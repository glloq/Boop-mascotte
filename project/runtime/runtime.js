export function canTransition(transitions, from, to) {
  const allowed = transitions?.[from];
  if (!Array.isArray(allowed) || !allowed.length) return true;
  return allowed.includes(to);
}

export function evaluateExpression(expr, scope = {}) {
  const source = String(expr || '0').trim();
  const tokens = source.match(/[A-Za-z_]\w*|(?:\d+\.?\d*|\.\d+)|[()+\-*/]/g) || [];
  if (!tokens.length || tokens.join('') !== source.replace(/\s+/g, '')) return 0;
  const output = [], operators = [], precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
  let expectsValue = true;
  for (const token of tokens) {
    if (!Number.isNaN(Number(token)) || /^[A-Za-z_]/.test(token)) { output.push(token); expectsValue = false; continue; }
    if (token === '(') { operators.push(token); expectsValue = true; continue; }
    if (token === ')') {
      while (operators.length && operators.at(-1) !== '(') output.push(operators.pop());
      if (operators.pop() !== '(') return 0;
      expectsValue = false; continue;
    }
    if (expectsValue && token === '-') output.push('0');
    else if (expectsValue) return 0;
    while (operators.length && precedence[operators.at(-1)] >= precedence[token]) output.push(operators.pop());
    operators.push(token); expectsValue = true;
  }
  if (expectsValue) return 0;
  while (operators.length) { const op = operators.pop(); if (op === '(') return 0; output.push(op); }
  const stack = [];
  for (const token of output) {
    if (!Number.isNaN(Number(token))) { stack.push(Number(token)); continue; }
    if (/^[A-Za-z_]/.test(token)) { const n = Number(scope[token]); stack.push(Number.isFinite(n) ? n : 0); continue; }
    if (stack.length < 2) return 0;
    const b = stack.pop(), a = stack.pop();
    const result = token === '+' ? a + b : token === '-' ? a - b : token === '*' ? a * b : b === 0 ? 0 : a / b;
    stack.push(Number.isFinite(result) ? result : 0);
  }
  return stack.length === 1 && Number.isFinite(stack[0]) ? stack[0] : 0;
}

export function curveValue(value, curve = 'linear') {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (curve !== 'easeInOut' || Math.abs(numeric) > 1) return numeric;
  const s = (numeric + 1) / 2;
  return (s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2) * 2 - 1;
}

export function createMascotEngine({ svgRoot, rig, fps = 20 }) {
  const lerp = (a, b, t) => a + (b - a) * t;
  const params = { ...(rig.params || {}) };
  const cfg = { blink: true, idleMotion: 0.15, ...(rig.runtimeConfig || {}) };
  const nodes = {};
  const applied = {};
  let activeState = rig.activeState || 'idle';
  let raf = 0;
  let last = 0;
  let phase = 0;

  Object.keys(rig.elements || {}).forEach((id) => { nodes[id] = svgRoot.querySelector(`#${id}`); });

  const morphPath = (a, b, t) => {
    const ta = (a || '').replace(/,/g, ' ').trim().split(/\s+/);
    const tb = (b || '').replace(/,/g, ' ').trim().split(/\s+/);
    if (ta.length !== tb.length) return a;
    return ta.map((v, i) => {
      const na = Number(v), nb = Number(tb[i]);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na + (nb - na) * t;
      return v === tb[i] ? v : v;
    }).join(' ');
  };

  const writeTransform = (node, id, t) => {
    const next = `translate(${t.x || 0}px, ${t.y || 0}px) rotate(${t.rotation || 0}deg) scale(${t.scaleX || 1}, ${t.scaleY || 1})`;
    if (applied[id] === next) return;
    node.style.transformOrigin = `${t.pivotX || 0}px ${t.pivotY || 0}px`;
    node.style.transform = next;
    applied[id] = next;
  };

  function tick(now) {
    if (now - last >= 1000 / fps) {
      last = now;
      phase += 0.06;
      const target = rig.states?.[activeState] || rig.params || {};
      Object.keys(target).forEach((k) => { params[k] = lerp(params[k] ?? target[k], target[k], 0.2); });
      if (cfg.blink) params.eyeOpen = Math.max(0, (params.eyeOpen ?? 1) - (Math.sin(phase * 2.3) > 0.97 ? 0.8 : 0));
      params.headY = (params.headY || 0) + Math.sin(phase) * cfg.idleMotion * 0.02;

      const gScale = rig.globalConstraints || { translate: 1, rotate: 1, scale: 1 };
      const sScale = rig.stateConstraints?.[activeState] || { translate: 1, rotate: 1, scale: 1 };
      Object.entries(rig.elements || {}).forEach(([id, element]) => {
        const node = nodes[id];
        if (!node) return;
        if (element.morph?.enabled && element.morph?.pathA && element.morph?.pathB && node.tagName === 'path') {
          const raw = Number(params[element.morph.param || 'mouthOpen'] ?? 0);
          const t = Math.max(0, Math.min(1, (raw - (element.morph.min ?? -1)) / ((element.morph.max ?? 1) - (element.morph.min ?? -1) || 1)));
          node.setAttribute('d', morphPath(element.morph.pathA, element.morph.pathB, t));
        }
        const rawX = evaluateExpression(element.bindings?.translateX || '0', params);
        const x = curveValue(rawX, element.bindingCurves?.translateX || 'linear');
        writeTransform(node, id, {
          ...element,
          x: (Number(element.x) || 0) + (element.constraints?.translate === false ? 0 : x * (gScale.translate ?? 1) * (sScale.translate ?? 1)),
          y: Number(element.y) || 0,
          rotation: Number(element.rotation) || 0,
          scaleX: Number(element.scaleX) || 1,
          scaleY: Number(element.scaleY) || 1
        });
      });
    }
    raf = requestAnimationFrame(tick);
  }

  return {
    setParam: (key, value) => { params[key] = value; },
    setState: (name) => {
      if (!rig.states?.[name]) return false;
      if (!canTransition(rig.transitions, activeState, name)) return false;
      activeState = name;
      return true;
    },
    start: () => { if (!raf) raf = requestAnimationFrame(tick); },
    stop: () => { cancelAnimationFrame(raf); raf = 0; }
  };
}
