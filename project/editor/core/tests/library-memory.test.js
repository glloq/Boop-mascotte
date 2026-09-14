import test from 'node:test';
import assert from 'node:assert/strict';
import { LIBRARY_MEMORY_KEY, RECENT_LIMIT, orderByMemory, readLibraryMemory, rememberUse, toggleFavourite } from '../../ui/character-builder/library-memory.js';

const store = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return { getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, String(value)), map };
};

test('the library remembers what was used, most recent first and eight at most', () => {
  const storage = store();
  for (const id of ['a', 'b', 'c']) rememberUse(storage, id);
  assert.deepEqual(readLibraryMemory(storage).recent, ['c', 'b', 'a']);

  // Reaching for the same one again moves it to the front rather than adding it twice.
  rememberUse(storage, 'a');
  assert.deepEqual(readLibraryMemory(storage).recent, ['a', 'c', 'b']);

  for (const id of ['d', 'e', 'f', 'g', 'h', 'i', 'j']) rememberUse(storage, id);
  const { recent } = readLibraryMemory(storage);
  assert.equal(recent.length, RECENT_LIMIT);
  assert.equal(recent[0], 'j');
  assert.ok(!recent.includes('b'), 'the oldest falls off the end');
});

test('a favourite is starred and unstarred, and survives being read back', () => {
  const storage = store();
  assert.deepEqual(toggleFavourite(storage, 'mouth.wide').favourite, ['mouth.wide']);
  assert.deepEqual(readLibraryMemory(storage).favourite, ['mouth.wide']);
  assert.deepEqual(toggleFavourite(storage, 'mouth.wide').favourite, []);
  // Nothing is written for an empty id, and the key stays one key.
  assert.deepEqual(toggleFavourite(storage, '').favourite, []);
  assert.deepEqual([...storage.map.keys()], [LIBRARY_MEMORY_KEY]);
});

test('a row is offered starred first, then recently used, then as the library has it', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }];
  const ordered = orderByMemory(items, { favourite: ['d'], recent: ['c', 'e'] });
  assert.deepEqual(ordered.map((item) => item.id), ['d', 'c', 'e', 'a', 'b']);

  // Stable inside each band: two starred keep the library's order between them.
  assert.deepEqual(orderByMemory(items, { favourite: ['e', 'b'], recent: [] }).map((item) => item.id), ['b', 'e', 'a', 'c', 'd']);
  // And with no memory at all, nothing moves.
  assert.deepEqual(orderByMemory(items, undefined).map((item) => item.id), ['a', 'b', 'c', 'd', 'e']);
});

test('a browser with storage off still reads and writes, just without a memory', () => {
  const broken = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(readLibraryMemory(broken), { recent: [], favourite: [] });
  assert.deepEqual(rememberUse(broken, 'a'), { recent: [], favourite: [] });
  assert.deepEqual(readLibraryMemory(null), { recent: [], favourite: [] });
});
