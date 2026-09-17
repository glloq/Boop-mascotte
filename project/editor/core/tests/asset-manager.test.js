import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMemoryAssetStore } from '../assets/asset-store.js';
import { assetReferencesIn, createAssetManager, hashAssetBytes, missingAssets, unusedAssets } from '../assets/asset-manager.js';
import { assetRef } from '../assets/asset-model.js';

const file = (name) => readFileSync(new URL(`./fixtures/assets/${name}`, import.meta.url));
const manager = () => { const store = createMemoryAssetStore(); return { store, assets: createAssetManager({ store }) }; };
const nodeFor = (id) => `<image id="head" href="${assetRef(id)}"/>`;

test('the same picture imported twice is the same asset, and says so',async()=>{
  const { store, assets } = manager();
  const bytes = file('alpha-24x17.webp');
  const first = await assets.import(bytes, { name: 'head.webp', type: 'image/webp' });
  assert.equal(first.ok,true);
  assert.equal(first.stored,true);
  assert.deepEqual({ format: first.asset.format, width: first.asset.width, height: first.asset.height, alpha: first.asset.alpha },
    { format: 'image/webp', width: 24, height: 17, alpha: true });

  // A different name, the same bytes: one asset. There is nothing to
  // deduplicate later because there is never a second record.
  const again = await assets.import(bytes, { name: 'a-copy-of-head.webp' });
  assert.equal(again.asset.id,first.asset.id);
  assert.equal(again.stored,false,'the author already had this picture');
  assert.deepEqual(await store.keys(),[first.asset.id]);

  // Different bytes, different id.
  const other = await assets.import(file('opaque-48x32.webp'), { name: 'body.webp' });
  assert.notEqual(other.asset.id,first.asset.id);
  assert.equal((await store.keys()).length,2);
});

test('an id is the hash of the bytes, and nothing else',async()=>{
  const bytes = file('tiny-3x7.png');
  assert.equal(await hashAssetBytes(bytes),await hashAssetBytes(file('tiny-3x7.png')));
  assert.notEqual(await hashAssetBytes(bytes),await hashAssetBytes(file('alpha-16x16.png')));
  assert.match(await hashAssetBytes(bytes),/^[0-9a-f]{16}$/);
});

test('nothing that is refused reaches the store',async()=>{
  const { store, assets } = manager();
  const refused = await assets.import(new TextEncoder().encode('<svg viewBox="0 0 8 8"><script>x()</script></svg>'), { name: 'trap.svg' });
  assert.equal(refused.ok,false);
  assert.equal(refused.asset,null);
  assert.equal(refused.issues[0].code,'unsafe-svg');
  assert.deepEqual(await store.keys(),[],'the bytes were never stored');
});

test('a reference is found wherever artwork keeps one',async()=>{
  const document = {
    svgMarkup: `<svg>${nodeFor('aabbccdd11223344')}<image href="asset:ffeeddcc00112233"/></svg>`,
    elements: { hat: { artwork: { assetId: 'asset:99887766aabbccdd' } } }
  };
  assert.deepEqual([...assetReferencesIn(document)].sort(),['99887766aabbccdd','aabbccdd11223344','ffeeddcc00112233']);
  // Nothing that is not a reference is mistaken for one.
  assert.deepEqual([...assetReferencesIn({ svgMarkup: '<svg><image href="http://evil.example/a.png"/><image href="asset:nope"/></svg>' })],[]);
});

test('an asset two nodes share survives the loss of one of them',async()=>{
  const { store, assets } = manager();
  const { asset } = await assets.import(file('alpha-16x16.png'), { name: 'eye.png' });
  const both = { svgMarkup: `<svg><image id="eyeL" href="${assetRef(asset.id)}"/><image id="eyeR" href="${assetRef(asset.id)}"/></svg>`, assets: { [asset.id]: asset } };
  assert.deepEqual(unusedAssets(both),[]);

  const one = { ...both, svgMarkup: `<svg><image id="eyeR" href="${assetRef(asset.id)}"/></svg>` };
  assert.deepEqual(unusedAssets(one),[],'one eye left still needs the picture');

  const none = { ...both, svgMarkup: '<svg></svg>' };
  assert.deepEqual(unusedAssets(none),[asset.id]);
  const collected = await assets.collect(none);
  assert.deepEqual(collected.removed,[asset.id]);
  assert.deepEqual(Object.keys(collected.assets),[]);
  assert.deepEqual(await store.keys(),[],'the bytes went with the record');
  // The document it was given is not the document it changed.
  assert.deepEqual(Object.keys(none.assets),[asset.id]);
});

test('references follow an undo, because they are read rather than counted',async()=>{
  // The reason there is no retain/release: undo restores a whole document in
  // one step, and a hand-kept count would have to be unwound alongside it.
  const { store, assets } = manager();
  const { asset } = await assets.import(file('alpha-16x16.png'), { name: 'eye.png' });
  const before = { svgMarkup: `<svg>${nodeFor(asset.id)}</svg>`, assets: { [asset.id]: asset } };
  const deleted = { ...before, svgMarkup: '<svg></svg>' };
  assert.deepEqual(unusedAssets(deleted),[asset.id]);
  // Undo hands back the earlier document; nothing had to be told.
  assert.deepEqual(unusedAssets(before),[]);
  assert.deepEqual(await store.keys(),[asset.id],'and the bytes were never touched');
});

test('artwork pointing at an asset the project does not have is reported',async()=>{
  const broken = { svgMarkup: `<svg>${nodeFor('0123456789abcdef')}</svg>`, assets: {} };
  assert.deepEqual(missingAssets(broken),['0123456789abcdef']);
  // A project that will paint holes, and the kind of thing a hand-assembled
  // file or a package that lost part of itself looks like.
  const { assets } = manager();
  assert.deepEqual(assets.missingIn(broken),['0123456789abcdef']);
});

test('collecting nothing changes nothing',async()=>{
  const { assets } = manager();
  const document = { svgMarkup: '<svg/>', assets: {} };
  const collected = await assets.collect(document);
  assert.deepEqual(collected.removed,[]);
  assert.equal(collected.assets,document.assets,'the same table back, not a copy of it');
});
