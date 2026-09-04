/** A scale of 0 collapses the part; only a missing or broken number falls back to 1. */
const channel = (value, fallback) => (value == null || !Number.isFinite(Number(value)) ? fallback : Number(value));

export function applyTransform(node, t) {
  node.style.transformOrigin = `${channel(t.pivotX, 0)}px ${channel(t.pivotY, 0)}px`;
  node.style.transform = `translate(${channel(t.x, 0)}px, ${channel(t.y, 0)}px) rotate(${channel(t.rotation, 0)}deg) scale(${channel(t.scaleX, 1)}, ${channel(t.scaleY, 1)})`;
}
