export function mirrorTransformX(source, centerX = 120) {
  const delta = source.x - centerX;
  return {
    ...source,
    x: centerX - delta,
    rotation: -source.rotation
  };
}
