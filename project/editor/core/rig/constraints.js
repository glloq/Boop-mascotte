export function applyAnimationConstraints(base, animation, constraints = {}) {
  return {
    ...base,
    x: finite(base.x, 0) + (constraints.translate === false ? 0 : finite(animation.x, 0)),
    y: finite(base.y, 0) + (constraints.translate === false ? 0 : finite(animation.y, 0)),
    rotation: finite(base.rotation, 0) + (constraints.rotate === false ? 0 : finite(animation.rotation, 0)),
    scaleX: finite(base.scaleX, 1) * (constraints.scale === false ? 1 : finite(animation.scaleX, 1)),
    scaleY: finite(base.scaleY, 1) * (constraints.scale === false ? 1 : finite(animation.scaleY, 1))
  };
}

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
