import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrawOrder } from '../../../runtime/draw-order.js';
import { createMascotEngine, normalizeParallax, DEFAULT_PARALLAX } from '../../../runtime/runtime.js';

/**
 * A DOM small enough to read: the parts of a node this module actually touches.
 * `writes` counts `insertBefore`, because "the DOM is touched only when a band
 * changes" is the property, not an implementation detail — a version that
 * reordered correctly every frame would be a regression.
 */
let writes = 0;
function node(localName, id = null) {
  const self = {
    localName, id, parentNode: null, children: [],
    get nextElementSibling() {
      const kids = self.parentNode?.children || [];
      return kids[kids.indexOf(self) + 1] || null;
    },
    append(...items) { for (const item of items) { item.parentNode = self; self.children.push(item); } return self; },
    insertBefore(item, before) {
      writes += 1;
      const at = self.children.indexOf(item);
      if (at >= 0) self.children.splice(at, 1);
      const index = before ? self.children.indexOf(before) : self.children.length;
      self.children.splice(index < 0 ? self.children.length : index, 0, item);
      item.parentNode = self;
      return item;
    },
    setAttribute() {}, getAttribute: () => null, tagName: localName
  };
  return self;
}
const ids = (parent) => parent.children.map((child) => child.id || `<${child.localName}>`);
const nodesOf = (...items) => new Map(items.filter((item) => item.id).map((item) => [item.id, item]));

function face() {
  const head = node('g', 'head');
  const parts = ['hairBack', 'earLeft', 'faceShape', 'eyeLeft', 'nose', 'hairFront'].map((id) => node('path', id));
  head.append(...parts);
  return { head, parts: Object.fromEntries(parts.map((part) => [part.id, part])) };
}

test('a band decides paint order, and the artwork decides the order inside a band', () => {
  const { head } = face();
  const order = createDrawOrder(nodesOf(...head.children), head.children.map((child) => child.id));
  assert.equal(order.scopes, 1, 'one parent, one scope');

  // Everything in the middle band: the artwork is already the answer, so the
  // very first apply must not move a single node.
  writes = 0;
  order.apply({});
  assert.equal(writes, 0, 'a rig whose depths say nothing is left exactly as it was drawn');
  assert.deepEqual(ids(head), ['hairBack', 'earLeft', 'faceShape', 'eyeLeft', 'nose', 'hairFront']);

  order.apply({ hairBack: 'behind', earLeft: 'behind', nose: 'front', hairFront: 'front' });
  assert.deepEqual(ids(head), ['hairBack', 'earLeft', 'faceShape', 'eyeLeft', 'nose', 'hairFront'],
    'these were already drawn in that order, so nothing had to move');

  // Now something is drawn in front of the face but authored behind it.
  order.apply({ hairBack: 'behind', earLeft: 'behind', hairFront: 'behind', nose: 'front' });
  assert.deepEqual(ids(head), ['hairBack', 'earLeft', 'hairFront', 'faceShape', 'eyeLeft', 'nose']);
  // ... and back, which restores the artwork exactly rather than approximately.
  order.apply({});
  assert.deepEqual(ids(head), ['hairBack', 'earLeft', 'faceShape', 'eyeLeft', 'nose', 'hairFront']);
});

test('the DOM is touched only when a band changes', () => {
  const { head } = face();
  const order = createDrawOrder(nodesOf(...head.children), head.children.map((child) => child.id));
  const bands = { hairBack: 'behind', nose: 'front' };
  order.apply(bands);
  writes = 0;
  for (let frame = 0; frame < 100; frame += 1) assert.equal(order.apply(bands), 0);
  assert.equal(writes, 0, 'a hundred frames at the same depth are a hundred frames of nothing');
  assert.equal(order.apply({ ...bands, hairBack: 'front' }), 1, 'and one that moves is one scope rewritten');
});

test('a sibling the rig does not own keeps the place the artist drew it in', () => {
  const head = node('g', 'head');
  const [back, decoration, front] = [node('path', 'hairBack'), node('path', 'sparkle'), node('path', 'hairFront')];
  head.append(back, decoration, front);
  // `sparkle` is artwork with no rig element: it is not in the id list.
  const order = createDrawOrder(nodesOf(back, front), ['hairBack', 'hairFront']);
  order.apply({ hairBack: 'front', hairFront: 'behind' });
  assert.deepEqual(ids(head), ['hairFront', 'sparkle', 'hairBack'],
    'the two rig elements swapped through the slots they already held; the decoration did not move');
});

test('reordering never crosses a parent', () => {
  const root = node('g', 'root');
  const [headGroup, bodyGroup] = [node('g', 'headGroup'), node('g', 'bodyGroup')];
  root.append(headGroup, bodyGroup);
  const [nose, hand] = [node('path', 'nose'), node('path', 'hand')];
  headGroup.append(nose);
  bodyGroup.append(hand);
  const order = createDrawOrder(nodesOf(nose, hand), ['nose', 'hand']);
  // One managed child each: neither group is a scope at all, so a hand that is
  // "in front" of a nose cannot be lifted out of the body group to prove it.
  assert.equal(order.scopes, 0);
  writes = 0;
  order.apply({ nose: 'behind', hand: 'front' });
  assert.equal(writes, 0);
  assert.deepEqual(ids(root), ['headGroup', 'bodyGroup']);
});

test('artwork inside a definition block is left alone', () => {
  const defs = node('defs');
  const clip = node('clipPath', 'socket');
  defs.append(clip);
  const [a, b] = [node('path', 'clipA'), node('path', 'clipB')];
  clip.append(a, b);
  const order = createDrawOrder(nodesOf(a, b), ['clipA', 'clipB']);
  assert.equal(order.scopes, 0, 'order inside a clip path is not paint order');
  order.apply({ clipA: 'front', clipB: 'behind' });
  assert.deepEqual(ids(clip), ['clipA', 'clipB']);
});

test('a rig can keep the stacking it was drawn with', () => {
  assert.equal(normalizeParallax({}).drawOrder, true, 'depth means what it says by default');
  assert.equal(DEFAULT_PARALLAX.drawOrder, true);
  assert.equal(normalizeParallax({ drawOrder: false }).drawOrder, false);
});

/** The engine end to end: a depth pose moves a part behind the face it was drawn over. */
test('a depth pose reorders the artwork, and the exported engine is what does it', () => {
  const build = (parallax) => {
    const head = node('g', 'head');
    const parts = ['faceShape', 'earRight'].map((id) => node('path', id));
    head.append(...parts);
    const root = { id: 'mascot', querySelectorAll: (selector) => (selector === '[id]' ? [head, ...parts] : []) };
    const rig = {
      schemaVersion: 4,
      params: { headX: { min: -1, max: 1, default: 0, value: 0 } },
      states: { idle: { headX: 0 } }, activeState: 'idle', transitions: {},
      elements: {
        faceShape: { baseTransform: {}, depth: 0 },
        // Drawn on top of the face, and authored at the depth of an ear on the axis.
        earRight: { baseTransform: {}, depth: 0.1 }
      },
      // One axis, three stops: a full turn to the right pushes the far ear back.
      keyforms: [{
        id: 'tuck', target: { kind: 'element', id: 'earRight' }, channel: 'depth',
        axes: [{ parameter: 'headX', values: [-1, 0, 1] }],
        // Every stop captured, the way a generated head-pose grid is: a grid
        // with a single cell in it reads that cell everywhere.
        keyforms: [{ at: [0], value: 0 }, { at: [1], value: 0 }, { at: [2], value: -0.8 }]
      }],
      ...(parallax ? { parallax } : {})
    };
    const frames = new Map();
    let key = 0, clock = 0;
    const engine = createMascotEngine({
      svgRoot: root, rig, fps: 1,
      requestFrame: (fn) => { frames.set(++key, fn); return key; },
      cancelFrame: (id) => frames.delete(id),
      now: () => clock
    });
    const advance = () => { clock += 2000; const pending = [...frames.entries()]; frames.clear(); pending.forEach(([, fn]) => fn(clock)); };
    return { head, engine, advance };
  };

  const { head, engine, advance } = build();
  engine.start();
  advance();
  assert.deepEqual(ids(head), ['faceShape', 'earRight'], 'at rest the ear is drawn where the artist drew it');
  engine.setParam('headX', 1);
  advance();
  assert.deepEqual(ids(head), ['earRight', 'faceShape'], 'turned away, the ear is behind the face');
  engine.setParam('headX', 0);
  advance();
  assert.deepEqual(ids(head), ['faceShape', 'earRight'], 'and comes back to exactly the artwork');
  engine.stop();

  // The same rig, with the stacking locked: the depth still nudges the part
  // sideways, it simply never repaints it in a different order.
  const off = build({ drawOrder: false });
  off.engine.start();
  off.advance();
  off.engine.setParam('headX', 1);
  off.advance();
  assert.deepEqual(ids(off.head), ['faceShape', 'earRight']);
  off.engine.stop();
});

/**
 * The editor borrows this order for its canvas and gives it back before the
 * document is read (docs/DEPTH_PARALLAX.md). Giving it back has to survive
 * what an author does in between: delete a piece, move one under another group.
 */
test('restore puts the artwork back the way it was drawn, and leaves what is gone alone', () => {
  const { head, parts } = face();
  const order = createDrawOrder(nodesOf(...head.children), head.children.map((child) => child.id));
  assert.equal(order.restore(), 0, 'nothing borrowed, nothing to give back');
  order.apply({ hairFront: 'behind', nose: 'front', earLeft: 'front' });
  assert.deepEqual(ids(head), ['hairFront', 'hairBack', 'faceShape', 'eyeLeft', 'earLeft', 'nose']);
  // Meanwhile the author deletes the nose and moves the ear into another group.
  head.children.splice(head.children.indexOf(parts.nose), 1); parts.nose.parentNode = null;
  const other = node('g', 'other');
  head.children.splice(head.children.indexOf(parts.earLeft), 1); other.append(parts.earLeft);
  assert.equal(order.restore(), 1);
  assert.deepEqual(ids(head), ['hairBack', 'faceShape', 'eyeLeft', 'hairFront'], 'the artwork\'s order, minus what left');
  assert.deepEqual(ids(other), ['earLeft'], 'a piece that moved out was not dragged back');
  assert.equal(parts.nose.parentNode, null, 'a deleted piece did not come back');
  assert.equal(order.restore(), 0, 'and it is given back once');
  // Borrowing again after a restore is a fresh partition, not a diff against a stale one.
  writes = 0;
  order.apply({});
  assert.equal(writes, 0);
});
