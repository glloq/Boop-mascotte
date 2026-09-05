import test from 'node:test';
import assert from 'node:assert/strict';
import { SvgDocument } from '../svg-document/svg-document.js';
import { createProjectSnapshot, applyProjectSnapshot } from '../state/project-snapshot.js';
import { createInitialState } from '../state/store.js';

class FakeNode {
  constructor(tag, attrs = {}, children = []) { this.localName = tag; this.attrs = { ...attrs }; this.children = []; children.forEach((child) => this.appendChild(child)); }
  get parentNode() { return this._parent || null; }
  get nextSibling() { const list = this._parent?.children || []; return list[list.indexOf(this) + 1] || null; }
  get previousElementSibling() { const list = this._parent?.children || []; return list[list.indexOf(this) - 1] || null; }
  getAttribute(name) { return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null; }
  hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  removeAttribute(name) { delete this.attrs[name]; }
  appendChild(node) { node._parent = this; this.children.push(node); return node; }
  insertBefore(node, reference) { if (node._parent) node._parent.children.splice(node._parent.children.indexOf(node), 1); node._parent = this; const index = reference ? this.children.indexOf(reference) : -1; this.children.splice(index < 0 ? this.children.length : index, 0, node); }
  cloneNode(deep) { return new FakeNode(this.localName, this.attrs, deep ? this.children.map((child) => child.cloneNode(true)) : []); }
}
const serialize = (node) => `<${node.localName}${Object.entries(node.attrs).map(([key, value]) => ` ${key}="${value}"`).join('')}>${node.children.map(serialize).join('')}</${node.localName}>`;
const el = (tag, attrs, children) => new FakeNode(tag, attrs, children);

test('generated ids are deterministic and duplicate ids are resolved', () => {
  const root = el('svg', {}, [el('g', {}, [el('path', { id: 'eye' }), el('path', { id: 'eye' }), el('rect')])]);
  const document = new SvgDocument({ serializer: serialize });
  document.load(root);
  assert.deepEqual(document.getTree()[0].children.map((node) => node.id), ['eye', 'eye-2', 'rect-1']);
  assert.equal(document.getTree()[0].id, 'g-1');
  assert.match(document.warnings[0], /eye-2/);
  assert.equal(document.serialize(), document.serialize());
});

test('nested hierarchy, same-parent reorder, visibility, lock and display names round-trip', () => {
  const root = el('svg', { viewBox: '0 0 10 10' }, [el('defs', {}, [el('linearGradient', { id: 'gradient' })]), el('g', { id: 'head' }, [el('circle', { id: 'a' }), el('path', { id: 'b', d: 'M0 0' }), el('rect', { id: 'c' })])]);
  const document = new SvgDocument({ serializer: serialize });
  document.load(root);
  assert.equal(document.getTree().length, 1, 'defs is preserved but not exposed as a layer');
  assert.equal(document.reorder('c', 'up'), true);
  document.setVisibility('b', false);
  document.setLocked('b', true);
  document.setName('b', 'Friendly mouth');
  const tree = document.getTree();
  assert.deepEqual(tree[0].children.map((node) => node.id), ['a', 'c', 'b']);
  assert.equal(tree[0].children[2].visible, false);
  assert.equal(tree[0].children[2].locked, true);
  assert.equal(tree[0].children[2].name, 'Friendly mouth');
  assert.match(document.serialize(), /linearGradient/);
  assert.match(document.serialize(), /id="b" d="M0 0" display="none"/);
});

test('preview transforms, opacity and morph geometry never enter author serialization', () => {
  const path = el('path', { id: 'mouth', d: 'M0 0', transform: 'translate(10)', opacity: '.5' });
  const document = new SvgDocument({ serializer: serialize });
  document.load(el('svg', {}, [path]));
  path.setAttribute('d', 'M99 99'); path.setAttribute('transform', 'translate(30)'); path.setAttribute('opacity', '.2');
  const output = document.serialize();
  assert.match(output, /d="M0 0"/); assert.match(output, /translate\(10\)/); assert.match(output, /opacity="\.5"/);
  assert.doesNotMatch(output, /M99|translate\(30\)|\.2/);
});

test('the identity transform and a full opacity the canvas writes stay out of the file', () => {
  const still = el('path', { id: 'still', d: 'M0 0', transform: 'translate(0 0) rotate(0 12 8) translate(12 8) scale(1 1) translate(-12 -8)', opacity: '1' });
  const moved = el('path', { id: 'moved', d: 'M0 0', transform: 'translate(0 0) rotate(15 12 8) translate(12 8) scale(1 1) translate(-12 -8)', opacity: '1' });
  const matrix = el('g', { id: 'flat', transform: 'matrix(1 0 0 1 0 0)' }, [el('path', { id: 'inner', d: 'M1 1', transform: 'matrix(1 0 0 1 4 0)' })]);
  const document = new SvgDocument({ serializer: serialize });
  document.load(el('svg', {}, [still, moved, matrix]));
  const output = document.serialize();
  assert.match(output, /<path id="still" d="M0 0"><\/path>/, 'an unmoved piece carries no transform and no opacity');
  assert.match(output, /id="moved"[^>]*rotate\(15 12 8\)/, 'a rotated piece keeps its transform');
  assert.doesNotMatch(output, /id="moved"[^>]*opacity=/);
  assert.match(output, /<g id="flat"><path id="inner" d="M1 1" transform="matrix\(1 0 0 1 4 0\)"><\/path><\/g>/);
});

test('project snapshot preserves current SVG and editor-only layer metadata without putting it in rig', () => {
  const state = createInitialState();
  state.svgMarkup = '<svg><path id="old"/></svg>'; state.layerMetadata = { eye: { name: 'Left Eye', locked: true } };
  const snapshot = createProjectSnapshot(state, () => '<svg><path id="current"/></svg>');
  assert.match(snapshot.document.svgMarkup, /current/);
  assert.equal(snapshot.document.rig.layerMetadata, undefined);
  const restored = createInitialState(); applyProjectSnapshot(restored, snapshot);
  assert.deepEqual(restored.layerMetadata, state.layerMetadata);
});
