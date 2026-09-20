/**
 * The two capabilities §12 names for Rig ▸ Deform and the editor never had
 * (UX-60 PR 8): a surface for the shape keys it can already make, and an
 * author for the depth the runtime has always read.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState } from '../state/store.js';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createShapeKeyCommands } from '../shape-keys/shape-key-commands.js';
import { createDepthCommands } from '../rig/depth-commands.js';
import { normalizeShapeKey } from '../shape-keys/shape-key-model.js';

/** A delta is a flat run of numbers, and a key with an empty one is dropped. */
const key = (id, target, over = {}) => normalizeShapeKey({ id, target, name: id, driver: null, delta: [1, 0, 0, 0], ...over });
/** What the panel shows in the "moved by" column. */
const driverOf = (item) => (item?.driver?.mode === 'range' ? item.driver.parameter : null);

function setup() {
  const initial = createCleanProjectState();
  initial.elements = { head: { baseTransform: {}, depth: 0 }, hat: { baseTransform: {}, depth: 0.5 } };
  initial.shapeKeys = [key('smile-wide', 'mouth'), key('brow-lift', 'browLeft', { driver: { mode: 'range', parameter: 'browRaise' } })];
  const store = createEditorStore(initial);
  const history = createHistory(store);
  return { store, history, shapes: createShapeKeyCommands(store, history), depth: createDepthCommands(store, history) };
}

const shapeKeys = (store) => store.getDocument().shapeKeys;
const byId = (store, id) => shapeKeys(store).find((item) => item.id === id);

test('a shape key can be told what moves it, and told nothing moves it', () => {
  const { store, shapes } = setup();
  assert.equal(driverOf(byId(store, 'smile-wide')), null, 'a captured corrective has no driver of its own');
  assert.deepEqual(shapes.setDriver('smile-wide', 'smile'), { ok: true });
  assert.equal(driverOf(byId(store, 'smile-wide')), 'smile');
  // A key a head-pose cell drives has no parameter, and saying so is a real
  // answer rather than a refusal.
  assert.deepEqual(shapes.setDriver('smile-wide', ''), { ok: true });
  assert.equal(driverOf(byId(store, 'smile-wide')), null);
  assert.equal(byId(store, 'smile-wide').driver.mode, 'none');
  assert.equal(shapes.setDriver('nothing', 'smile').ok, false, 'and a key that is not there says so');
});

test('a shape key can be renamed without anything losing sight of it', () => {
  const { store, shapes } = setup();
  shapes.rename('brow-lift', 'Eyebrow lift');
  assert.equal(byId(store, 'brow-lift').name, 'Eyebrow lift');
  assert.equal(byId(store, 'brow-lift').id, 'brow-lift', 'the id is what everything points at');
  assert.equal(driverOf(byId(store, 'brow-lift')), 'browRaise', 'and the rest of the record is untouched');
  shapes.rename('brow-lift', '   ');
  assert.equal(byId(store, 'brow-lift').name, 'Eyebrow lift', 'an empty name is not a name');
});

test('forgetting a shape key leaves the artwork exactly as it was', () => {
  const { store, shapes } = setup();
  const artwork = JSON.stringify(store.getDocument().elements);
  assert.deepEqual(shapes.remove('smile-wide'), { ok: true });
  assert.deepEqual(shapeKeys(store).map((item) => item.id), ['brow-lift']);
  assert.equal(JSON.stringify(store.getDocument().elements), artwork, 'a shape key is a difference applied at draw time');
  assert.equal(shapes.remove('smile-wide').ok, false);
});

test('every shape key gesture is one undo step', () => {
  const { store, history, shapes } = setup();
  shapes.setDriver('smile-wide', 'smile');
  shapes.rename('smile-wide', 'Wide smile');
  shapes.remove('brow-lift');
  assert.deepEqual(shapeKeys(store).map((item) => item.id), ['smile-wide']);
  history.undo();
  assert.deepEqual(shapeKeys(store).map((item) => item.id), ['smile-wide', 'brow-lift']);
  history.undo();
  assert.equal(byId(store, 'smile-wide').name, 'smile-wide');
  history.undo();
  assert.equal(driverOf(byId(store, 'smile-wide')), null);
});

test('a piece can be given a depth, and it is the runtime\'s own range', () => {
  const { store, depth } = setup();
  assert.deepEqual(depth.setElementDepth('head', 0.4), { ok: true });
  assert.equal(store.getDocument().elements.head.depth, 0.4);
  // −1…1 is what `clampDepth` allows, and a number outside it is a typo rather
  // than a request.
  depth.setElementDepth('head', 9);
  assert.equal(store.getDocument().elements.head.depth, 1);
  depth.setElementDepth('head', -9);
  assert.equal(store.getDocument().elements.head.depth, -1);
  depth.clearElementDepth('head');
  assert.equal(store.getDocument().elements.head.depth, 0);
  assert.equal(depth.setElementDepth('nothing', 0.5).ok, false);
});

test('the parallax settings are settable, and stay a normalized record', () => {
  const { store, depth } = setup();
  assert.deepEqual(depth.setParallax({ enabled: false }), { ok: true });
  assert.equal(store.getDocument().parallax.enabled, false);
  depth.setParallax({ amount: 12, drawOrder: false });
  assert.equal(store.getDocument().parallax.amount, 12);
  assert.equal(store.getDocument().parallax.drawOrder, false);
  // Still every field the runtime reads: a patch is a patch, not a replacement.
  assert.equal(typeof store.getDocument().parallax.parameterX, 'string');
  assert.equal(store.getDocument().parallax.bands.length, 2);
});

test('nothing that changes nothing writes an undo step', () => {
  const { store, history, shapes, depth } = setup();
  const before = history.canUndo?.() ?? false;
  shapes.setDriver('brow-lift', 'browRaise');
  depth.setElementDepth('hat', 0.5);
  depth.setParallax({});
  assert.equal(history.canUndo?.() ?? false, before, 'a no-op is not a step to undo');
});
