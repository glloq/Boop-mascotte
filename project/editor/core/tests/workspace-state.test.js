import test from 'node:test';
import assert from 'node:assert/strict';
import { humanControlLabel, readUiPreferences, writeUiPreferences } from '../../ui/workspace-state.js';

test('workspace preferences are UI-only, persisted and safely normalized', () => {
  const values = new Map(), storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  writeUiPreferences({ workspace: 'rig', leftCollapsed: true, hintsDismissed: { rig: true } }, storage);
  assert.deepEqual(readUiPreferences(storage), { workspace: 'rig', leftCollapsed: true, rightCollapsed: false, timelineCollapsed: false, hintsDismissed: { rig: true } });
  values.set('boop-mascotte-ui-v2', '{"workspace":"engine"}');
  assert.equal(readUiPreferences(storage).workspace, 'create');
});

test('internal animation parameters receive human labels', () => {
  assert.equal(humanControlLabel('lookX'), 'Look left / right');
  assert.equal(humanControlLabel('mouthOpen'), 'Open / close');
  assert.equal(humanControlLabel('customControl'), 'Custom Control');
});
