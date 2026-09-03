/**
 * The smallest DOM the selection overlay needs, so gizmo behaviour can be
 * tested with `node --test` instead of only in a browser. It is deliberately
 * minimal: anything the overlay starts relying on beyond this should be
 * visible here as a change, not silently absorbed.
 */
class StubElement {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this); this.parentNode = null; }
  setPointerCapture() {}
  releasePointerCapture() {}
}

export function installStubDom() {
  if (globalThis.document) return globalThis.document;
  globalThis.document = { createElementNS: (_namespace, tag) => new StubElement(tag) };
  return globalThis.document;
}
