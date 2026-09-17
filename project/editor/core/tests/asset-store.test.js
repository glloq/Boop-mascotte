import test from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_STORE_NAME, createIndexedDbAssetStore, createMemoryAssetStore, openAssetStore } from '../assets/asset-store.js';
import { createFakeIndexedDb } from './helpers/fake-indexeddb.js';

const bytes = (text) => new Blob([text]);

/** Both implementations answer the same questions, so both are asked them. */
const stores = () => [
  ['memory', async () => createMemoryAssetStore()],
  ['indexeddb', async () => openAssetStore({ indexedDB: createFakeIndexedDb() })]
];

for (const [name, build] of stores()) {
  test(`${name}: the same bytes stored twice are stored once`,async()=>{
    const store = await build();
    const first = await store.put('7f3c9a1b', bytes('picture'));
    assert.deepEqual(first,{ id: '7f3c9a1b', bytes: 7, stored: true });
    // Content-addressed: the same id cannot name different bytes, so a second
    // put is a no-op that says so rather than an overwrite.
    const second = await store.put('7f3c9a1b', bytes('picture'));
    assert.equal(second.stored,false);
    assert.equal(second.bytes,7);
    assert.deepEqual(await store.keys(),['7f3c9a1b']);
  });

  test(`${name}: what goes in comes back, and what is gone is gone`,async()=>{
    const store = await build();
    await store.put('aabbccdd', bytes('one'));
    await store.put('11223344', bytes('two-two'));
    assert.equal(await (await store.get('aabbccdd')).text(),'one');
    assert.equal(await store.get('missing'),null);
    assert.ok(await store.has('11223344'));
    assert.equal(await store.has('missing'),false);
    assert.equal(await store.bytes(),10);

    assert.equal(await store.remove('aabbccdd'),true);
    assert.equal(await store.remove('aabbccdd'),false,'removing twice is not an error, just false');
    assert.deepEqual(await store.keys(),['11223344']);
    assert.equal(await store.bytes(),7);

    await store.clear();
    assert.deepEqual(await store.keys(),[]);
    assert.equal(await store.bytes(),0);
  });
}

test('a store says whether the bytes will still be there tomorrow',async()=>{
  // Silently falling back to memory would mean autosave quietly stopping at
  // the images while claiming to have saved.
  assert.equal((await openAssetStore({ indexedDB: createFakeIndexedDb() })).persistent,true);

  const none = await openAssetStore({ indexedDB: null });
  assert.equal(none.persistent,false);
  assert.equal(none.reason,'no-indexeddb');

  for (const openAs of ['error','blocked']) {
    const refused = await openAssetStore({ indexedDB: createFakeIndexedDb({ openAs }) });
    assert.equal(refused.persistent,false,openAs);
    assert.equal(refused.reason,'indexeddb-unavailable',openAs);
    // Still a working store: a browser that refuses IndexedDB must still let
    // someone work on a mascot.
    assert.equal((await refused.put('aabbccdd', bytes('x'))).stored,true);
  }
});

test('a write that cannot complete fails the put rather than reporting success',async()=>{
  // The quota case: the request succeeds and the transaction aborts, which is
  // exactly the shape that a store awaiting only the request would miss.
  const indexedDB = createFakeIndexedDb({ beforeWrite: () => { throw new Error('QuotaExceededError'); } });
  const store = await openAssetStore({ indexedDB });
  await assert.rejects(() => store.put('7f3c9a1b', bytes('too big')),/Quota|aborted|failed/);
  assert.equal(await store.has('7f3c9a1b'),false);
});

test('the database is opened with the object store the code then asks for',async()=>{
  const indexedDB = createFakeIndexedDb();
  await openAssetStore({ indexedDB });
  assert.ok(indexedDB.database.objectStoreNames.contains(ASSET_STORE_NAME));
});

test('a store built on an open database is the same store',async()=>{
  const indexedDB = createFakeIndexedDb();
  const opened = await openAssetStore({ indexedDB });
  await opened.put('deadbeef', bytes('shared'));
  // A second handle onto the same database sees what the first stored: the
  // bytes are in the database, not in the wrapper around it.
  const again = createIndexedDbAssetStore(indexedDB.database);
  assert.equal(await (await again.get('deadbeef')).text(),'shared');
});
