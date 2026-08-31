import { evaluateBinding } from '../bindings/expression.js';
import { applyCurve } from '../bindings/curve.js';
import { morphPath } from '../morph/path-morph.js';
import { clampByConstraints } from '../rig/constraints.js';

export function compileFrame(elements, params, globalConstraints = { translate: 1, rotate: 1, scale: 1 }, stateConstraints = { translate: 1, rotate: 1, scale: 1 }) {
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
      x: tx * (globalConstraints.translate ?? 1) * (stateConstraints.translate ?? 1),
      y: element.y * (globalConstraints.translate ?? 1) * (stateConstraints.translate ?? 1),
      rotation: element.rotation * (globalConstraints.rotate ?? 1) * (stateConstraints.rotate ?? 1),
      scaleX: element.scaleX * (globalConstraints.scale ?? 1) * (stateConstraints.scale ?? 1),
      scaleY: element.scaleY * (globalConstraints.scale ?? 1) * (stateConstraints.scale ?? 1)
    }, element.constraints || { translate: true, rotate: true, scale: true });
  });

  return { transforms, paths };
}
