export const LAYER_TAGS = new Set(['g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'image', 'use']);

const EDITOR_ATTRIBUTES = ['data-editor-selected', 'data-editor-preview', 'data-editor-handle'];

function childrenOf(node) {
  return Array.from(node?.children || []);
}

function tagOf(node) {
  return String(node?.localName || node?.tagName || '').toLowerCase().replace(/^.*:/, '');
}

function labelFromId(id) {
  return id.replace(/[-_.:]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** Browser-side model for the authoring SVG DOM. It never uses CSS id selectors. */
export class SvgDocument {
  constructor({ serializer } = {}) {
    this.root = null;
    this.warnings = [];
    this.metadata = {};
    this.authorAttributes = new Map();
    this.serializer = serializer || ((node) => new XMLSerializer().serializeToString(node));
  }

  load(root, metadata = {}) {
    if (!root || tagOf(root) !== 'svg') throw new Error('SvgDocument requires an SVG root element.');
    this.root = root;
    this.warnings = [];
    this.metadata = structuredClone(metadata || {});
    this.#normalizeIds();
    this.captureAuthoringState();
    return this.getTree();
  }

  #layerNodes() {
    const result = [];
    const visit = (parent) => childrenOf(parent).forEach((node) => {
      if (LAYER_TAGS.has(tagOf(node))) result.push(node);
      visit(node);
    });
    visit(this.root);
    return result;
  }

  #normalizeIds() {
    const used = new Set();
    const counters = {};
    this.#layerNodes().forEach((node) => {
      const type = tagOf(node) || 'layer';
      let id = node.getAttribute('id');
      if (!id) {
        counters[type] = (counters[type] || 0) + 1;
        id = `${type}-${counters[type]}`;
        while (used.has(id)) id = `${type}-${++counters[type]}`;
        node.setAttribute('id', id);
      } else if (used.has(id)) {
        let suffix = 2;
        while (used.has(`${id}-${suffix}`)) suffix += 1;
        const replacement = `${id}-${suffix}`;
        node.setAttribute('id', replacement);
        this.warnings.push(`Duplicate SVG id "${id}" renamed to "${replacement}".`);
        id = replacement;
      }
      used.add(id);
    });
  }

  getNode(id) {
    return this.#layerNodes().find((node) => node.getAttribute('id') === id) || null;
  }

  getTree() {
    const build = (node) => childrenOf(node).filter((child) => LAYER_TAGS.has(tagOf(child))).map((child) => {
      const id = child.getAttribute('id');
      const meta = this.metadata[id] || {};
      return {
        id,
        type: tagOf(child),
        name: meta.name || child.getAttribute('data-name') || labelFromId(id),
        visible: child.getAttribute('display') !== 'none',
        locked: Boolean(meta.locked),
        expanded: meta.expanded !== false,
        children: build(child)
      };
    });
    return build(this.root);
  }

  moveBefore(id, siblingId) { return this.#move(id, siblingId, false); }
  moveAfter(id, siblingId) { return this.#move(id, siblingId, true); }
  #move(id, siblingId, after) {
    const node = this.getNode(id);
    const sibling = this.getNode(siblingId);
    if (!node || !sibling || node.parentNode !== sibling.parentNode) return false;
    sibling.parentNode.insertBefore(node, after ? sibling.nextSibling : sibling);
    return true;
  }
  reorder(id, direction) {
    const node = this.getNode(id);
    if (!node) return false;
    const siblings = childrenOf(node.parentNode).filter((child) => LAYER_TAGS.has(tagOf(child)));
    const index = siblings.indexOf(node);
    const target = direction === 'up' ? siblings[index - 1] : siblings[index + 1];
    if (!target) return false;
    return direction === 'up' ? this.moveBefore(id, target.getAttribute('id')) : this.moveAfter(id, target.getAttribute('id'));
  }

  setVisibility(id, visible) {
    const node = this.getNode(id);
    if (!node) return false;
    if (visible) node.removeAttribute('display'); else node.setAttribute('display', 'none');
    this.captureAuthoringNode(id);
    return true;
  }
  setLocked(id, locked) {
    if (!this.getNode(id)) return false;
    this.metadata[id] = { ...(this.metadata[id] || {}), locked: Boolean(locked) };
    return true;
  }
  setName(id, name) {
    if (!this.getNode(id)) return false;
    this.metadata[id] = { ...(this.metadata[id] || {}), name: String(name || '').trim() || labelFromId(id) };
    return true;
  }
  setExpanded(id, expanded) {
    this.metadata[id] = { ...(this.metadata[id] || {}), expanded: Boolean(expanded) };
  }

  captureAuthoringNode(id) {
    const node = this.getNode(id);
    if (!node) return;
    this.authorAttributes.set(id, Object.fromEntries(['transform', 'd', 'opacity', 'display'].map((name) => [name, node.getAttribute(name)])));
  }
  captureAuthoringAttribute(id, name) {
    const node = this.getNode(id);
    if (!node) return;
    const current = this.authorAttributes.get(id) || {};
    this.authorAttributes.set(id, { ...current, [name]: node.getAttribute(name) });
  }
  captureAuthoringState() { this.#layerNodes().forEach((node) => this.captureAuthoringNode(node.getAttribute('id'))); }

  serialize() {
    if (!this.root) return '<svg xmlns="http://www.w3.org/2000/svg"/>';
    const clone = this.root.cloneNode(true);
    const cloned = new SvgDocument({ serializer: this.serializer });
    cloned.root = clone;
    this.authorAttributes.forEach((attributes, id) => {
      const node = cloned.getNode(id);
      if (!node) return;
      Object.entries(attributes).forEach(([name, value]) => value == null ? node.removeAttribute(name) : node.setAttribute(name, value));
    });
    const clean = [clone, ...childrenOfDeep(clone)];
    clean.forEach((node) => {
      EDITOR_ATTRIBUTES.forEach((name) => node.removeAttribute?.(name));
      // The canvas writes a full transform and opacity on every piece it
      // touches; the defaults are not authored data and stay out of the file.
      if (isIdentityTransform(node.getAttribute?.('transform'))) node.removeAttribute('transform');
      if (node.getAttribute?.('opacity') !== null && Number(node.getAttribute('opacity')) === 1) node.removeAttribute('opacity');
      const classes = (node.getAttribute?.('class') || '').split(/\s+/).filter((name) => name && !name.startsWith('svg_select_') && !name.startsWith('editor-'));
      if (node.hasAttribute?.('class')) classes.length ? node.setAttribute('class', classes.join(' ')) : node.removeAttribute('class');
    });
    return this.serializer(clone);
  }
}

const NUMBER = '(-?\\d*\\.?\\d+(?:e[-+]?\\d+)?)';
const COMPOSED = new RegExp(`^translate\\(${NUMBER}[ ,]+${NUMBER}\\)\\s*rotate\\(${NUMBER}(?:[ ,]+${NUMBER}[ ,]+${NUMBER})?\\)\\s*translate\\(${NUMBER}[ ,]+${NUMBER}\\)\\s*scale\\(${NUMBER}(?:[ ,]+${NUMBER})?\\)\\s*translate\\(${NUMBER}[ ,]+${NUMBER}\\)$`, 'i');

/**
 * Is this transform the one the canvas composes for a piece that has not moved?
 * `translate(0 0) rotate(0 px py) translate(px py) scale(1 1) translate(-px -py)`
 * is the identity whatever the pivot; so are the plain spellings of it.
 */
export function isIdentityTransform(value) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  if (/^(?:matrix\(\s*1[ ,]+0[ ,]+0[ ,]+1[ ,]+0[ ,]+0\s*\)|translate\(\s*0(?:[ ,]+0)?\s*\)|rotate\(\s*0(?:[ ,]+[-\d.]+[ ,]+[-\d.]+)?\s*\)|scale\(\s*1(?:[ ,]+1)?\s*\))$/i.test(text)) return true;
  const match = text.match(COMPOSED);
  if (!match) return false;
  const [, x, y, angle, , , px, py, sx, sy, nx, ny] = match.map((part) => (part === undefined ? undefined : Number(part)));
  return x === 0 && y === 0 && angle === 0 && sx === 1 && (sy === undefined || sy === 1) && px === -nx && py === -ny;
}

function childrenOfDeep(root) {
  const result = [];
  const visit = (node) => childrenOf(node).forEach((child) => { result.push(child); visit(child); });
  visit(root);
  return result;
}
