export function applyTransform(node, t) {
  node.style.transformOrigin = `${t.pivotX || 0}px ${t.pivotY || 0}px`;
  node.style.transform = `translate(${t.x || 0}px, ${t.y || 0}px) rotate(${t.rotation || 0}deg) scale(${t.scaleX || 1}, ${t.scaleY || 1})`;
}
