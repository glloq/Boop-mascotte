import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';

test('session stress never changes document revisions or history',()=>{
  const store=createEditorStore(),history=createHistory(store),before=store.getPersistentRevision();
  for(let i=0;i<10000;i++)store.mutateSession('selectedId',s=>{s.selectedId=`part-${i}`;});
  for(let i=0;i<10000;i++)store.mutateSession('animationEditor',s=>{s.animationEditor.playhead=i/10000;});
  for(let i=0;i<1000;i++)store.mutateSession('workspace',s=>{s.workspace=i%2?'rig':'animate';});
  assert.equal(store.getPersistentRevision(),before);assert.deepEqual(history.getState(),{canUndo:false,canRedo:false});
});

test('domain revisions and subscriptions are isolated',()=>{
  const store=createEditorStore(),calls={artwork:0,rig:0,animation:0,selection:0};
  for(const domain of ['artwork','rig','animation'])store.subscribeDocument(domain,()=>calls[domain]++);
  store.subscribeSession('selectedId',()=>calls.selection++);
  store.mutateSession('selectedId',s=>{s.selectedId='mouth';});
  assert.deepEqual(calls,{artwork:0,rig:0,animation:0,selection:1});
  store.execute({type:'animation/update-key',source:'timeline',domains:['animation'],apply:d=>d.animationClips.push({id:'a',tracks:{}})});
  assert.deepEqual(calls,{artwork:0,rig:0,animation:1,selection:1});assert.equal(store.getDomainRevision('rig'),0);assert.equal(store.getDomainRevision('animation'),1);
});

test('history restores document token but preserves editor session',()=>{
  const store=createEditorStore({elements:{mouth:{}},animationClips:[]}),history=createHistory(store);store.mutateSession(['selectedId','workspace','animationEditor'],s=>{s.selectedId='mouth';s.workspace='animate';s.animationEditor.playhead=.75;});
  const saved=store.getDocumentVersionToken();history.snapshot();store.execute({type:'animation/add',source:'test',domains:['animation'],apply:d=>d.animationClips.push({id:'a'})});const edited=store.getDocumentVersionToken();history.undo();
  assert.equal(store.getDocumentVersionToken(),saved);assert.equal(store.getSession().selectedId,'mouth');assert.equal(store.getSession().workspace,'animate');assert.equal(store.getSession().animationEditor.playhead,.75);history.redo();assert.equal(store.getDocumentVersionToken(),edited);
});
