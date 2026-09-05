import test from 'node:test';
import assert from 'node:assert/strict';
import { createCleanProjectState, createStore } from '../state/store.js';
import { createEditorSession } from '../state/editor-session.js';
import { createE2EDocumentSnapshot, createE2EReadinessSnapshot, createE2ESessionSnapshot, createE2EStateSnapshot } from '../diagnostics/e2e-state-snapshot.js';

const documentFields = ['svgMarkup','elements','layers','layerMetadata','params','globalConstraints','stateConstraints','runtimeConfig','states','transitions','transitionSettings','activeState','behaviors','semanticParts','animationClips'];
const sessionFields = ['selectedId','selectedIds','svgWarnings','workspace','activeSemanticPartId','activeControl','selectedTrackParameter','selectedKey','activeStateId','authorMode','animationEditor','focusPreview'];

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

test('owner-specific E2E snapshots are cloneable, detached, and mutually exclusive', () => {
  const store = createStore();
  store.mutateDocument({type:'state/test', domains:['stateMachine'], apply(document) {
    document.states.idle = {lookX:0};
  }});
  store.mutateSession(['workspace','animationEditor'], session => {
    session.workspace = 'rig';
    session.animationEditor.playhead = .25;
  });
  const document = createE2EDocumentSnapshot(store.getDocument());
  const session = createE2ESessionSnapshot(store.getSession());

  assert.doesNotThrow(() => structuredClone(document));
  assert.doesNotThrow(() => structuredClone(session));
  for (const field of documentFields) assert.ok(Object.hasOwn(document, field), `document includes ${field}`);
  for (const field of sessionFields) assert.ok(!Object.hasOwn(document, field), `document excludes ${field}`);
  for (const field of sessionFields) assert.ok(Object.hasOwn(session, field), `session includes ${field}`);
  for (const field of documentFields) assert.ok(!Object.hasOwn(session, field), `session excludes ${field}`);

  document.states.idle.lookX = 999;
  session.workspace = 'fake';
  session.animationEditor.playhead = 10;
  assert.equal(store.getDocument().states.idle.lookX, 0);
  assert.equal(store.getSession().workspace, 'rig');
  assert.equal(store.getSession().animationEditor.playhead, .25);
});

test('compatibility E2E snapshot remains detached across both owners', () => {
  const store = createStore();
  store.mutateDocument({type:'state/test', domains:['stateMachine'], apply(document) {
    document.states.idle = {lookX:0};
  }});
  const state = createE2EStateSnapshot(store.getDocument(), store.getSession());
  state.workspace = 'fake';
  state.states.idle.lookX = 100;
  assert.equal(store.getSession().workspace, 'create');
  assert.equal(store.getDocument().states.idle.lookX, 0);
});

test('E2E readiness is structured-clone-safe, detached, and read-only', () => {
  const readiness = { export: { status: 'error', issues: [{ id: 'artwork.missing' }] } };
  const issues = [{ id: 'artwork.missing', severity: 'error', fix: { workspace: 'create' } }];
  const snapshot = createE2EReadinessSnapshot(readiness, issues);
  assert.doesNotThrow(() => structuredClone(snapshot));
  snapshot.readiness.export.status = 'ready';
  snapshot.issues[0].id = 'changed';
  assert.equal(readiness.export.status, 'error');
  assert.equal(issues[0].id, 'artwork.missing');
});

test('EditorSession normalizes arbitrary selected-key identity to plain canonical data', () => {
  const source = {parameter:'lookX', time:'0.5', ignored:()=>{}};
  const session = createEditorSession({...createCleanProjectState(), selectedKey:source, svgWarnings:[{message:'safe'}]});
  assert.deepEqual(session.selectedKey, {parameter:'lookX', time:.5});
  assert.doesNotThrow(() => structuredClone(session));
});
