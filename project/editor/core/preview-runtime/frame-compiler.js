import { evaluateBinding } from '../bindings/expression.js';
import { applyCurve } from '../bindings/curve.js';
import { morphPath } from '../morph/path-morph.js';
import { clampByConstraints } from '../rig/constraints.js';

export function compileFrame(elements, params) {
  const transforms = {};
  const paths = {};

  Object.entries(elements).forEach(([id, element]) => {
    if (element.morph?.enabled && element.morph.pathA && element.morph.pathB) {
      const raw = Number(params[element.morph.param || 'mouthOpen'] ?? 0);
      const t = Math.max(0, Math.min(1, (raw - (element.morph.min ?? -1)) / ((element.morph.max ?? 1) - (element.morph.min ?? -1) || 1)));
      paths[id] = morphPath(element.morph.pathA, element.morph.pathB, t);
    }

    const rawTx = evaluateBinding(element.bindings?.translateX || '0', params);
    const tx = applyCurve(rawTx, element.bindingCurves?.translateX || 'linear');
    transforms[id] = clampByConstraints({
      ...element,
      x: tx,
      y: element.y,
      rotation: element.rotation,
      scaleX: element.scaleX,
      scaleY: element.scaleY
    }, element.constraints || { translate: true, rotate: true, scale: true });
  });

  return { transforms, paths };
}
