import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistory } from '../undo/history.js';

function createMockStore() {
  let state = { value: 0 };
  return {
    getState: () => state,
    replaceState(next) { state = next; },
    set(value) { state = { value }; }
  };
}

test('history exposes undo/redo availability', () => {
  const store = createMockStore();
  const history = createHistory(store);
  assert.deepEqual(history.getState(), { canUndo: false, canRedo: false });

  history.snapshot();
  assert.equal(history.getState().canUndo, true);

  store.set(1);
  history.undo();
  assert.equal(history.getState().canRedo, true);
});

test('a transaction inside a transaction is the outer one: begin says who opened it, and one undo takes all of it back', () => {
  const store = createMockStore();
  const history = createHistory(store);
  assert.equal(history.beginTransaction(), true, 'the first caller opens it');
  store.set(1); history.snapshot();
  const inner = history.beginTransaction();
  assert.equal(inner, false, 'the caller inside does not');
  store.set(2); history.snapshot();
  if (inner) history.commitTransaction();
  store.set(3); history.snapshot();
  history.commitTransaction();
  assert.deepEqual(history.getState(), { canUndo: true, canRedo: false });
  history.undo();
  assert.deepEqual(store.getState(), { value: 0 }, 'one step, back to before the outer began');
  assert.deepEqual(history.getState(), { canUndo: false, canRedo: true });
});
