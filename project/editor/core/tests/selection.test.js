import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSelection, selectionOf, selectMany, selectOnly, toggleSelected } from '../state/selection.js';
import { createEditorSession } from '../state/editor-session.js';

test('a plain selectedId is a selection of one, and nothing is nothing', () => {
  assert.deepEqual(normalizeSelection({ selectedId: 'head' }), { selectedId: 'head', selectedIds: ['head'] });
  assert.deepEqual(normalizeSelection({ selectedId: null, selectedIds: ['head'] }), { selectedId: null, selectedIds: [] });
  assert.deepEqual(normalizeSelection({}), { selectedId: null, selectedIds: [] });
  assert.deepEqual(normalizeSelection({ selectedId: 'head', selectedIds: ['eye', 'head', 'eye', 7, ''] }), { selectedId: 'head', selectedIds: ['eye', 'head'] });
});

test('the piece in hand is always a member, and always last', () => {
  assert.deepEqual(normalizeSelection({ selectedId: 'eye', selectedIds: ['eye', 'head', 'nose'] }), { selectedId: 'eye', selectedIds: ['head', 'nose', 'eye'] });
  // A selectedId written on its own — a click, a panel — replaces the set.
  assert.deepEqual(normalizeSelection({ selectedId: 'mouth', selectedIds: ['eye', 'head'] }), { selectedId: 'mouth', selectedIds: ['mouth'] });
});

test('Shift+click adds, then takes back out, and the last one picked is in hand', () => {
  let session = selectOnly('head');
  session = toggleSelected(session, 'eye');
  assert.deepEqual(session, { selectedId: 'eye', selectedIds: ['head', 'eye'] });
  session = toggleSelected(session, 'nose');
  assert.deepEqual(selectionOf(session), ['head', 'eye', 'nose']);
  session = toggleSelected(session, 'nose');
  assert.deepEqual(session, { selectedId: 'eye', selectedIds: ['head', 'eye'] });
  session = toggleSelected(session, 'head');
  session = toggleSelected(session, 'eye');
  assert.deepEqual(session, { selectedId: null, selectedIds: [] });
  assert.deepEqual(toggleSelected(session, ''), { selectedId: null, selectedIds: [] });
});

test('selectMany keeps the order given and can name the piece in hand', () => {
  assert.deepEqual(selectMany(['a', 'b', 'c']), { selectedId: 'c', selectedIds: ['a', 'b', 'c'] });
  assert.deepEqual(selectMany(['a', 'b', 'c'], 'a'), { selectedId: 'a', selectedIds: ['b', 'c', 'a'] });
  assert.deepEqual(selectMany(['a', 'b'], 'zzz'), { selectedId: 'b', selectedIds: ['a', 'b'] });
  assert.deepEqual(selectMany([]), { selectedId: null, selectedIds: [] });
});

test('the session carries the selection and keeps it consistent', () => {
  const session = createEditorSession({ selectedId: 'head', selectedIds: ['eye', 'head'] });
  assert.deepEqual([session.selectedId, session.selectedIds], ['head', ['eye', 'head']]);
  const plain = createEditorSession({ selectedId: 'head' });
  assert.deepEqual(plain.selectedIds, ['head']);
  const stale = createEditorSession({ selectedId: 'nose', selectedIds: ['eye', 'head'] });
  assert.deepEqual(stale.selectedIds, ['nose'], 'a selectedId written alone replaces the set');
  assert.deepEqual(createEditorSession({}).selectedIds, []);
});
