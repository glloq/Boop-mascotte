import test from 'node:test';
import assert from 'node:assert/strict';
import { RECOVERY_STORE_NAME, openRecoveryStorage } from '../state/recovery-storage.js';
import { AUTOSAVE_KEY, readLocalRecovery, writeLocalRecovery } from '../state/local-recovery.js';
import { createFakeIndexedDb } from './helpers/fake-indexeddb.js';

const snapshot = { version: 3, document: { svgMarkup: '<svg><circle/></svg>', rig: {} } };
/** `localStorage`, as much of it as this code touches. */
const localStorageLike = (entries = {}) => {
  const held = new Map(Object.entries(entries));
  return {
    get length() { return held.size; },
    key: (index) => [...held.keys()][index] ?? null,
    getItem: (key) => (held.has(key) ? held.get(key) : null),
    setItem: (key, value) => held.set(key, String(value)),
    removeItem: (key) => held.delete(key)
  };
};

test('a draft is read from memory and written to IndexedDB behind it',async()=>{
  const indexedDB = createFakeIndexedDb();
  const storage = await openRecoveryStorage({ indexedDB, fallback: null });
  // The service reads while rendering and writes from a timer, so both stay
  // synchronous however the bytes actually travel.
  writeLocalRecovery(storage, snapshot, '2026-09-17T00:00:00.000Z');
  assert.equal(readLocalRecovery(storage, (value) => value).status,'available');
  await storage.settled();
  assert.ok(indexedDB.database.objectStoreNames.contains(RECOVERY_STORE_NAME));

  // And it is there tomorrow, which is the whole point.
  const reopened = await openRecoveryStorage({ indexedDB, fallback: null });
  const recovered = readLocalRecovery(reopened, (value) => value);
  assert.equal(recovered.status,'available');
  assert.equal(recovered.savedAt,'2026-09-17T00:00:00.000Z');
});

test('a draft written by the version that used localStorage is taken over, not left behind',async()=>{
  const fallback = localStorageLike({ [AUTOSAVE_KEY]: JSON.stringify({ savedAt: '2026-01-01T00:00:00.000Z', projectSnapshot: snapshot }), 'unrelated-app-key': 'not ours' });
  const indexedDB = createFakeIndexedDb();
  const storage = await openRecoveryStorage({ indexedDB, fallback });
  assert.equal(readLocalRecovery(storage, (value) => value).savedAt,'2026-01-01T00:00:00.000Z');
  await storage.settled();
  // It survives into the new home without the old one being read again.
  const reopened = await openRecoveryStorage({ indexedDB, fallback: localStorageLike() });
  assert.equal(readLocalRecovery(reopened, (value) => value).status,'available');
  // And nothing that is not ours is taken.
  assert.equal(reopened.getItem('unrelated-app-key'),null);
});

test('a newer draft in the new home is not overwritten by an older one in the old',async()=>{
  const indexedDB = createFakeIndexedDb();
  const first = await openRecoveryStorage({ indexedDB, fallback: null });
  writeLocalRecovery(first, snapshot, '2026-09-17T00:00:00.000Z');
  await first.settled();
  const stale = localStorageLike({ [AUTOSAVE_KEY]: JSON.stringify({ savedAt: '2020-01-01T00:00:00.000Z', projectSnapshot: snapshot }) });
  const second = await openRecoveryStorage({ indexedDB, fallback: stale });
  assert.equal(readLocalRecovery(second, (value) => value).savedAt,'2026-09-17T00:00:00.000Z');
});

test('a browser with no IndexedDB carries on exactly as it did',async()=>{
  const fallback = localStorageLike();
  assert.equal(await openRecoveryStorage({ indexedDB: null, fallback }),fallback);
  // And one that refuses to open it, which private browsing does.
  for (const openAs of ['error', 'blocked'])
    assert.equal(await openRecoveryStorage({ indexedDB: createFakeIndexedDb({ openAs }), fallback }),fallback,openAs);
  assert.equal(await openRecoveryStorage({ indexedDB: null, fallback: null }),null);
});

test('a write that could not land is reported, one write late rather than never',async()=>{
  // A write-through cache cannot fail synchronously, and the service's
  // "autosave unavailable" warning is worth keeping.
  const indexedDB = createFakeIndexedDb({ beforeWrite: () => { throw new Error('QuotaExceededError'); } });
  const storage = await openRecoveryStorage({ indexedDB, fallback: null });
  storage.setItem('boop-mascotte-autosave-v1', 'first');
  await storage.settled();
  assert.throws(() => storage.setItem('boop-mascotte-autosave-v1', 'second'),/Quota|aborted|failed/);
  // Reported once, not for ever: the next attempt gets to try.
  storage.setItem('boop-mascotte-autosave-v1', 'third');
  assert.equal(storage.getItem('boop-mascotte-autosave-v1'),'third');
});

test('discarding a draft discards it everywhere',async()=>{
  const indexedDB = createFakeIndexedDb();
  const storage = await openRecoveryStorage({ indexedDB, fallback: null });
  writeLocalRecovery(storage, snapshot);
  await storage.settled();
  storage.removeItem(AUTOSAVE_KEY);
  await storage.settled();
  assert.equal(readLocalRecovery(storage, (value) => value).status,'none');
  const reopened = await openRecoveryStorage({ indexedDB, fallback: null });
  assert.equal(readLocalRecovery(reopened, (value) => value).status,'none');
});
