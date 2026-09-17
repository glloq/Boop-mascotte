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

test('an oversized import is fitted before it is named',async()=>{
  // The id names the bytes that are kept. Hashing the original and storing
  // the resized one would leave every reference pointing at a picture nobody
  // has, so the order is: validate, fit, hash, store.
  const store = createMemoryAssetStore();
  const fitted = new Uint8Array([1, 2, 3]);
  const assets = createAssetManager({ store, optimiser: { optimise: async () => ({ bytes: fitted, width: 512, height: 384, resized: true, reason: '' }) } });
  const big = Buffer.from(file('alpha-16x16.png')); big.writeUInt32BE(1024, 16); big.writeUInt32BE(768, 20);

  const result = await assets.import(big, { name: 'huge.png' });
  assert.deepEqual({ width: result.asset.width, height: result.asset.height, bytes: result.asset.bytes },{ width: 512, height: 384, bytes: 3 });
  assert.equal(result.asset.id,await hashAssetBytes(fitted),'named after what was kept');
  assert.equal((await store.get(result.asset.id)).size ?? (await store.get(result.asset.id)).length,3);
});

test('an author told a picture would be resized is told when it was not',async()=>{
  const store = createMemoryAssetStore();
  // No codec: the picture goes through at its original size, and the
  // `over-budget` promise is answered rather than left hanging.
  const assets = createAssetManager({ store });
  const big = Buffer.from(file('alpha-16x16.png')); big.writeUInt32BE(1024, 16); big.writeUInt32BE(768, 20);
  const result = await assets.import(big, { name: 'huge.png' });
  assert.deepEqual(result.issues.map((i) => i.code),['over-budget','not-resized']);
  assert.equal(result.issues[1].detail,'no-codec');
  assert.equal(result.asset.width,1024,'and the record says the size it really is');
});

test('the store is handed a Blob carrying the format, because that is what paints',async()=>{
  // The bug this exists for: `URL.createObjectURL` takes a `Blob` and nothing
  // else, and handed a `Uint8Array` it throws `Overload resolution failed` --
  // a sentence nobody traces back to a missing wrapper. It survived six
  // commits because every test wrote `new Blob([...])` into the store by hand
  // while the manager wrote raw bytes: the fixtures were more correct than the
  // code, so they agreed with each other and with nothing real.
  const put = [];
  const store = { put: async (id, value) => { put.push({ id, value }); return { id, bytes: value.size ?? value.length, stored: true }; }, get: async () => null, remove: async () => true };
  const assets = createAssetManager({ store });
  await assets.import(file('alpha-24x17.webp'), { name: 'mouth.webp', type: 'image/webp' });
  assert.equal(put.length,1);
  assert.ok(put[0].value instanceof Blob,'a Blob, or nothing will paint it');
  // And the type, because an object URL with none leaves the browser sniffing
  // at bytes it was told nothing about.
  assert.equal(put[0].value.type,'image/webp');

  put.length = 0;
  await assets.import(file('alpha-16x16.png'), { name: 'eye.png' });
  assert.equal(put[0].value.type,'image/png','the format read from the bytes, not from the name it was given');
});

test('adopting a package’s picture keeps it under its own type too',async()=>{
  const store = createMemoryAssetStore();
  const assets = createAssetManager({ store });
  const bytes = file('alpha-24x17.webp');
  const id = await hashAssetBytes(bytes);
  assert.equal(await assets.adopt(id, bytes, 'image/webp'),true);
  const held = await store.get(id);
  assert.ok(held instanceof Blob);
  assert.equal(held.type,'image/webp');
  // Bytes that are not what the name says never land.
  assert.equal(await assets.adopt(id, file('alpha-16x16.png'), 'image/png'),false);
  assert.equal((await store.get(id)).type,'image/webp','and the real one is untouched');
});

test('what comes back out is bytes again, whatever it was kept as',async()=>{
  const { store, assets } = manager();
  const { asset } = await assets.import(file('tiny-3x7.png'), { name: 'hair.png' });
  const out = await assets.bytes(asset.id);
  // A package writer needs a `Uint8Array`; the resolver needs the `Blob`. Both
  // are served without either having to know how the other is fed.
  assert.ok(out instanceof Uint8Array);
  // Compared as contents: the fixture is read as a Node `Buffer` and what
  // comes back is a plain `Uint8Array`, which `deepEqual` will not call equal.
  assert.deepEqual([...out],[...file('tiny-3x7.png')]);
  assert.ok((await store.get(asset.id)) instanceof Blob);
  assert.equal(await assets.bytes('deadbeefdeadbeef'),null);
});
