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
