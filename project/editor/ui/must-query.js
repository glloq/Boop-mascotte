export function mustQuery(root, selector) {
  const node = root?.querySelector(selector);
  if (!node) throw new Error(`Missing required UI element: ${selector}`);
  return node;
}
