import test from 'node:test';
import assert from 'node:assert/strict';
import { createMascotEngine } from '../../../runtime/runtime.js';
import { createAssetResolver } from '../../../runtime/asset-resolver.js';
import { assetRef } from '../../../runtime/asset-reference.js';
import { createMemoryAssetStore } from '../assets/asset-store.js';

const ID = '7f3c9a1b2c3d4e5f';

/** The smallest `svgRoot` the engine reads: a node map and a query. */
const imageNode = (attributes) => {
  const held = new Map(Object.entries(attributes));
  return {
    id: 'head', localName: 'image',
    getAttribute: (name) => (held.has(name) ? held.get(name) : null),
    setAttribute: (name, value) => held.set(name, String(value)),
    removeAttribute: (name) => held.delete(name),
    toObject: () => Object.fromEntries(held)
  };
};
const rootWith = (...nodes) => ({
  id: 'scene',
  querySelectorAll: (selector) => (selector === 'image' ? nodes : nodes.filter((node) => node.id)),
  querySelector: (selector) => nodes.find((node) => `#${node.id}` === selector) ?? null
});
const engineOn = (root, assetResolver) => createMascotEngine({
  svgRoot: root, rig: { params: {}, states: { idle: {} }, activeState: 'idle', elements: {} },
  assetResolver, requestFrame: () => 0, cancelFrame: () => {}, now: () => 0
});

test('an exported mascot resolves its pictures through the same resolver the editor uses',async()=>{
  const store = createMemoryAssetStore();
  await store.put(ID, new Blob(['picture']));
  const resolver = createAssetResolver({ store, createObjectURL: () => 'blob:runtime/0', revokeObjectURL() {} });
  const node = imageNode({ href: assetRef(ID) });
  const engine = engineOn(rootWith(node), resolver);

  // Nothing primed yet: the synchronous pass at construction has nothing to
  // point at, and says so rather than leaving a reference a browser will not
  // draw.
  assert.equal(node.toObject()['data-editor-asset-missing'],'true');

  const { painted, missing } = await engine.refreshAssets();
  assert.deepEqual({ painted, missing },{ painted: [assetRef(ID)], missing: [] });
  assert.deepEqual(node.toObject(),{ href: 'blob:runtime/0', 'data-editor-asset': assetRef(ID) });
});

test('a mascot made of paths never waits for a picture',async()=>{
  // The reason painting is split from fetching: an engine with no resolver
  // does not touch the artwork at all, and a project with no assets does not
  // pay for the feature.
  const node = imageNode({ href: '#head' });
  const engine = engineOn(rootWith(node), null);
  assert.deepEqual(node.toObject(),{ href: '#head' });
  assert.deepEqual(await engine.refreshAssets(),{ painted: [], missing: [] });
  assert.deepEqual(node.toObject(),{ href: '#head' });
});

test('the editor and the runtime paint with the same function, not two like it',async()=>{
  const runtime = await import('../../../runtime/runtime.js');
  const shared = await import('../../../runtime/asset-paint.js');
  // Re-exported rather than reimplemented: an exported mascot has exactly the
  // editor's problem, and solving it twice is two answers that drift.
  assert.equal(runtime.paintAssetReferences,shared.paintAssetReferences);
  assert.equal(runtime.restoreAssetReferences,shared.restoreAssetReferences);
  assert.equal(runtime.collectAssetReferences,shared.collectAssetReferences);
});
