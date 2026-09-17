import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssetResolver } from '../../../runtime/asset-resolver.js';
import { assetRef, parseAssetRef } from '../../../runtime/asset-reference.js';
import { createMemoryAssetStore } from '../assets/asset-store.js';

/** Object URLs, counted, so a leak is a number rather than a suspicion. */
const urls = () => {
  const live = new Set(); let made = 0;
  return {
    live, get made() { return made; },
    createObjectURL: (blob) => { const url = `blob:fake/${made++}`; live.add(url); return url; },
    revokeObjectURL: (url) => { live.delete(url); }
  };
};

const withAssets = async (...ids) => {
  const store = createMemoryAssetStore();
  for (const id of ids) await store.put(id, new Blob([id]));
  return store;
};

test('the runtime owns the reference, and the editor does not keep a second copy',async()=>{
  const { parseAssetRef: fromEditor, assetRef: refFromEditor } = await import('../assets/asset-model.js');
  assert.equal(fromEditor,parseAssetRef);
  assert.equal(refFromEditor,assetRef);
});

test('priming makes a reference paintable, and painting never waits',async()=>{
  const url = urls();
  const resolver = createAssetResolver({ store: await withAssets('aabbccdd11223344'), ...url });
  // Before priming there is nothing to paint, and asking is still not a promise.
  assert.equal(resolver.urlFor(assetRef('aabbccdd11223344')),null);

  const primed = await resolver.prime([assetRef('aabbccdd11223344')]);
  assert.deepEqual(primed,{ ready: ['aabbccdd11223344'], missing: [] });
  // The lookup the drawing does: synchronous, and it takes an id or a whole
  // reference, so a caller holding an attribute value need not parse it.
  assert.equal(resolver.urlFor('aabbccdd11223344'),'blob:fake/0');
  assert.equal(resolver.urlFor(assetRef('aabbccdd11223344')),'blob:fake/0');
});

test('one URL per asset, however often it is asked for',async()=>{
  const url = urls();
  const resolver = createAssetResolver({ store: await withAssets('aabbccdd11223344'), ...url });
  await resolver.prime(['aabbccdd11223344']);
  await resolver.prime(['aabbccdd11223344', 'aabbccdd11223344']);
  assert.equal(url.made,1,'primed twice, created once');
  assert.equal(url.live.size,1);
  assert.equal(resolver.stats().held,1);
});

test('what is released is revoked, because an unrevoked URL is the picture kept alive',async()=>{
  const url = urls();
  const resolver = createAssetResolver({ store: await withAssets('11111111aaaa', '22222222bbbb', '33333333cccc'), ...url });
  await resolver.prime(['11111111aaaa', '22222222bbbb', '33333333cccc']);
  assert.equal(url.live.size,3);

  // Retain is the counterpart to prime: what a long session needs so it does
  // not hold a URL for every picture that was ever on the canvas.
  const dropped = resolver.retain([assetRef('22222222bbbb')]);
  assert.deepEqual(dropped.sort(),['11111111aaaa','33333333cccc']);
  assert.equal(url.live.size,1);
  assert.equal(resolver.urlFor('11111111aaaa'),null);

  resolver.releaseAll();
  assert.equal(url.live.size,0,'nothing left holding a picture');
  assert.equal(resolver.stats().held,0);
});

test('an asset the store does not have is answered, not awaited',async()=>{
  const url = urls();
  const store = await withAssets('aabbccdd11223344');
  const resolver = createAssetResolver({ store, ...url });
  const primed = await resolver.prime(['aabbccdd11223344', 'deadbeefdeadbeef']);
  assert.deepEqual(primed,{ ready: ['aabbccdd11223344'], missing: ['deadbeefdeadbeef'] });
  // Null is something a canvas can draw -- nothing, or a placeholder. A
  // promise is not.
  assert.equal(resolver.urlFor('deadbeefdeadbeef'),null);
  assert.ok(resolver.isMissing(assetRef('deadbeefdeadbeef')));
  assert.equal(resolver.isMissing('aabbccdd11223344'),false);

  // Remembered as absent, so a canvas redrawing sixty times a second does not
  // ask the store sixty times a second.
  let reads = 0;
  const counting = createAssetResolver({ store: { get: async (id) => { reads += 1; return store.get(id); } }, ...url });
  await counting.prime(['deadbeefdeadbeef']);
  await counting.prime(['deadbeefdeadbeef']);
  await counting.prime(['deadbeefdeadbeef']);
  assert.equal(reads,1);
});

test('a reference that is not one resolves to nothing',async()=>{
  const resolver = createAssetResolver({ store: await withAssets('aabbccdd11223344'), ...urls() });
  await resolver.prime(['aabbccdd11223344']);
  for (const hostile of ['asset:../../etc/passwd', 'http://evil.example/a.png', 'asset:', '', null])
    assert.equal(resolver.urlFor(hostile),null,String(hostile));
});

test('a resolver with no store is a resolver that paints nothing, not one that throws',async()=>{
  const resolver = createAssetResolver({ ...urls() });
  assert.deepEqual(await resolver.prime(['aabbccdd11223344']),{ ready: [], missing: ['aabbccdd11223344'] });
  assert.equal(resolver.urlFor('aabbccdd11223344'),null);
});
