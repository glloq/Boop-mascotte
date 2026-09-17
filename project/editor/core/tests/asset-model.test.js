import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_FORMATS, ASSET_MAX_DIMENSION, assetKind, assetRef, isAssetRef, normalizeAsset, normalizeAssets, parseAssetRef } from '../assets/asset-model.js';

const asset = (over = {}) => ({ id: '7f3c9a1b2c3d4e5f', format: 'image/webp', width: 512, height: 384, alpha: true, bytes: 40960, name: 'head', importedAt: '2026-09-17T00:00:00.000Z', ...over });

test('an asset is addressed by the hash of its own bytes',()=>{
  const record = normalizeAsset(asset());
  assert.equal(record.id,'7f3c9a1b2c3d4e5f');
  // Uppercase in, lowercase out: one spelling, so one reference.
  assert.equal(normalizeAsset(asset({ id: '7F3C9A1B2C3D4E5F' })).id,'7f3c9a1b2c3d4e5f');
  // Nothing stored that can be derived: no second field holding the hash,
  // and no field saying where the bytes are, because the id is that.
  assert.deepEqual(Object.keys(record).sort(),['alpha','bytes','format','height','id','importedAt','name','width']);
});

test('what an asset may be, and what it may not',()=>{
  assert.deepEqual(ASSET_FORMATS,['image/svg+xml','image/png','image/webp']);
  assert.equal(assetKind(asset()),'raster');
  assert.equal(assetKind(asset({ format: 'image/svg+xml' })),'vector');
  assert.equal(ASSET_MAX_DIMENSION,512);
  // JPG is an import to convert, never something stored.
  for (const format of ['image/jpeg','image/gif','text/html','',null,undefined])
    assert.equal(normalizeAsset(asset({ format })),null,`${format} should not be an asset`);
});

test('an asset that cannot be trusted is refused, not repaired',()=>{
  // A broken record kept with a size of zero is a broken reference inside a
  // document; refusing it keeps it out.
  for (const over of [{ id: 'nope' }, { id: '' }, { id: 'abc' }, { width: 0 }, { height: -4 }, { width: 'wide' }])
    assert.equal(normalizeAsset(asset(over)),null,JSON.stringify(over));
  for (const value of [null, undefined, 'asset', 42, []]) assert.equal(normalizeAsset(value),null);
  // A size given as a string is read, not refused: it is still a number.
  assert.equal(normalizeAsset(asset({ width: '512.4' })).width,512);
});

test('a reference is a scheme and a hash, and nothing else can pass as one',()=>{
  assert.equal(assetRef('7f3c9a1b'),'asset:7f3c9a1b');
  assert.equal(parseAssetRef('asset:7f3c9a1b'),'7f3c9a1b');
  assert.equal(parseAssetRef(' asset:7f3c9a1b '),'7f3c9a1b');
  assert.ok(isAssetRef(assetRef('7f3c9a1b2c3d4e5f')));
  // The whole reason the sanitizer can allow this scheme: it cannot carry a
  // path, a query, a second scheme, or anything that leaves the document.
  for (const hostile of [
    'asset:../../etc/passwd', 'asset:7f3c9a1b?x=1', 'asset:7f3c9a1b#frag', 'asset://evil.example/x',
    'asset:javascript:alert(1)', 'asset:http://evil.example/a.png', 'asset:', 'asset:ZZZZZZZZ',
    'http://evil.example/a.png', 'data:image/png;base64,AAAA', 'blob:http://x/y', '#local', '', null, undefined, 42
  ]) assert.equal(parseAssetRef(hostile),null,`${hostile} should not parse as a reference`);
});

test('a table is keyed by the id it holds, and holds only assets',()=>{
  const table = normalizeAssets({
    '7f3c9a1b2c3d4e5f': asset(),
    'aabbccdd': asset({ id: 'aabbccdd', format: 'image/png', width: 64, height: 64, alpha: false }),
    // A key that disagrees with its record cannot be looked up in.
    'wrong-key': asset({ id: 'ffeeddcc' }),
    'broken': { id: 'broken', format: 'image/gif' }
  });
  assert.deepEqual(Object.keys(table).sort(),['7f3c9a1b2c3d4e5f','aabbccdd']);
  assert.equal(table.aabbccdd.alpha,false);
  for (const value of [null, undefined, 'assets', 7]) assert.deepEqual(normalizeAssets(value),{});
});
