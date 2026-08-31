import { evalExpr } from './expression-eval.js';
import { applyTransform } from './renderer.js';
import { lerp } from './interpolation.js';
import { getStateParams } from './state-machine.js';

export function createMascotEngine({ svgRoot, rig, fps = 20 }) {
  const params = { ...(rig.params || {}) };
  let activeState = rig.activeState || 'idle';
  let raf = 0;
  let last = 0;

  function tick(now) {
    if (now - last > 1000 / fps) {
      last = now;
      const target = getStateParams(rig, activeState);
      Object.keys(target).forEach((k) => {
        params[k] = lerp(params[k] ?? target[k], target[k], 0.2);
      });
      Object.entries(rig.elements || {}).forEach(([id, element]) => {
        const node = svgRoot.querySelector(`#${id}`);
        if (!node) return;
        const tx = evalExpr(element.bindings?.translateX || '0', params);
        const t = {
          ...element,
          x: (Number(element.x) || 0) + (element.constraints?.translate === false ? 0 : tx)
        };
        applyTransform(node, t);
      });
    }
    raf = requestAnimationFrame(tick);
  }

  return {
    setParam(key, value) { params[key] = value; },
    setState(next) { if (!rig.states?.[next]) return false; activeState = next; return true; },
    start() { if (!raf) raf = requestAnimationFrame(tick); },
    stop() { cancelAnimationFrame(raf); raf = 0; }
  };
}
