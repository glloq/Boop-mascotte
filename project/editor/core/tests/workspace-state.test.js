import test from 'node:test';
import assert from 'node:assert/strict';
import { humanControlLabel, readUiPreferences, UI_PREFERENCES_KEY, writeUiPreferences } from '../../ui/workspace-state.js';
import { createEditorContext } from '../../ui/editor-context.js';
import { createStore } from '../state/store.js';

test('workspace preferences are UI-only, persisted and safely normalized', () => {
  const values = new Map(), storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  writeUiPreferences({ workspace: 'rig', leftCollapsed: true, hintsDismissed: { rig: true } }, storage);
  // The Timeline starts closed — the simple path through Animate is presets
  // and three sliders — and an author who opens it keeps it open.
  assert.deepEqual(readUiPreferences(storage), { workspace: 'rig', leftCollapsed: true, rightCollapsed: false, timelineCollapsed: true, hintsDismissed: { rig: true }, puppetHidden: false, openSections: {} });
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

test('the open sections are remembered, and rubbish is ignored', () => {
  const values = new Map(), storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  writeUiPreferences({ workspace: 'rig', puppetHidden: true, openSections: { hands: true } }, storage);
  const saved = readUiPreferences(storage);
  assert.equal(saved.puppetHidden, true);
  assert.deepEqual(saved.openSections, { hands: true });
  storage.setItem(UI_PREFERENCES_KEY, JSON.stringify({ puppetHidden: 'yes', openSections: 'nope' }));
  const coerced = readUiPreferences(storage);
  assert.equal(coerced.puppetHidden, true, 'truthy becomes a boolean');
  assert.deepEqual(coerced.openSections, {}, 'a non-object is replaced');
});

test('the editor context opens on the workspace the shell restored, not on the default', () => {
  // The shell reads the workspace an author left in from their preferences; a
  // fresh session starts on `create`. These used to disagree until the author
  // happened to switch workspace, which was harmless while nothing read
  // `session.workspace` for visibility -- and stopped being harmless the moment
  // a panel started hiding itself on the way out of a workspace (VNX-03).
  const store = createStore();
  assert.equal(store.getSession().workspace, 'create', 'a fresh session starts on the default');
  assert.equal(createEditorContext('rig', store).get().workspace, 'rig');
  assert.equal(createEditorContext(undefined, createStore()).get().workspace, 'create', 'and asking for nothing changes nothing');
});
