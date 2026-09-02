import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState, createStore } from '../state/store.js';
import { createEditorSession } from '../state/editor-session.js';
import { createE2EStateSnapshot } from '../diagnostics/e2e-state-snapshot.js';

test('E2E V2 snapshot is cloneable and detached from document and session', () => {
  const store = createStore();
  store.mutateDocument({type:'animation/test', domains:['animation'], apply(document) {
    document.animationClips.push({id:'clip-1', name:'Test', duration:1, loop:false, tracks:{}});
  }});
  store.mutateSession('animationEditor', session => {
    session.animationEditor.activeClipId = 'clip-1';
    session.animationEditor.playhead = .25;
  });
  const snapshot = createE2EStateSnapshot(store.getDocument(), store.getSession());
  assert.doesNotThrow(() => structuredClone(snapshot));
  snapshot.animationClips.push({id:'escaped'});
  snapshot.animationEditor.playhead = 10;
  assert.equal(store.getDocument().animationClips.length, 1);
  assert.equal(store.getSession().animationEditor.playhead, .25);
});

test('EditorSession normalizes arbitrary selected-key identity to plain canonical data', () => {
  const source = {parameter:'lookX', time:'0.5', ignored:()=>{}};
  const session = createEditorSession({...createCleanProjectState(), selectedKey:source, svgWarnings:[{message:'safe'}]});
  assert.deepEqual(session.selectedKey, {parameter:'lookX', time:.5});
  assert.doesNotThrow(() => structuredClone(session));
});
