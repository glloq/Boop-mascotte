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

  const applyCurve = (value, curve = 'linear') => {
    const t = Math.max(-1, Math.min(1, value));
    if (curve !== 'easeInOut') return t;
    const s = (t + 1) / 2;
    return (s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2) * 2 - 1;
  };

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

  const safeEval = (expr, scope) => {
    const tk = (expr || '0').match(/[A-Za-z_]\w*|\d+(?:\.\d+)?|[()+\-*/]/g) || [];
    const out = [], ops = [], p = { '+': 1, '-': 1, '*': 2, '/': 2 };
    tk.forEach((t) => {
      if (!Number.isNaN(Number(t)) || /^[A-Za-z_]/.test(t)) return out.push(t);
      if (t === '(') return ops.push(t);
      if (t === ')') { while (ops.length && ops.at(-1) !== '(') out.push(ops.pop()); ops.pop(); return; }
      while (ops.length && p[ops.at(-1)] >= p[t]) out.push(ops.pop());
      ops.push(t);
    });
    while (ops.length) out.push(ops.pop());
    const st = [];
    out.forEach((t) => {
      if (!Number.isNaN(Number(t))) return st.push(Number(t));
      if (/^[A-Za-z_]/.test(t)) return st.push(Number(scope[t] || 0));
      const b = st.pop() || 0, a = st.pop() || 0;
      st.push(t === '+' ? a + b : t === '-' ? a - b : t === '*' ? a * b : b === 0 ? 0 : a / b);
    });
    return Number(st[0] || 0);
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

      Object.entries(rig.elements || {}).forEach(([id, element]) => {
        const node = nodes[id];
        if (!node) return;
        if (element.morph?.enabled && element.morph?.pathA && element.morph?.pathB && node.tagName === 'path') {
          const raw = Number(params[element.morph.param || 'mouthOpen'] ?? 0);
          const t = Math.max(0, Math.min(1, (raw - (element.morph.min ?? -1)) / ((element.morph.max ?? 1) - (element.morph.min ?? -1) || 1)));
          node.setAttribute('d', morphPath(element.morph.pathA, element.morph.pathB, t));
        }
        const rawX = safeEval(element.bindings?.translateX || '0', params);
        const x = applyCurve(rawX, element.bindingCurves?.translateX || 'linear');
        writeTransform(node, id, { ...element, x: element.constraints?.translate === false ? 0 : x });
      });
    }
    raf = requestAnimationFrame(tick);
  }

  return {
    setParam: (key, value) => { params[key] = value; },
    setState: (name) => { activeState = name; },
    start: () => { if (!raf) raf = requestAnimationFrame(tick); },
    stop: () => { cancelAnimationFrame(raf); raf = 0; }
  };
}
