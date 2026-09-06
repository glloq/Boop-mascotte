import test from 'node:test';
import assert from 'node:assert/strict';
import { createPreviewOrder } from '../preview-runtime/preview-order.js';

/**
 * The paint order on the authoring canvas (docs/DEPTH_PARALLAX.md): borrowed
 * from the runtime's own draw order for the preview, and given back for as long
 * as the document is read or edited, so it never lands in `svgMarkup`.
 */
function node(localName, id = null) {
  const self = {
    localName, id, parentNode: null, children: [],
    get nextElementSibling() { const kids = self.parentNode?.children || []; return kids[kids.indexOf(self) + 1] || null; },
    append(...items) { for (const item of items) { item.parentNode = self; self.children.push(item); } return self; },
    insertBefore(item, before) {
      const at = self.children.indexOf(item);
      if (at >= 0) self.children.splice(at, 1);
      const index = before ? self.children.indexOf(before) : self.children.length;
      self.children.splice(index < 0 ? self.children.length : index, 0, item);
      item.parentNode = self;
      return item;
    },
    remove() { const kids = self.parentNode?.children; if (kids) kids.splice(kids.indexOf(self), 1); self.parentNode = null; }
  };
  return self;
}
const ids = (parent) => parent.children.map((child) => child.id);

function canvas(parallax = {}) {
  const root = node('svg', 'root');
  const parts = ['body', 'handLeft', 'face'].map((id) => node('g', id));
  root.append(...parts);
  const all = () => [root, ...root.children];
  const order = createPreviewOrder({ nodes: () => new Map(all().map((item) => [item.id, item])), ids: () => ['body', 'handLeft', 'face'], parallax: () => parallax });
  return { root, order, parts: Object.fromEntries(parts.map((part) => [part.id, part])) };
}

test('a frame\'s bands paint the canvas the way the exported mascot paints', () => {
  const { root, order } = canvas();
  assert.equal(order.borrowed(), false);
  order.draw({ body: 'normal', handLeft: 'normal', face: 'normal' });
  assert.deepEqual(ids(root), ['body', 'handLeft', 'face'], 'depths that say nothing leave the artwork alone');
  // The hand goes behind the body: it is repainted first.
  order.draw({ body: 'normal', handLeft: 'behind', face: 'normal' });
  assert.deepEqual(ids(root), ['handLeft', 'body', 'face']);
  assert.equal(order.borrowed(), true);
  // And forward again.
  order.draw({ handLeft: 'front' });
  assert.deepEqual(ids(root), ['body', 'face', 'handLeft']);
  order.draw({});
  assert.deepEqual(ids(root), ['body', 'handLeft', 'face']);
});

test('the document is always read in the artwork\'s own order, and the paint order comes straight back', () => {
  const { root, order } = canvas();
  order.draw({ handLeft: 'behind' });
  assert.deepEqual(ids(root), ['handLeft', 'body', 'face']);
  const seen = order.authored(() => ids(root));
  assert.deepEqual(seen, ['body', 'handLeft', 'face'], 'what serialize() and getTree() see');
  assert.deepEqual(ids(root), ['handLeft', 'body', 'face'], 'borrowed again the moment the read is over');
  // Reads nest -- refreshDocument() inside delete() -- and a frame drawn in the
  // middle of one waits for the outermost read to finish.
  const inner = order.authored(() => {
    order.draw({ handLeft: 'front' });
    assert.deepEqual(ids(root), ['body', 'handLeft', 'face'], 'a frame during a read does not move a node');
    return order.authored(() => ids(root));
  });
  assert.deepEqual(inner, ['body', 'handLeft', 'face']);
  assert.deepEqual(ids(root), ['body', 'face', 'handLeft'], 'the frame drawn during the read is what shows after it');
  // A throw inside the read still gives the order back.
  assert.throws(() => order.authored(() => { throw new Error('boom'); }), /boom/);
  assert.deepEqual(ids(root), ['body', 'face', 'handLeft']);
});

test('an edit made during a read is what the artwork keeps', () => {
  const { root, order, parts } = canvas();
  order.draw({ handLeft: 'behind' });
  // The author deletes the body while the hand is painted behind it.
  order.authored(() => { assert.deepEqual(ids(root), ['body', 'handLeft', 'face']); parts.body.remove(); });
  assert.deepEqual(ids(root), ['handLeft', 'face'], 'the hand is still painted first, among what is left');
  order.authored(() => assert.deepEqual(ids(root), ['handLeft', 'face']));
  // The artwork is rebuilt: nothing to give back, the next frame borrows anew.
  order.reset();
  assert.equal(order.borrowed(), false);
  order.draw({ handLeft: 'front' });
  assert.deepEqual(ids(root), ['face', 'handLeft']);
});

test('a rig that keeps its stacking is never touched, and switching it off gives the order back', () => {
  const off = canvas({ drawOrder: false });
  off.order.draw({ handLeft: 'behind' });
  assert.deepEqual(ids(off.root), ['body', 'handLeft', 'face']);
  assert.equal(off.order.borrowed(), false);
  const parallax = { drawOrder: true };
  const on = canvas(parallax);
  on.order.draw({ handLeft: 'behind' });
  assert.deepEqual(ids(on.root), ['handLeft', 'body', 'face']);
  parallax.drawOrder = false;
  on.order.draw({ handLeft: 'behind' });
  assert.deepEqual(ids(on.root), ['body', 'handLeft', 'face'], 'the author turned it off: the artwork\'s order, at once');
  parallax.enabled = false; parallax.drawOrder = true;
  on.order.draw({ handLeft: 'behind' });
  assert.deepEqual(ids(on.root), ['body', 'handLeft', 'face'], 'no parallax, no bands');
});
