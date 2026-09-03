import test from 'node:test';
import assert from 'node:assert/strict';
import { humanControlLabel, readUiPreferences, UI_PREFERENCES_KEY, writeUiPreferences } from '../../ui/workspace-state.js';
import { createEditorContext } from '../../ui/editor-context.js';

test('workspace preferences are UI-only, persisted and safely normalized', () => {
  const values = new Map(), storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  writeUiPreferences({ workspace: 'rig', leftCollapsed: true, hintsDismissed: { rig: true } }, storage);
  // The Timeline starts closed — the simple path through Animate is presets
  // and three sliders — and an author who opens it keeps it open.
  assert.deepEqual(readUiPreferences(storage), { workspace: 'rig', leftCollapsed: true, rightCollapsed: false, timelineCollapsed: true, hintsDismissed: { rig: true }, guideDismissed: false, openSections: {} });
  writeUiPreferences({ timelineCollapsed: false }, storage);
  assert.equal(readUiPreferences(storage).timelineCollapsed, false, 'a chosen state is remembered');
  values.set('boop-mascotte-ui-v2', '{"workspace":"engine"}');
  assert.equal(readUiPreferences(storage).workspace, 'create');
});

test('internal animation parameters receive human labels', () => {
  assert.equal(humanControlLabel('lookX'), 'Look left / right');
  assert.equal(humanControlLabel('mouthOpen'), 'Open / close');
  assert.equal(humanControlLabel('customControl'), 'Custom Control');
});

test('project replacement can reset every transient authoring selection together', () => {
  const context=createEditorContext('animate');
  context.update({activeSemanticPartId:'gaze',activeControl:'lookX',selectedTrackParameter:'lookX',selectedKey:{time:.5},activeStateId:'happy',authorMode:'clips'});
  context.reset('create');
  assert.deepEqual(context.get(), {workspace:'create',activeSemanticPartId:null,activeControl:null,selectedTrackParameter:null,selectedKey:null,activeStateId:null,authorMode:'states'});
});

test('the guide and the open sections are remembered, and rubbish is ignored', () => {
  const values = new Map(), storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  writeUiPreferences({ workspace: 'rig', guideDismissed: true, openSections: { hands: true } }, storage);
  const saved = readUiPreferences(storage);
  assert.equal(saved.guideDismissed, true);
  assert.deepEqual(saved.openSections, { hands: true });
  storage.setItem(UI_PREFERENCES_KEY, JSON.stringify({ guideDismissed: 'yes', openSections: 'nope' }));
  const coerced = readUiPreferences(storage);
  assert.equal(coerced.guideDismissed, true, 'truthy becomes a boolean');
  assert.deepEqual(coerced.openSections, {}, 'a non-object is replaced');
});
