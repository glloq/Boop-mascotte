export function createMascotEngine({ svgRoot, rig, fps = 20 }) {
  const lerp = (a, b, t) => a + (b - a) * t;
  const params = { ...(rig.params || {}) };
  let activeState = rig.activeState || 'idle';
  let raf = 0;
  let last = 0;

  const evalExpr = (expr, scope) => {
    try {
      const keys = Object.keys(scope);
      const fn = new Function(...keys, `return (${expr});`);
      return Number(fn(...keys.map((k) => scope[k]))) || 0;
    } catch {
      return 0;
    }
  };

  const applyCurve = (value, curve = 'linear') => {
    const t = Math.max(-1, Math.min(1, value));
    if (curve === 'easeInOut') {
      const s = (t + 1) / 2;
      const eased = s < 0.5 ? 2 * s * s : 1 - Math.pow(-2 * s + 2, 2) / 2;
      return eased * 2 - 1;
    }
    return t;
  };

  const applyTransform = (node, t) => {
    node.style.transformOrigin = `${t.pivotX || 0}px ${t.pivotY || 0}px`;
    node.style.transform = `translate(${t.x || 0}px, ${t.y || 0}px) rotate(${t.rotation || 0}deg) scale(${t.scaleX || 1}, ${t.scaleY || 1})`;
  };

  function tick(now) {
    if (now - last >= 1000 / fps) {
      last = now;
      const target = rig.states?.[activeState] || rig.params || {};
      Object.keys(target).forEach((k) => {
        params[k] = lerp(params[k] ?? target[k], target[k], 0.2);
      });
      Object.entries(rig.elements || {}).forEach(([id, element]) => {
        const node = svgRoot.querySelector(`#${id}`);
        if (!node) return;
        const rawX = evalExpr(element.bindings?.translateX || '0', params);
        const x = applyCurve(rawX, element.bindingCurves?.translateX || 'linear');
        applyTransform(node, {
          ...element,
          x: element.constraints?.translate === false ? 0 : x
        });
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
