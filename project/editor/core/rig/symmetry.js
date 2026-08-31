export function mirrorTransformX(source, centerX = 120) {
  const base = source.baseTransform || source;
  const delta = base.x - centerX;
  return {
    ...source,
    baseTransform: { ...base, x: centerX - delta, rotation: -base.rotation, pivotX: centerX - (base.pivotX - centerX) },
    bindings: structuredClone(source.bindings || {}), morph: structuredClone(source.morph || {})
  };
}
