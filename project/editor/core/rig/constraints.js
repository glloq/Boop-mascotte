export function clampByConstraints(transform, constraints) {
  return {
    ...transform,
    x: constraints.translate ? transform.x : 0,
    y: constraints.translate ? transform.y : 0,
    rotation: constraints.rotate ? transform.rotation : 0,
    scaleX: constraints.scale ? transform.scaleX : 1,
    scaleY: constraints.scale ? transform.scaleY : 1
  };
}
