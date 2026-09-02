import test from 'node:test';
import assert from 'node:assert/strict';
import { createEditorStore } from '../state/editor-store.js';
import { createHistory } from '../undo/history.js';
import { createArtworkCommands } from '../commands/artwork-commands.js';
import { createSemanticRigCommands } from '../../rig-editor/semantic-parts/semantic-rig-commands.js';
import { lifecycleDiagnostics } from '../diagnostics/lifecycle-diagnostics.js';

const element=()=>({baseTransform:{x:0,y:0,rotation:0,scaleX:1,scaleY:1,pivotX:0,pivotY:0},constraints:{},bindings:{},morph:{},meta:{nodeType:'path'}});
test('visual commands declare isolated domain revisions and remain serializable',()=>{
  const store=createEditorStore({elements:{eyeLeft:element(),eyeRight:element()},layers:[],semanticParts:{},params:{},states:{idle:{}},animationClips:[]}),history=createHistory(store);
  const artwork=createArtworkCommands(store,history), semantic=createSemanticRigCommands(store,history);
  let before=store.getDomainRevisions();artwork.setTransform('eyeLeft',{x:12});let after=store.getDomainRevisions();assert.equal(after.artwork,before.artwork+1);assert.equal(after.rig,before.rig);
  before=after;const id=semantic.createPart('eyes');after=store.getDomainRevisions();assert.equal(after.semanticRig,before.semanticRig+1);assert.equal(after.artwork,before.artwork);
  semantic.assignRole(id,'leftEye','eyeLeft');semantic.assignRole(id,'rightEye','eyeRight');
  before=store.getDomainRevisions();semantic.enableControl(id,'eyeOpen');after=store.getDomainRevisions();
  for(const domain of ['semanticRig','rig','stateMachine','artwork'])assert.equal(after[domain],before[domain]+1);
  assert.doesNotThrow(()=>structuredClone(store.getDocument()));assert.equal(history.getState().canUndo,true);
});

test('selection stress is session-only with no legacy mutation or document clone',()=>{
  const store=createEditorStore({elements:{eyeLeft:element()}}),beforeRevision=store.getPersistentRevision(),before=lifecycleDiagnostics.snapshot();
  for(let i=0;i<10_000;i++)store.mutateSession('selectedId',s=>{s.selectedId=i%2?'eyeLeft':null;});
  const after=lifecycleDiagnostics.snapshot();
  assert.equal(store.getPersistentRevision(),beforeRevision);assert.equal(after.store.legacySetState-before.store.legacySetState,0);assert.equal(after.store.wholeDocumentMutationClones-before.store.wholeDocumentMutationClones,0);assert.equal(after.store.documentMutations-before.store.documentMutations,0);
});

test('failed semantic conflicts are atomic and create no history',()=>{
  const store=createEditorStore({elements:{eyeLeft:{...element(),bindings:{scaleY:{enabled:true,expression:'manual'}}},eyeRight:element()},semanticParts:{eyes:{id:'eyes',type:'eyes',name:'Eyes',roles:{leftEye:'eyeLeft',rightEye:'eyeRight'},controls:[],controlDrivers:{},calibration:{}}},params:{},states:{idle:{}}}),history=createHistory(store),commands=createSemanticRigCommands(store,history);
  const before=structuredClone(store.getDocument()),revision=store.getPersistentRevision();assert.throws(()=>commands.enableControl('eyes','eyeOpen'),/conflict/i);assert.deepEqual(store.getDocument(),before);assert.equal(store.getPersistentRevision(),revision);assert.equal(history.getState().canUndo,false);
});
