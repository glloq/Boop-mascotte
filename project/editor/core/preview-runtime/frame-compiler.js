import { evaluateBinding } from '../bindings/expression.js';
import { applyCurve } from '../bindings/curve.js';
import { morphPath } from '../morph/path-morph.js';
import { applyAnimationConstraints } from '../rig/constraints.js';

export function compileFrame(elements = {}, params = {}, globalConstraints = {}, stateConstraints = {}) {
  const transforms = {};
  const paths = {};

  Object.entries(elements).forEach(([id, element]) => {
    if (element.morph?.enabled && element.morph.pathA && element.morph.pathB) {
      const raw = Number(params[element.morph.param || 'mouthOpen'] ?? 0);
      const t = Math.max(0, Math.min(1, (raw - (element.morph.min ?? -1)) / ((element.morph.max ?? 1) - (element.morph.min ?? -1) || 1)));
      try { paths[id] = morphPath(element.morph.pathA, element.morph.pathB, t); } catch { /* keep the original path */ }
    }

    const rawTx = evaluateBinding(element.bindings?.translateX || '0', params);
    const tx = applyCurve(rawTx, element.bindingCurves?.translateX || 'linear');
    transforms[id] = applyAnimationConstraints(element, {
      x: tx * finiteScale(globalConstraints.translate) * finiteScale(stateConstraints.translate),
      y: 0, rotation: 0, scaleX: 1, scaleY: 1
    }, element.constraints);
  });

  return { transforms, paths };
}

function finiteScale(value) {
  const number = Number(value ?? 1);
  return Number.isFinite(number) ? number : 1;
}
