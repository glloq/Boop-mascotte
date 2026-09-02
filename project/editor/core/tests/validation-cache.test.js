import test from 'node:test';
import assert from 'node:assert/strict';
import { createValidationCache, validationRevision } from '../validation/validation-cache.js';

test('validation cache ignores transient revision changes and recomputes rig changes',()=>{
  let calls=0;
  const cache=createValidationCache(()=>{calls++;return[];},validationRevision);
  const state={validationRevision:0,schemaVersion:3,elements:{},params:{},states:{},transitions:{},transitionSettings:{},behaviors:[],semanticParts:{},animationClips:[],animationEditor:{playhead:0},selectedId:null};
  cache.run(state);
  cache.run({...state,selectedId:'eye',animationEditor:{playhead:.5}});
  assert.equal(calls,1);
  cache.run({...state,validationRevision:1,params:{lookX:{value:1}}});
  assert.equal(calls,2);
});
