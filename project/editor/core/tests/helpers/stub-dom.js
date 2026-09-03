/**
 * The smallest DOM the selection overlay needs, so gizmo behaviour can be
 * tested with `node --test` instead of only in a browser. It is deliberately
 * minimal: anything the overlay starts relying on beyond this should be
 * visible here as a change, not silently absorbed.
 */
class StubElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this.hidden = false;
    this.parentNode = null;
    this.listeners = new Map();
    this._html = '';
  }
  /**
   * `innerHTML` is stored, not parsed: panel tests assert on the markup a panel
   * produces and drive it through synthesized events, which is what the panel
   * contract actually is. A real parser here would be a second, weaker browser.
   */
  set innerHTML(value) { this._html = String(value); }
  get innerHTML() { return this._html; }
  addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(handler); }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatch(type, event = {}) {
    const payload = { type, target: event.target || this, preventDefault() {}, stopPropagation() {}, ...event };
    for (const handler of this.listeners.get(type) || []) handler(payload);
    return payload;
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this); this.parentNode = null; }
  setPointerCapture() {}
  releasePointerCapture() {}
}

/**
 * A stand-in for the element a click landed on. `closest` answers from a plain
 * description of the button, which is all the panels ask of an event target.
 */
export function clickTarget({ tag = 'button', dataset = {}, value, checked, type } = {}) {
  const node = { tagName: String(tag).toUpperCase(), dataset, value, checked, type };
  const camel = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  node.matches = (selector) => {
    if (selector === tag || selector === node.tagName.toLowerCase()) return true;
    const attribute = selector.match(/^\[data-([\w-]+)\]$/);
    return Boolean(attribute && camel(attribute[1]) in dataset);
  };
  node.closest = (selector) => node.matches(selector) ? node : null;
  node.setPointerCapture = () => {};
  node.releasePointerCapture = () => {};
  return node;
}

export function installStubDom() {
  if (globalThis.document) return globalThis.document;
  globalThis.document = { createElementNS: (_namespace, tag) => new StubElement(tag) };
  return globalThis.document;
}
